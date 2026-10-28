
create table if not exists public.game_fleets (
  room_id uuid not null references public.game_rooms(id)
    on delete cascade,
  user_id uuid not null references public.users(id)
    on delete cascade,
  ships jsonb not null,
  is_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.game_fleets enable row level security;

revoke all on public.game_fleets
  from anon, authenticated;

-- Prevent direct public access to the placement data.
-- Only trusted server-side operations use the service role.

create or replace function public.submit_game_fleet(
  p_room_id uuid,
  p_user_id uuid,
  p_ships jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.game_rooms;
  v_ready_count integer;
begin
  select *
  into v_room
  from public.game_rooms
  where id = p_room_id
  for update;

  if not found
     or v_room.status <> 'placing'
     or v_room.guest_id is null
     or p_user_id not in (v_room.host_id, v_room.guest_id)
  then
    raise exception 'Room is not available for placement';
  end if;

  insert into public.game_fleets (
    room_id, user_id, ships, is_ready
  )
  values (
    p_room_id, p_user_id, p_ships, true
  )
  on conflict (room_id, user_id)
  do update set
    ships = excluded.ships,
    is_ready = true,
    updated_at = now()
  where public.game_fleets.is_ready = false;

  if not found then
    raise exception 'Fleet is already locked';
  end if;

  select count(*)
  into v_ready_count
  from public.game_fleets
  where room_id = p_room_id
    and is_ready = true
    and user_id in (v_room.host_id, v_room.guest_id);

  if v_ready_count = 2 then
update public.game_rooms
set
  status = 'playing',
  current_turn_id = v_room.host_id,
  winner_id = null,
  started_at = now(),
  finished_at = null,
  updated_at = now()
where id = p_room_id;

    return 'playing';
  end if;

  return 'placing';
end;
$$;

revoke all on function public.submit_game_fleet(
  uuid, uuid, jsonb
) from public, anon, authenticated;

grant execute on function public.submit_game_fleet(
  uuid, uuid, jsonb
) to service_role;
