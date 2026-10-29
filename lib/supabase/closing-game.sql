create table if not exists public.game_closing_letters (
    room_id uuid not null
        references public.game_rooms(id) on delete cascade,

    user_id uuid not null
        references public.users(id),

    decision text not null
        check (decision in ('sealed', 'passed')),

    letter_text text,

    submitted_at timestamptz not null default now(),

    primary key (room_id, user_id),

    constraint closing_letter_content_check check (
        (
            decision = 'sealed'
            and letter_text is not null
            and char_length(btrim(letter_text)) between 1 and 300
        )
        or (
            decision = 'passed'
            and letter_text is null
        )
    )
);

create index if not exists game_closing_letters_room_idx
on public.game_closing_letters(room_id);

alter table public.game_closing_letters
enable row level security;

revoke all on public.game_closing_letters
from anon, authenticated;

grant select, insert on public.game_closing_letters
to service_role;

create or replace function public.submit_game_closing_letter(
    p_room_id uuid,
    p_user_id uuid,
    p_decision text,
    p_letter_text text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_room public.game_rooms%rowtype;
    v_letter text;
begin
    select *
    into v_room
    from public.game_rooms
    where id = p_room_id
    for update;

    if not found then
        raise exception 'ROOM_NOT_FOUND';
    end if;

    if p_user_id is distinct from v_room.host_id
       and p_user_id is distinct from v_room.guest_id then
        raise exception 'NOT_A_PARTICIPANT';
    end if;

    if v_room.status <> 'finished' then
        raise exception 'MATCH_NOT_FINISHED';
    end if;

    if p_decision not in ('sealed', 'passed') then
        raise exception 'INVALID_DECISION';
    end if;

    v_letter := nullif(btrim(p_letter_text), '');

    if p_decision = 'sealed' then
        if v_letter is null or char_length(v_letter) > 300 then
            raise exception 'INVALID_LETTER';
        end if;
    else
        v_letter := null;
    end if;

    insert into public.game_closing_letters (
        room_id,
        user_id,
        decision,
        letter_text
    )
    values (
        p_room_id,
        p_user_id,
        p_decision,
        v_letter
    );

exception
    when unique_violation then
        raise exception 'LETTER_ALREADY_SUBMITTED';
end;
$$;

revoke all on function public.submit_game_closing_letter(
    uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.submit_game_closing_letter(
    uuid, uuid, text, text
) to service_role;

create or replace function public.protect_game_closing_letter()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'CLOSING_LETTER_IS_FINAL';
end;
$$;

drop trigger if exists trg_protect_game_closing_letter
on public.game_closing_letters;

create trigger trg_protect_game_closing_letter
before update or delete
on public.game_closing_letters
for each row
execute function public.protect_game_closing_letter();

revoke all on function public.protect_game_closing_letter()
from public, anon, authenticated;