-- 1. Persist the designated Comeback Captain.

alter table public.game_rooms
add column if not exists comeback_captain_id uuid
references public.users(id);


-- 2. Award comeback Hearts after each shot.

create or replace function public.award_gentle_comeback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_room public.game_rooms%rowtype;

    v_host_shots integer;
    v_guest_shots integer;

    v_host_hits integer;
    v_guest_hits integer;

    v_trailing_captain uuid;
    v_hit_difference integer;

    v_milestone text;
    v_reward integer;
    v_inserted integer;
begin
    -- Lock the room to serialize comeback evaluation.
    select *
    into v_room
    from public.game_rooms
    where id = new.room_id
    for update;

    if not found or v_room.guest_id is null then
        return new;
    end if;

    select
        count(*) filter (
            where attacker_id = v_room.host_id
        ),
        count(*) filter (
            where attacker_id = v_room.guest_id
        ),
        count(*) filter (
            where attacker_id = v_room.host_id
              and is_hit = true
        ),
        count(*) filter (
            where attacker_id = v_room.guest_id
              and is_hit = true
        )
    into
        v_host_shots,
        v_guest_shots,
        v_host_hits,
        v_guest_hits
    from public.game_shots
    where room_id = new.room_id;

    -- Neither captain can qualify before both have
    -- fired at least five shots.
    if v_host_shots < 5 or v_guest_shots < 5 then
        return new;
    end if;

    if v_host_hits > v_guest_hits then
        v_trailing_captain := v_room.guest_id;
        v_hit_difference := v_host_hits - v_guest_hits;

    elsif v_guest_hits > v_host_hits then
        v_trailing_captain := v_room.host_id;
        v_hit_difference := v_guest_hits - v_host_hits;

    else
        return new;
    end if;

    -- At least a four-hit difference is required.
    if v_hit_difference < 4 then
        return new;
    end if;

    -- The first qualifying captain owns the mechanic
    -- for the entire match.
    if v_room.comeback_captain_id is null then
        update public.game_rooms
        set comeback_captain_id = v_trailing_captain
        where id = new.room_id;

        v_room.comeback_captain_id := v_trailing_captain;
    end if;

    -- Never transfer eligibility to the other captain.
    if v_room.comeback_captain_id <> v_trailing_captain then
        return new;
    end if;

    -- Ensure the player's Heart balance exists.
    insert into public.game_hearts (
        room_id,
        user_id,
        balance
    )
    values (
        new.room_id,
        v_trailing_captain,
        2
    )
    on conflict (room_id, user_id) do nothing;

    -- First comeback: +1 Heart.
    -- A gap of 7+ also satisfies the first threshold.
    v_milestone := 'gentle_comeback_first';
    v_reward := 1;

    insert into public.game_heart_events (
        room_id,
        user_id,
        milestone,
        amount
    )
    values (
        new.room_id,
        v_trailing_captain,
        v_milestone,
        v_reward
    )
    on conflict (room_id, user_id, milestone)
    do nothing;

    get diagnostics v_inserted = row_count;

    if v_inserted > 0 then
        update public.game_hearts
        set balance = balance + v_reward
        where room_id = new.room_id
          and user_id = v_trailing_captain;
    end if;

    -- Stronger comeback: +2 Hearts.
    if v_host_shots >= 10
       and v_guest_shots >= 10
       and v_hit_difference >= 7 then

        v_milestone := 'gentle_comeback_stronger';
        v_reward := 2;

        insert into public.game_heart_events (
            room_id,
            user_id,
            milestone,
            amount
        )
        values (
            new.room_id,
            v_trailing_captain,
            v_milestone,
            v_reward
        )
        on conflict (room_id, user_id, milestone)
        do nothing;

        get diagnostics v_inserted = row_count;

        if v_inserted > 0 then
            update public.game_hearts
            set balance = balance + v_reward
            where room_id = new.room_id
              and user_id = v_trailing_captain;
        end if;
    end if;

    return new;
end;
$$;


-- 3. Install the trigger.

drop trigger if exists trg_gentle_comeback
on public.game_shots;

create trigger trg_gentle_comeback
after insert on public.game_shots
for each row
execute function public.award_gentle_comeback();


-- 4. Restrict direct execution.

revoke all on function public.award_gentle_comeback()
from public, anon, authenticated;

-- The trigger itself continues to execute automatically.