
-- A Heartbeat session belongs to one earned opportunity.
create table if not exists public.game_heartbeats (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.game_rooms(id)
        on delete cascade,
    opportunity_id uuid not null unique
        references public.game_heartbeat_opportunities(id),
    initiator_id uuid not null references public.users(id),
    chooser_id uuid not null references public.users(id),
    status text not null default 'choosing'
        check (status in ('choosing', 'answering', 'completed', 'skipped')),
    question_source text
        check (question_source in ('curated', 'custom')),
    question_key text,
    question_text text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint heartbeat_question_length check (
        question_text is null
        or char_length(question_text) between 1 and 300
    )
);

-- At most one unfinished interaction per room.
create unique index if not exists
    one_active_heartbeat_per_room
on public.game_heartbeats(room_id)
where status in ('choosing', 'answering');

create index if not exists game_heartbeats_room_idx
on public.game_heartbeats(room_id, created_at desc);

alter table public.game_heartbeats enable row level security;
revoke all on public.game_heartbeats
    from anon, authenticated;

-- Activating a Heartbeat:
-- 1. Locks the room to serialize competing activations.
-- 2. Verifies membership and ownership.
-- 3. Checks the saved opportunity and 3-Heart balance.
-- 4. Deducts Hearts and creates a session atomically.
create or replace function public.activate_game_heartbeat(
    p_room_id uuid,
    p_user_id uuid,
    p_opportunity_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_room public.game_rooms%rowtype;
    v_opportunity public.game_heartbeat_opportunities%rowtype;
    v_chooser uuid;
    v_heartbeat_id uuid;
begin
    select * into v_room
    from public.game_rooms
    where id = p_room_id
    for update;

    if not found
       or p_user_id not in (v_room.host_id, v_room.guest_id)
       or v_room.status not in ('playing', 'finished') then
        raise exception 'ROOM_UNAVAILABLE';
    end if;

    if exists (
        select 1
        from public.game_heartbeats
        where room_id = p_room_id
          and status in ('choosing', 'answering')
    ) then
        raise exception 'HEARTBEAT_ALREADY_ACTIVE';
    end if;

    select * into v_opportunity
    from public.game_heartbeat_opportunities
    where id = p_opportunity_id
      and room_id = p_room_id
      and user_id = p_user_id
      and status = 'available'
    for update;

    if not found then
        raise exception 'OPPORTUNITY_UNAVAILABLE';
    end if;

    update public.game_hearts
    set balance = balance - 3
    where room_id = p_room_id
      and user_id = p_user_id
      and balance >= 3;

    if not found then
        raise exception 'INSUFFICIENT_HEARTS';
    end if;

    v_chooser := case
        when p_user_id = v_room.host_id
        then v_room.guest_id
        else v_room.host_id
    end;

    update public.game_heartbeat_opportunities
    set status = 'used'
    where id = p_opportunity_id;

    insert into public.game_heartbeats (
        room_id,
        opportunity_id,
        initiator_id,
        chooser_id
    )
    values (
        p_room_id,
        p_opportunity_id,
        p_user_id,
        v_chooser
    )
    returning id into v_heartbeat_id;

    return v_heartbeat_id;
end;
$$;

-- The opponent chooses a question.
-- The application validates curated question IDs/text
-- before invoking this function.
create or replace function public.choose_game_heartbeat_question(
    p_room_id uuid,
    p_user_id uuid,
    p_heartbeat_id uuid,
    p_source text,
    p_question_key text,
    p_question_text text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_room public.game_rooms%rowtype;
begin
    select * into v_room
    from public.game_rooms
    where id = p_room_id
    for update;

    if not found
       or p_user_id not in (v_room.host_id, v_room.guest_id) then
        raise exception 'ROOM_UNAVAILABLE';
    end if;

    if p_source not in ('curated', 'custom')
       or char_length(btrim(coalesce(p_question_text, '')))
          not between 1 and 300
       or (p_source = 'curated' and p_question_key is null)
       or (p_source = 'custom' and p_question_key is not null) then
        raise exception 'INVALID_QUESTION';
    end if;

    update public.game_heartbeats
    set status = 'answering',
        question_source = p_source,
        question_key = p_question_key,
        question_text = btrim(p_question_text),
        updated_at = now()
    where id = p_heartbeat_id
      and room_id = p_room_id
      and chooser_id = p_user_id
      and status = 'choosing';

    if not found then
        raise exception 'HEARTBEAT_NOT_AVAILABLE';
    end if;
end;
$$;

-- No anonymous/client-side RPC execution.
revoke all on function public.activate_game_heartbeat(
    uuid, uuid, uuid
) from public, anon, authenticated;

revoke all on function public.choose_game_heartbeat_question(
    uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.activate_game_heartbeat(
    uuid, uuid, uuid
) to service_role;

grant execute on function public.choose_game_heartbeat_question(
    uuid, uuid, uuid, text, text, text
) to service_role;

alter table public.game_heartbeats
add column if not exists answer_text text,
add column if not exists completed_at timestamptz;

alter table public.game_heartbeats
drop constraint if exists game_heartbeats_answer_length;

alter table public.game_heartbeats
add constraint game_heartbeats_answer_length
check (
    answer_text is null
    or char_length(answer_text) between 1 and 1000
);

create or replace function public.respond_game_heartbeat(
    p_room_id uuid,
    p_user_id uuid,
    p_heartbeat_id uuid,
    p_action text,
    p_answer text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_room public.game_rooms%rowtype;
    v_answer text;
begin
    -- Serialize against other room operations,
    -- including attacks and Heartbeat activation.
    select *
    into v_room
    from public.game_rooms
    where id = p_room_id
    for update;

    if not found
       or p_user_id not in (v_room.host_id, v_room.guest_id) then
        raise exception 'ROOM_UNAVAILABLE';
    end if;

    if p_action not in ('answer', 'skip') then
        raise exception 'INVALID_ACTION';
    end if;

    v_answer := nullif(btrim(coalesce(p_answer, '')), '');

    if p_action = 'answer'
       and (
           v_answer is null
           or char_length(v_answer) > 1000
       ) then
        raise exception 'INVALID_ANSWER';
    end if;

    update public.game_heartbeats
    set status = case
            when p_action = 'answer' then 'completed'
            else 'skipped'
        end,
        answer_text = case
            when p_action = 'answer' then v_answer
            else null
        end,
        completed_at = now(),
        updated_at = now()
    where id = p_heartbeat_id
      and room_id = p_room_id
      and initiator_id = p_user_id
      and status = 'answering';

    if not found then
        raise exception 'HEARTBEAT_NOT_AVAILABLE';
    end if;
end;
$$;

revoke all on function public.respond_game_heartbeat(
    uuid, uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.respond_game_heartbeat(
    uuid, uuid, uuid, text, text
) to service_role;