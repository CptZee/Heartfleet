SET local check_function_bodies = off;

CREATE TABLE "public"."auth_rate_limits" (
  "key"               text                     NOT NULL,
  "attempts"          integer                  NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY (key)
);

ALTER TABLE "public"."auth_rate_limits"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."auth_rate_limits" FROM "anon", "authenticated";

CREATE TABLE "public"."game_closing_letters" (
  "room_id"      uuid                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "decision"     text                     NOT NULL,
  "letter_text"  text,
  "submitted_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "closing_letter_content_check" CHECK ((((decision = 'sealed'::text) AND (letter_text IS
    NOT NULL) AND ((char_length(btrim(letter_text)) >= 1) AND (char_length(btrim(letter_text)) <= 300))) OR ((decision = 'passed'::text) AND (letter_text IS NULL)))),
  CONSTRAINT "game_closing_letters_decision_check" CHECK ((decision = ANY (ARRAY['sealed'::text, 'passed'::text]))),
  CONSTRAINT "game_closing_letters_pkey" PRIMARY KEY (room_id, user_id)
);

ALTER TABLE "public"."game_closing_letters"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."game_closing_letters" FROM "anon", "authenticated";

CREATE TABLE "public"."game_fleets" (
  "room_id"    uuid                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "ships"      jsonb                    NOT NULL,
  "is_ready"   boolean                  NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_fleets_pkey" PRIMARY KEY (room_id, user_id)
);

ALTER TABLE "public"."game_fleets"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."game_fleets" FROM "anon", "authenticated";

CREATE TABLE "public"."game_heart_events" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "room_id"    uuid                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "milestone"  text                     NOT NULL,
  "amount"     integer                  NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_heart_events_amount_check" CHECK ((amount > 0)),
  CONSTRAINT "game_heart_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "game_heart_events_room_id_user_id_milestone_key" UNIQUE (room_id, user_id, milestone)
);

ALTER TABLE "public"."game_heart_events"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."game_heart_events" FROM "anon", "authenticated";

CREATE TABLE "public"."game_heartbeat_opportunities" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "room_id"    uuid                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "milestone"  text                     NOT NULL,
  "status"     text                     NOT NULL DEFAULT 'available'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_heartbeat_opportunities_pkey" PRIMARY KEY (id),
  CONSTRAINT "game_heartbeat_opportunities_room_id_user_id_milestone_key" UNIQUE (room_id, user_id, milestone),
  CONSTRAINT "game_heartbeat_opportunities_status_check" CHECK ((status = ANY (ARRAY['available'::text, 'used'::text])))
);

ALTER TABLE "public"."game_heartbeat_opportunities"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."game_heartbeat_opportunities" FROM "anon", "authenticated";

CREATE TABLE "public"."game_heartbeats" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "room_id"         uuid                     NOT NULL,
  "opportunity_id"  uuid                     NOT NULL,
  "initiator_id"    uuid                     NOT NULL,
  "chooser_id"      uuid                     NOT NULL,
  "status"          text                     NOT NULL DEFAULT 'choosing'::text,
  "question_source" text,
  "question_key"    text,
  "question_text"   text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "answer_text"     text,
  "completed_at"    timestamp with time zone,
  CONSTRAINT "game_heartbeats_answer_length" CHECK (((answer_text IS NULL) OR ((char_length(answer_text) >= 1) AND (char_length(answer_text) <= 1000)))),
  CONSTRAINT "game_heartbeats_opportunity_id_key" UNIQUE (opportunity_id),
  CONSTRAINT "game_heartbeats_pkey" PRIMARY KEY (id),
  CONSTRAINT "game_heartbeats_question_source_check" CHECK ((question_source = ANY (ARRAY['curated'::text, 'custom'::text]))),
  CONSTRAINT "game_heartbeats_status_check" CHECK ((status = ANY (ARRAY['choosing'::text, 'answering'::text, 'completed'::text, 'skipped'::text]))),
  CONSTRAINT "heartbeat_question_length" CHECK (((question_text IS NULL) OR ((char_length(question_text) >= 1) AND (char_length(question_text) <= 300))))
);

ALTER TABLE "public"."game_heartbeats"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."game_heartbeats" FROM "anon", "authenticated";

CREATE TABLE "public"."game_hearts" (
  "room_id"    uuid                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "balance"    integer                  NOT NULL DEFAULT 2,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_hearts_balance_check" CHECK ((balance >= 0)),
  CONSTRAINT "game_hearts_pkey" PRIMARY KEY (room_id, user_id)
);

ALTER TABLE "public"."game_hearts"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."game_hearts" FROM "anon", "authenticated";

CREATE TABLE "public"."game_rooms" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "code"                text                     NOT NULL,
  "host_id"             uuid                     NOT NULL,
  "guest_id"            uuid,
  "status"              text                     NOT NULL DEFAULT 'waiting'::text,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "current_turn_id"     uuid,
  "winner_id"           uuid,
  "started_at"          timestamp with time zone,
  "finished_at"         timestamp with time zone,
  "comeback_captain_id" uuid,
  CONSTRAINT "different_players" CHECK (((guest_id IS NULL) OR (guest_id <> host_id))),
  CONSTRAINT "game_rooms_code_key" UNIQUE (code),
  CONSTRAINT "game_rooms_pkey" PRIMARY KEY (id),
  CONSTRAINT "game_rooms_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'placing'::text, 'playing'::text, 'finished'::text])))
);

CREATE TABLE "public"."game_shots" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "room_id"     uuid                     NOT NULL,
  "attacker_id" uuid                     NOT NULL,
  "defender_id" uuid                     NOT NULL,
  "row"         integer                  NOT NULL,
  "col"         integer                  NOT NULL,
  "is_hit"      boolean                  NOT NULL,
  "sunk_ship"   text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_shots_check" CHECK ((attacker_id <> defender_id)),
  CONSTRAINT "game_shots_col_check" CHECK (((col >= 0) AND (col <= 9))),
  CONSTRAINT "game_shots_pkey" PRIMARY KEY (id),
  CONSTRAINT "game_shots_room_id_attacker_id_row_col_key" UNIQUE (room_id, attacker_id, "row", col),
  CONSTRAINT "game_shots_row_check" CHECK ((("row" >= 0) AND ("row" <= 9)))
);

ALTER TABLE "public"."game_shots"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."game_shots" FROM "anon", "authenticated";

CREATE TABLE "public"."sessions" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "token_hash" text                     NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "sessions_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "public"."sessions"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."sessions" FROM "anon", "authenticated";

CREATE TABLE "public"."users" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "username"          text                     NOT NULL,
  "password_hash"     text                     NOT NULL,
  "email"             text,
  "email_verified_at" timestamp with time zone,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "users_pkey" PRIMARY KEY (id),
  CONSTRAINT "users_username_check" CHECK ((username ~ '^[a-zA-Z0-9_]{3,20}$'::text)),
  CONSTRAINT "users_username_key" UNIQUE (username)
);

ALTER TABLE "public"."users"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."users" FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.activate_game_heartbeat (
  p_room_id        uuid,
  p_user_id        uuid,
  p_opportunity_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."activate_game_heartbeat"(uuid, uuid, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.award_game_shot_hearts()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."award_game_shot_hearts"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.award_game_sunk_hearts()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."award_game_sunk_hearts"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.award_gentle_comeback()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."award_gentle_comeback"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.check_auth_rate_limit (
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare n integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then raise exception 'Invalid limit'; end if;
  insert into public.auth_rate_limits as r (key, attempts, window_started_at)
  values (p_key, 1, now())
  on conflict (key) do update set
    attempts = case when r.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1 else r.attempts + 1 end,
    window_started_at = case when r.window_started_at <= now() - make_interval(secs => p_window_seconds) then now() else r.window_started_at end
  returning attempts into n;
  return n <= p_limit;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."check_auth_rate_limit"(text, integer, integer) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.choose_game_heartbeat_question (
  p_room_id       uuid,
  p_user_id       uuid,
  p_heartbeat_id  uuid,
  p_source        text,
  p_question_key  text,
  p_question_text text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
DECLARE
    v_room public.game_rooms%rowtype;
BEGIN
    SELECT * INTO v_room
    FROM public.game_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND
       OR p_user_id IS NULL
       OR p_user_id NOT IN (v_room.host_id, v_room.guest_id) THEN
        RAISE EXCEPTION 'ROOM_UNAVAILABLE';
    END IF;

    IF p_source IS NULL
       OR p_source NOT IN ('curated', 'custom')
       OR char_length(btrim(coalesce(p_question_text, ''))) NOT BETWEEN 1 AND 300
       OR (p_source = 'curated' AND nullif(btrim(coalesce(p_question_key, '')), '') IS NULL)
       OR (p_source = 'custom' AND p_question_key IS NOT NULL) THEN
        RAISE EXCEPTION 'INVALID_QUESTION';
    END IF;

    UPDATE public.game_heartbeats
    SET status = 'answering',
        question_source = p_source,
        question_key = p_question_key,
        question_text = btrim(p_question_text),
        updated_at = now()
    WHERE id = p_heartbeat_id
      AND room_id = p_room_id
      AND chooser_id = p_user_id
      AND status = 'choosing';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'HEARTBEAT_NOT_AVAILABLE';
    END IF;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."choose_game_heartbeat_question"(uuid, uuid, uuid, text, text, text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.fire_game_shot (
  p_room_id uuid,
  p_user_id uuid,
  p_row     integer,
  p_col     integer
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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

  -- A Heartbeat pauses combat until the question is answered or skipped.
  -- This check runs while the room row is locked, coordinating with
  -- Heartbeat RPCs that lock the same row before changing Heartbeat state.
  if exists (
    select 1
    from public.game_heartbeats
    where room_id = p_room_id
      and status in ('choosing', 'answering')
  ) then
    raise exception 'HEARTBEAT_IN_PROGRESS';
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
$function$;

REVOKE ALL ON FUNCTION "public"."fire_game_shot"(uuid, uuid, integer, integer) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.grant_game_heart_milestone (
  p_room_id               uuid,
  p_user_id               uuid,
  p_milestone             text,
  p_amount                integer,
  p_heartbeat_opportunity boolean DEFAULT false
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."grant_game_heart_milestone"(uuid, uuid, text, integer, boolean) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.initialize_game_hearts()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."initialize_game_hearts"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.join_game_room (
  p_code    text,
  p_user_id uuid
)
  RETURNS public.game_rooms
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."join_game_room"(text, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.leave_game_room (
  p_room_id uuid,
  p_user_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_room public.game_rooms;
begin
  select *
  into v_room
  from public.game_rooms
  where id = p_room_id
  for update;

  if not found then
    return false;
  end if;

  if v_room.status not in ('waiting', 'placing') then
    return false;
  end if;

  if v_room.host_id = p_user_id then
    delete from public.game_rooms
    where id = p_room_id;

    return true;
  end if;

  if v_room.guest_id = p_user_id then
    update public.game_rooms
    set
      guest_id = null,
      status = 'waiting',
      updated_at = now()
    where id = p_room_id;

    return true;
  end if;

  return false;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."leave_game_room"(uuid, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.protect_game_closing_letter()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
    raise exception 'CLOSING_LETTER_IS_FINAL';
end;
$function$;

REVOKE ALL ON FUNCTION "public"."protect_game_closing_letter"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.respond_game_heartbeat (
  p_room_id      uuid,
  p_user_id      uuid,
  p_heartbeat_id uuid,
  p_action       text,
  p_answer       text DEFAULT NULL::text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
DECLARE
    v_room public.game_rooms%rowtype;
    v_answer text;
BEGIN
    SELECT * INTO v_room
    FROM public.game_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND
       OR p_user_id IS NULL
       OR p_user_id NOT IN (v_room.host_id, v_room.guest_id) THEN
        RAISE EXCEPTION 'ROOM_UNAVAILABLE';
    END IF;

    IF p_action IS NULL OR p_action NOT IN ('answer', 'skip') THEN
        RAISE EXCEPTION 'INVALID_ACTION';
    END IF;

    v_answer := nullif(btrim(coalesce(p_answer, '')), '');

    IF p_action = 'answer'
       AND (v_answer IS NULL OR char_length(v_answer) > 1000) THEN
        RAISE EXCEPTION 'INVALID_ANSWER';
    END IF;

    UPDATE public.game_heartbeats
    SET status = CASE WHEN p_action = 'answer' THEN 'completed' ELSE 'skipped' END,
        answer_text = CASE WHEN p_action = 'answer' THEN v_answer ELSE NULL END,
        completed_at = now(),
        updated_at = now()
    WHERE id = p_heartbeat_id
      AND room_id = p_room_id
      AND initiator_id = p_user_id
      AND status = 'answering';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'HEARTBEAT_NOT_AVAILABLE';
    END IF;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."respond_game_heartbeat"(uuid, uuid, uuid, text, text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.submit_game_closing_letter (
  p_room_id     uuid,
  p_user_id     uuid,
  p_decision    text,
  p_letter_text text DEFAULT NULL::text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
DECLARE
    v_room public.game_rooms%ROWTYPE;
    v_letter text;
BEGIN
    SELECT * INTO v_room
    FROM public.game_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ROOM_NOT_FOUND';
    END IF;

    IF p_user_id IS DISTINCT FROM v_room.host_id
       AND p_user_id IS DISTINCT FROM v_room.guest_id THEN
        RAISE EXCEPTION 'NOT_A_PARTICIPANT';
    END IF;

    IF v_room.status IS DISTINCT FROM 'finished' THEN
        RAISE EXCEPTION 'MATCH_NOT_FINISHED';
    END IF;

    IF p_decision IS NULL OR p_decision NOT IN ('sealed', 'passed') THEN
        RAISE EXCEPTION 'INVALID_DECISION';
    END IF;

    v_letter := NULLIF(BTRIM(p_letter_text), '');

    IF p_decision = 'sealed' THEN
        IF v_letter IS NULL OR CHAR_LENGTH(v_letter) > 300 THEN
            RAISE EXCEPTION 'INVALID_LETTER';
        END IF;
    ELSE
        -- Passing deliberately stores no text.
        v_letter := NULL;
    END IF;

    -- Only translate duplicate submissions to LETTER_ALREADY_SUBMITTED.
    -- Other errors retain their original diagnostics.
    BEGIN
        INSERT INTO public.game_closing_letters (
            room_id, user_id, decision, letter_text
        ) VALUES (
            p_room_id, p_user_id, p_decision, v_letter
        );
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'LETTER_ALREADY_SUBMITTED';
    END;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."submit_game_closing_letter"(uuid, uuid, text, text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.submit_game_fleet (
  p_room_id uuid,
  p_user_id uuid,
  p_ships   jsonb
)
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."submit_game_fleet"(uuid, uuid, jsonb) FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."game_heartbeats"
  ADD CONSTRAINT "game_heartbeats_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES public.game_heartbeat_opportunities(id);

ALTER TABLE "public"."game_closing_letters"
  ADD CONSTRAINT "game_closing_letters_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;

ALTER TABLE "public"."game_fleets"
  ADD CONSTRAINT "game_fleets_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;

ALTER TABLE "public"."game_heart_events"
  ADD CONSTRAINT "game_heart_events_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;

ALTER TABLE "public"."game_heartbeat_opportunities"
  ADD CONSTRAINT "game_heartbeat_opportunities_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;

ALTER TABLE "public"."game_heartbeats"
  ADD CONSTRAINT "game_heartbeats_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;

ALTER TABLE "public"."game_hearts"
  ADD CONSTRAINT "game_hearts_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;

ALTER TABLE "public"."game_shots"
  ADD CONSTRAINT "game_shots_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;

ALTER TABLE "public"."game_closing_letters"
  ADD CONSTRAINT "game_closing_letters_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_fleets"
  ADD CONSTRAINT "game_fleets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."game_heart_events"
  ADD CONSTRAINT "game_heart_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_heartbeat_opportunities"
  ADD CONSTRAINT "game_heartbeat_opportunities_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_heartbeats"
  ADD CONSTRAINT "game_heartbeats_chooser_id_fkey" FOREIGN KEY (chooser_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_heartbeats"
  ADD CONSTRAINT "game_heartbeats_initiator_id_fkey" FOREIGN KEY (initiator_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_hearts"
  ADD CONSTRAINT "game_hearts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_rooms"
  ADD CONSTRAINT "game_rooms_comeback_captain_id_fkey" FOREIGN KEY (comeback_captain_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_rooms"
  ADD CONSTRAINT "game_rooms_current_turn_id_fkey" FOREIGN KEY (current_turn_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_rooms"
  ADD CONSTRAINT "game_rooms_guest_id_fkey" FOREIGN KEY (guest_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_rooms"
  ADD CONSTRAINT "game_rooms_host_id_fkey" FOREIGN KEY (host_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_rooms"
  ADD CONSTRAINT "game_rooms_winner_id_fkey" FOREIGN KEY (winner_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_shots"
  ADD CONSTRAINT "game_shots_attacker_id_fkey" FOREIGN KEY (attacker_id) REFERENCES public.users(id);

ALTER TABLE "public"."game_shots"
  ADD CONSTRAINT "game_shots_defender_id_fkey" FOREIGN KEY (defender_id) REFERENCES public.users(id);

ALTER TABLE "public"."sessions"
  ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX game_closing_letters_room_idx ON public.game_closing_letters USING btree (room_id);

CREATE INDEX game_heart_events_lookup_idx ON public.game_heart_events USING btree (room_id, user_id, created_at);

CREATE INDEX game_heartbeats_room_idx ON public.game_heartbeats USING btree (room_id, created_at DESC);

CREATE INDEX game_rooms_guest_idx ON public.game_rooms USING btree (guest_id);

CREATE INDEX game_rooms_host_idx ON public.game_rooms USING btree (host_id);

CREATE INDEX game_shots_room_idx ON public.game_shots USING btree (room_id, created_at);

CREATE UNIQUE INDEX one_active_heartbeat_per_room ON public.game_heartbeats USING btree (room_id)
  WHERE (status = ANY (ARRAY['choosing'::text, 'answering'::text]));

CREATE INDEX sessions_expires_at_idx ON public.sessions USING btree (expires_at);

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);

CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (lower(email))
  WHERE (email IS NOT NULL);

CREATE TRIGGER trg_protect_game_closing_letter
  BEFORE DELETE OR UPDATE ON public.game_closing_letters
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_game_closing_letter();

CREATE TRIGGER trg_initialize_game_hearts
  AFTER UPDATE OF status ON public.game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_game_hearts();

CREATE TRIGGER trg_award_game_shot_hearts
  AFTER INSERT ON public.game_shots
  FOR EACH ROW
  EXECUTE FUNCTION public.award_game_shot_hearts();

CREATE TRIGGER trg_award_game_sunk_hearts
  AFTER UPDATE OF sunk_ship ON public.game_shots
  FOR EACH ROW
  EXECUTE FUNCTION public.award_game_sunk_hearts();

CREATE TRIGGER trg_gentle_comeback
  AFTER INSERT ON public.game_shots
  FOR EACH ROW
  EXECUTE FUNCTION public.award_gentle_comeback();

REVOKE ALL ON FUNCTION "public"."activate_game_heartbeat"(uuid, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."activate_game_heartbeat"(uuid, uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."activate_game_heartbeat"(uuid, uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."award_game_shot_hearts"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."award_game_shot_hearts"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."award_game_shot_hearts"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."award_game_sunk_hearts"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."award_game_sunk_hearts"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."award_game_sunk_hearts"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."award_gentle_comeback"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."award_gentle_comeback"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."award_gentle_comeback"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."check_auth_rate_limit"(text, integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_auth_rate_limit"(text, integer, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."check_auth_rate_limit"(text, integer, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."choose_game_heartbeat_question"(uuid, uuid, uuid, text, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."choose_game_heartbeat_question"(uuid, uuid, uuid, text, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."choose_game_heartbeat_question"(uuid, uuid, uuid, text, text, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fire_game_shot"(uuid, uuid, integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."fire_game_shot"(uuid, uuid, integer, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fire_game_shot"(uuid, uuid, integer, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."grant_game_heart_milestone"(uuid, uuid, text, integer, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."grant_game_heart_milestone"(uuid, uuid, text, integer, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."grant_game_heart_milestone"(uuid, uuid, text, integer, boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."initialize_game_hearts"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."initialize_game_hearts"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."initialize_game_hearts"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."join_game_room"(text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."join_game_room"(text, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."join_game_room"(text, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."leave_game_room"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."leave_game_room"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."leave_game_room"(uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."protect_game_closing_letter"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."protect_game_closing_letter"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."protect_game_closing_letter"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."respond_game_heartbeat"(uuid, uuid, uuid, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."respond_game_heartbeat"(uuid, uuid, uuid, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."respond_game_heartbeat"(uuid, uuid, uuid, text, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."submit_game_closing_letter"(uuid, uuid, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_game_closing_letter"(uuid, uuid, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_game_closing_letter"(uuid, uuid, text, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."submit_game_fleet"(uuid, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_game_fleet"(uuid, uuid, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_game_fleet"(uuid, uuid, jsonb) TO "service_role";

REVOKE ALL ON TABLE "public"."auth_rate_limits" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auth_rate_limits" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auth_rate_limits" TO "service_role";

REVOKE ALL ON TABLE "public"."game_closing_letters" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_closing_letters" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_closing_letters" TO "service_role";

REVOKE ALL ON TABLE "public"."game_fleets" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_fleets" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_fleets" TO "service_role";

REVOKE ALL ON TABLE "public"."game_heart_events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_heart_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_heart_events" TO "service_role";

REVOKE ALL ON TABLE "public"."game_heartbeat_opportunities" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_heartbeat_opportunities" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_heartbeat_opportunities" TO "service_role";

REVOKE ALL ON TABLE "public"."game_heartbeats" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_heartbeats" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_heartbeats" TO "service_role";

REVOKE ALL ON TABLE "public"."game_hearts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_hearts" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_hearts" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_rooms" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."game_rooms" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_rooms" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_rooms" TO "service_role";

REVOKE ALL ON TABLE "public"."game_shots" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_shots" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_shots" TO "service_role";

REVOKE ALL ON TABLE "public"."sessions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "service_role";

REVOKE ALL ON TABLE "public"."users" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "service_role";

