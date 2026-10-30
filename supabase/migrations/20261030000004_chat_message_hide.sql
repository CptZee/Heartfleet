-- Personal message hiding; only the first five seconds allow Undo.
-- All operations lock the conversation before checking participant retention.
CREATE OR REPLACE FUNCTION public.hide_archived_chat_message(
  p_conversation_id uuid, p_message_id uuid, p_user_id uuid
) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status text; v_hidden_at timestamptz;
BEGIN
  SELECT status INTO v_status FROM public.chat_conversations
    WHERE id = p_conversation_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'archived' THEN RAISE EXCEPTION 'CHAT_ARCHIVE_UNAVAILABLE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chat_participants
      WHERE conversation_id = p_conversation_id AND user_id = p_user_id AND retained) THEN
    RAISE EXCEPTION 'CHAT_ARCHIVE_UNAVAILABLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chat_messages
      WHERE id = p_message_id AND conversation_id = p_conversation_id AND kind = 'message') THEN
    RAISE EXCEPTION 'CHAT_MESSAGE_UNAVAILABLE';
  END IF;
  INSERT INTO public.chat_hidden_messages (conversation_id, message_id, user_id)
    VALUES (p_conversation_id, p_message_id, p_user_id)
    ON CONFLICT (user_id, message_id) DO NOTHING;
  SELECT hidden_at INTO v_hidden_at FROM public.chat_hidden_messages
    WHERE user_id = p_user_id AND message_id = p_message_id AND conversation_id = p_conversation_id;
  -- Repeated hide requests must not extend the deadline.
  RETURN v_hidden_at + interval '5 seconds';
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_archived_chat_message_hide(
  p_conversation_id uuid, p_message_id uuid, p_user_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.chat_conversations
    WHERE id = p_conversation_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'archived' THEN RAISE EXCEPTION 'CHAT_ARCHIVE_UNAVAILABLE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chat_participants
      WHERE conversation_id = p_conversation_id AND user_id = p_user_id AND retained) THEN
    RAISE EXCEPTION 'CHAT_ARCHIVE_UNAVAILABLE';
  END IF;
  DELETE FROM public.chat_hidden_messages
    WHERE conversation_id = p_conversation_id AND message_id = p_message_id
      AND user_id = p_user_id AND hidden_at + interval '5 seconds' > clock_timestamp();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.hide_archived_chat_message(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.undo_archived_chat_message_hide(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hide_archived_chat_message(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.undo_archived_chat_message_hide(uuid,uuid,uuid) TO service_role;
