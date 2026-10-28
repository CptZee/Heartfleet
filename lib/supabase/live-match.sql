
alter table public.game_rooms
  add column if not exists current_turn_id uuid
    references public.users(id),
  add column if not exists winner_id uuid
    references public.users(id),
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

create table if not exists public.game_shots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id)
    on delete cascade,
  attacker_id uuid not null references public.users(id),
  defender_id uuid not null references public.users(id),
  row integer not null check (row between 0 and 9),
  col integer not null check (col between 0 and 9),
  is_hit boolean not null,
  sunk_ship text,
  created_at timestamptz not null default now(),
  unique (room_id, attacker_id, row, col),
  check (attacker_id <> defender_id)
);

create index if not exists game_shots_room_idx
  on public.game_shots(room_id, created_at);

alter table public.game_shots enable row level security;

revoke all on public.game_shots
  from anon, authenticated;

-- The server uses its service role to invoke this function.
-- A row lock serializes simultaneous attacks.
create or replace function public.fire_game_shot(
  p_room_id uuid,
  p_user_id uuid,
  p_row integer,
  p_col integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.game_rooms;
  v_defender uuid;
  v_fleet jsonb;
  v_ship jsonb;
  v_ship_id text;
  v_ship_row integer;
  v_ship_col integer;
  v_ship_size integer;
  v_orientation text;
  v_cell_row integer;
  v_cell_col integer;
  v_hit boolean := false;
  v_sunk text := null;
  v_all_hit boolean;
  v_won boolean := false;
  v_next_turn uuid;
  v_shot_id uuid;
  v_index integer;
begin
  if p_row is null or p_col is null
     or p_row not between 0 and 9
     or p_col not between 0 and 9 then
    raise exception 'Invalid coordinate';
  end if;

  select * into v_room
  from public.game_rooms
  where id = p_room_id
  for update;

  if not found or v_room.status <> 'playing' then
    raise exception 'Match is not active';
  end if;

  if p_user_id not in (v_room.host_id, v_room.guest_id) then
    raise exception 'Not a participant';
  end if;

  if v_room.current_turn_id is distinct from p_user_id then
    raise exception 'Not your turn';
  end if;

  if exists (
    select 1 from public.game_shots
    where room_id = p_room_id
      and attacker_id = p_user_id
      and row = p_row and col = p_col
  ) then
    raise exception 'Coordinate already attacked';
  end if;

  v_defender := case
    when p_user_id = v_room.host_id then v_room.guest_id
    else v_room.host_id
  end;

  select ships into v_fleet
  from public.game_fleets
  where room_id = p_room_id
    and user_id = v_defender
    and is_ready = true;

  if v_fleet is null then
    raise exception 'Defender fleet unavailable';
  end if;

  -- Determine whether the selected coordinate contains a ship.
  for v_ship in
    select value from jsonb_array_elements(v_fleet)
  loop
    v_ship_id := v_ship->>'id';
    v_ship_row := (v_ship->>'row')::integer;
    v_ship_col := (v_ship->>'col')::integer;
    v_orientation := v_ship->>'orientation';

    v_ship_size := case v_ship_id
      when 'carrier' then 5
      when 'battleship' then 4
      when 'destroyer' then 3
      when 'submarine' then 3
      when 'patrol' then 2
      else 0
    end;

    for v_index in 0..v_ship_size - 1 loop
      v_cell_row := v_ship_row +
        case when v_orientation = 'vertical'
          then v_index else 0 end;

      v_cell_col := v_ship_col +
        case when v_orientation = 'horizontal'
          then v_index else 0 end;

      if v_cell_row = p_row and v_cell_col = p_col then
        v_hit := true;
        exit;
      end if;
    end loop;

    exit when v_hit;
  end loop;

  insert into public.game_shots (
    room_id, attacker_id, defender_id,
    row, col, is_hit
  )
  values (
    p_room_id, p_user_id, v_defender,
    p_row, p_col, v_hit
  )
  returning id into v_shot_id;

  if v_hit then
    -- Check whether every cell of the hit ship has been attacked.
    v_all_hit := true;

    for v_index in 0..v_ship_size - 1 loop
      v_cell_row := v_ship_row +
        case when v_orientation = 'vertical'
          then v_index else 0 end;

      v_cell_col := v_ship_col +
        case when v_orientation = 'horizontal'
          then v_index else 0 end;

      if not exists (
        select 1 from public.game_shots
        where room_id = p_room_id
          and attacker_id = p_user_id
          and row = v_cell_row
          and col = v_cell_col
          and is_hit = true
      ) then
        v_all_hit := false;
        exit;
      end if;
    end loop;

    if v_all_hit then
      v_sunk := v_ship_id;

      update public.game_shots
      set sunk_ship = v_sunk
      where id = v_shot_id;
    end if;

    -- Every valid fleet contains exactly 17 ship cells.
    select count(*) = 17 into v_won
    from public.game_shots
    where room_id = p_room_id
      and attacker_id = p_user_id
      and is_hit = true;
  end if;

  if v_won then
    update public.game_rooms
    set status = 'finished',
        winner_id = p_user_id,
        current_turn_id = null,
        finished_at = now(),
        updated_at = now()
    where id = p_room_id;

    v_next_turn := null;
  else
    v_next_turn := v_defender;

    update public.game_rooms
    set current_turn_id = v_next_turn,
        updated_at = now()
    where id = p_room_id;
  end if;

  return jsonb_build_object(
    'row', p_row,
    'col', p_col,
    'hit', v_hit,
    'sunkShip', v_sunk,
    'won', v_won,
    'nextTurnId', v_next_turn
  );
end;
$$;

revoke all on function public.fire_game_shot(
  uuid, uuid, integer, integer
) from public, anon, authenticated;

grant execute on function public.fire_game_shot(
  uuid, uuid, integer, integer
) to service_role;
