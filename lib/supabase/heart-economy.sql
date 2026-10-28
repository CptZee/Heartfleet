
-- Each captain's Heart balance for a match.
create table if not exists public.game_hearts (
    room_id uuid not null references public.game_rooms(id)
        on delete cascade,
    user_id uuid not null references public.users(id),
    balance integer not null default 2
        check (balance >= 0),
    created_at timestamptz not null default now(),
    primary key (room_id, user_id)
);

-- Permanent record of each milestone reward.
create table if not exists public.game_heart_events (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.game_rooms(id)
        on delete cascade,
    user_id uuid not null references public.users(id),
    milestone text not null,
    amount integer not null check (amount > 0),
    created_at timestamptz not null default now(),
    unique (room_id, user_id, milestone)
);

-- Unused Heartbeat opportunities.
create table if not exists public.game_heartbeat_opportunities (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.game_rooms(id)
        on delete cascade,
    user_id uuid not null references public.users(id),
    milestone text not null,
    status text not null default 'available'
        check (status in ('available', 'used')),
    created_at timestamptz not null default now(),
    unique (room_id, user_id, milestone)
);

create index if not exists game_heart_events_lookup_idx
    on public.game_heart_events(room_id, user_id, created_at);

-- Only server-side service-role access.
alter table public.game_hearts enable row level security;
alter table public.game_heart_events enable row level security;
alter table public.game_heartbeat_opportunities enable row level security;

revoke all on public.game_hearts
    from anon, authenticated;
revoke all on public.game_heart_events
    from anon, authenticated;
revoke all on public.game_heartbeat_opportunities
    from anon, authenticated;

-- Initialize both captains when a match starts.
create or replace function public.initialize_game_hearts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new.status = 'playing'
       and old.status is distinct from 'playing' then

        insert into public.game_hearts (room_id, user_id)
        values
            (new.id, new.host_id),
            (new.id, new.guest_id)
        on conflict do nothing;

    end if;

    return new;
end;
$$;

drop trigger if exists trg_initialize_game_hearts
    on public.game_rooms;

create trigger trg_initialize_game_hearts
after update of status on public.game_rooms
for each row
execute function public.initialize_game_hearts();

-- Safely grant a one-time milestone reward.
create or replace function public.grant_game_heart_milestone(
    p_room_id uuid,
    p_user_id uuid,
    p_milestone text,
    p_amount integer,
    p_heartbeat_opportunity boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_inserted integer;
begin
    insert into public.game_heart_events (
        room_id, user_id, milestone, amount
    )
    values (
        p_room_id, p_user_id, p_milestone, p_amount
    )
    on conflict (room_id, user_id, milestone)
    do nothing;

    get diagnostics v_inserted = row_count;

    if v_inserted = 0 then
        return;
    end if;

    insert into public.game_hearts (
        room_id, user_id, balance
    )
    values (
        p_room_id, p_user_id, 2 + p_amount
    )
    on conflict (room_id, user_id)
    do update set
        balance = public.game_hearts.balance
            + excluded.balance - 2;

    if p_heartbeat_opportunity then
        insert into public.game_heartbeat_opportunities (
            room_id, user_id, milestone
        )
        values (
            p_room_id, p_user_id, p_milestone
        )
        on conflict do nothing;
    end if;
end;
$$;

-- Award attack-count and first-hit milestones.
create or replace function public.award_game_shot_hearts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_attacks integer;
begin
    select count(*) into v_attacks
    from public.game_shots
    where room_id = new.room_id
      and attacker_id = new.attacker_id;

    if new.is_hit then
        perform public.grant_game_heart_milestone(
            new.room_id, new.attacker_id,
            'first_hit', 1, false
        );
    end if;

    if v_attacks = 5 then
        perform public.grant_game_heart_milestone(
            new.room_id, new.attacker_id,
            'attacks_5', 1, false
        );
    elsif v_attacks = 10 then
        perform public.grant_game_heart_milestone(
            new.room_id, new.attacker_id,
            'attacks_10', 1, true
        );
    elsif v_attacks = 20 then
        perform public.grant_game_heart_milestone(
            new.room_id, new.attacker_id,
            'attacks_20', 1, true
        );
    end if;

    return new;
end;
$$;

drop trigger if exists trg_award_game_shot_hearts
    on public.game_shots;

create trigger trg_award_game_shot_hearts
after insert on public.game_shots
for each row
execute function public.award_game_shot_hearts();

-- Ship sinking is recorded by updating sunk_ship
-- after the shot has been inserted.
create or replace function public.award_game_sunk_hearts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_sunk_count integer;
begin
    if new.sunk_ship is null
       or old.sunk_ship is not null then
        return new;
    end if;

    select count(*) into v_sunk_count
    from public.game_shots
    where room_id = new.room_id
      and attacker_id = new.attacker_id
      and sunk_ship is not null;

    if v_sunk_count = 1 then
        perform public.grant_game_heart_milestone(
            new.room_id, new.attacker_id,
            'ships_1', 2, true
        );
    elsif v_sunk_count = 3 then
        perform public.grant_game_heart_milestone(
            new.room_id, new.attacker_id,
            'ships_3', 2, true
        );
    elsif v_sunk_count = 5 then
        perform public.grant_game_heart_milestone(
            new.room_id, new.attacker_id,
            'ships_5', 2, true
        );
    end if;

    return new;
end;
$$;

drop trigger if exists trg_award_game_sunk_hearts
    on public.game_shots;

create trigger trg_award_game_sunk_hearts
after update of sunk_ship on public.game_shots
for each row
execute function public.award_game_sunk_hearts();

-- Initialize existing active or completed matches.
-- This does not retroactively award past milestones.
insert into public.game_hearts (room_id, user_id)
select id, host_id
from public.game_rooms
where status in ('playing', 'finished')
on conflict do nothing;

insert into public.game_hearts (room_id, user_id)
select id, guest_id
from public.game_rooms
where status in ('playing', 'finished')
  and guest_id is not null
on conflict do nothing;

-- Keep reward functions inaccessible through the public API.
revoke all on function public.grant_game_heart_milestone(
    uuid, uuid, text, integer, boolean
) from public, anon, authenticated;

revoke all on function public.initialize_game_hearts()
    from public, anon, authenticated;

revoke all on function public.award_game_shot_hearts()
    from public, anon, authenticated;

revoke all on function public.award_game_sunk_hearts()
    from public, anon, authenticated;
