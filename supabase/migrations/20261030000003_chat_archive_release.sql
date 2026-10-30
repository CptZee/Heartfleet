-- Release one participant's archived conversation retention atomically.
-- The conversation survives as long as at least one participant retains it.
CREATE OR REPLACE FUNCTION public.release_chat_archive(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_status text; v_count integer;
BEGIN
  IF p_conversation_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'CHAT_INVALID_INPUT';
  END IF;
  SELECT status INTO v_status FROM public.chat_conversations
   WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAT_NOT_FOUND'; END IF;
  IF v_status <> 'archived' THEN RAISE EXCEPTION 'CHAT_NOT_ARCHIVED'; END IF;
  UPDATE public.chat_participants SET retained = false, removed_at = now()
   WHERE conversation_id = p_conversation_id AND user_id = p_user_id AND retained = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAT_NOT_FOUND'; END IF;
  SELECT count(*) INTO v_count FROM public.chat_participants
   WHERE conversation_id = p_conversation_id AND retained = true;
  IF v_count = 0 THEN
    DELETE FROM public.chat_conversations WHERE id = p_conversation_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.release_chat_archive(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_chat_archive(uuid,uuid) TO service_role;
