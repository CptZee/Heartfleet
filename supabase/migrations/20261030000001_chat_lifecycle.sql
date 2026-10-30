-- Heartfleet: automatically maintain private conversation periods when room seats change.
-- Runs in the same transaction as the room insert/update/delete, including join_game_room
-- and leave_game_room RPCs. Archives are retained independently of deleted rooms.

CREATE OR REPLACE FUNCTION public.sync_room_chat_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_conversation uuid;
  v_new_conversation uuid;
  v_host_name text;
  v_guest_name text;
BEGIN
  -- Lock and close any current period when seats change or the room is deleted.
  -- A room with only one occupant has no active two-player conversation.
  IF TG_OP = 'DELETE' THEN
    UPDATE public.chat_conversations
       SET status = 'archived', archived_at = now()
     WHERE room_id = OLD.id AND status = 'active';
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.host_id IS NOT DISTINCT FROM OLD.host_id
     AND NEW.guest_id IS NOT DISTINCT FROM OLD.guest_id THEN
    RETURN NEW;
  END IF;

  UPDATE public.chat_conversations
     SET status = 'archived', archived_at = now()
   WHERE room_id = NEW.id AND status = 'active'
   RETURNING id INTO v_old_conversation;

  IF NEW.host_id IS NULL OR NEW.guest_id IS NULL
     OR NEW.host_id = NEW.guest_id THEN
    RETURN NEW;
  END IF;

  SELECT username INTO v_host_name FROM public.users WHERE id = NEW.host_id;
  SELECT username INTO v_guest_name FROM public.users WHERE id = NEW.guest_id;
  IF v_host_name IS NULL OR v_guest_name IS NULL THEN
    RAISE EXCEPTION 'Cannot create chat for unknown participants';
  END IF;

  INSERT INTO public.chat_conversations (room_id)
  VALUES (NEW.id)
  RETURNING id INTO v_new_conversation;

  INSERT INTO public.chat_participants (conversation_id, user_id, display_name)
  VALUES
    (v_new_conversation, NEW.host_id, v_host_name),
    (v_new_conversation, NEW.guest_id, v_guest_name);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_room_chat_conversation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS room_chat_seat_changes ON public.game_rooms;
CREATE TRIGGER room_chat_seat_changes
AFTER INSERT OR UPDATE OF host_id, guest_id ON public.game_rooms
FOR EACH ROW EXECUTE FUNCTION public.sync_room_chat_conversation();

DROP TRIGGER IF EXISTS room_chat_before_delete ON public.game_rooms;
CREATE TRIGGER room_chat_before_delete
BEFORE DELETE ON public.game_rooms
FOR EACH ROW EXECUTE FUNCTION public.sync_room_chat_conversation();

-- Backfill rooms that already contain two players when this migration is applied.
-- Do not replace existing active periods; their messages must remain untouched.
DO $$
DECLARE
  v_room record;
  v_conversation uuid;
BEGIN
  FOR v_room IN
    SELECT r.id, r.host_id, r.guest_id,
           h.username AS host_name, g.username AS guest_name
      FROM public.game_rooms r
      JOIN public.users h ON h.id = r.host_id
      JOIN public.users g ON g.id = r.guest_id
     WHERE r.host_id IS NOT NULL AND r.guest_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.chat_conversations c
          WHERE c.room_id = r.id AND c.status = 'active'
       )
  LOOP
    INSERT INTO public.chat_conversations (room_id)
    VALUES (v_room.id)
    RETURNING id INTO v_conversation;
    INSERT INTO public.chat_participants (conversation_id, user_id, display_name)
    VALUES
      (v_conversation, v_room.host_id, v_room.host_name),
      (v_conversation, v_room.guest_id, v_room.guest_name);
  END LOOP;
END;
$$;
