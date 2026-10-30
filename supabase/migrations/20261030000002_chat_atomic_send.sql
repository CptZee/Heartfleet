-- Chat writes are serialized against seat changes and room deletion.
-- Only service_role can invoke this function. Authentication occurs in Next.js.
CREATE OR REPLACE FUNCTION public.send_room_chat_message(
  p_room_id uuid,
  p_user_id uuid,
  p_body text,
  p_client_nonce uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_room public.game_rooms%ROWTYPE;
  v_conversation uuid;
  v_message public.chat_messages%ROWTYPE;
  v_existing public.chat_messages%ROWTYPE;
  v_body text := btrim(p_body);
BEGIN
  IF p_user_id IS NULL OR p_room_id IS NULL OR p_client_nonce IS NULL
     OR v_body IS NULL OR char_length(v_body) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'CHAT_INVALID_INPUT';
  END IF;

  -- Membership-changing room transactions acquire this row lock too.
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR v_room.host_id IS NULL OR v_room.guest_id IS NULL
     OR p_user_id NOT IN (v_room.host_id, v_room.guest_id) THEN
    RAISE EXCEPTION 'CHAT_ROOM_UNAVAILABLE';
  END IF;

  SELECT c.id INTO v_conversation
    FROM public.chat_conversations c
   WHERE c.room_id = p_room_id AND c.status = 'active';
  IF v_conversation IS NULL OR
     (SELECT count(*) FROM public.chat_participants cp
       WHERE cp.conversation_id = v_conversation AND cp.retained
         AND cp.user_id IN (v_room.host_id, v_room.guest_id)) <> 2 OR
     (SELECT count(*) FROM public.chat_participants cp
       WHERE cp.conversation_id = v_conversation) <> 2 THEN
    RAISE EXCEPTION 'CHAT_CONVERSATION_UNAVAILABLE';
  END IF;

  -- Retrying the same nonce does not consume another rate-limit attempt.
  SELECT * INTO v_existing FROM public.chat_messages
   WHERE conversation_id = v_conversation AND sender_id = p_user_id
     AND client_nonce = p_client_nonce;
  IF FOUND THEN
    RETURN jsonb_build_object('message', jsonb_build_object(
      'id',v_existing.id,'conversation_id',v_existing.conversation_id,
      'sender_id',v_existing.sender_id,'kind',v_existing.kind,
      'body',v_existing.body,'created_at',v_existing.created_at), 'duplicate', true);
  END IF;

  IF NOT public.check_auth_rate_limit('chat-send:' || p_user_id::text, 20, 60) THEN
    RAISE EXCEPTION 'CHAT_RATE_LIMITED';
  END IF;

  INSERT INTO public.chat_messages (conversation_id, sender_id, kind, body, client_nonce)
  VALUES (v_conversation, p_user_id, 'message', v_body, p_client_nonce)
  RETURNING * INTO v_message;

  RETURN jsonb_build_object('message', jsonb_build_object(
    'id',v_message.id,'conversation_id',v_message.conversation_id,
    'sender_id',v_message.sender_id,'kind',v_message.kind,
    'body',v_message.body,'created_at',v_message.created_at), 'duplicate', false);
END;
$$;
REVOKE ALL ON FUNCTION public.send_room_chat_message(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_room_chat_message(uuid,uuid,text,uuid) TO service_role;
