
create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references public.users(id),
  guest_id uuid references public.users(id),
  status text not null default 'waiting'
    check (status in ('waiting', 'placing', 'playing', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint different_players check (
    guest_id is null or guest_id <> host_id
  )
);

create index if not exists game_rooms_host_idx
  on public.game_rooms(host_id);

create index if not exists game_rooms_guest_idx
  on public.game_rooms(guest_id);

-- Atomic join operation prevents two guests taking the last slot.
create or replace function public.join_game_room(
  p_code text,
  p_user_id uuid
)
returns public.game_rooms
language plpgsql
set search_path = ''
as $$
declare
  v_room public.game_rooms;
begin
  update public.game_rooms
  set
    guest_id = p_user_id,
    status = 'placing',
    updated_at = now()
  where code = upper(trim(p_code))
    and status = 'waiting'
    and guest_id is null
    and host_id <> p_user_id
  returning * into v_room;

  if v_room.id is null then
    raise exception 'Room not found, already full, or unavailable';
  end if;

  return v_room;
end;
$$;

revoke all on function public.join_game_room(text, uuid)
  from public, anon, authenticated;

grant execute on function public.join_game_room(text, uuid)
  to service_role;
