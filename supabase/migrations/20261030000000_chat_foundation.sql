-- Heartfleet chat foundation. Apply after 20261029102450_remote_schema.sql.
-- Service-role server endpoints enforce authenticated user authorization.
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.game_rooms(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK ((status = 'active' AND archived_at IS NULL) OR (status = 'archived' AND archived_at IS NOT NULL))
);
CREATE UNIQUE INDEX chat_one_active_conversation_per_room
  ON public.chat_conversations(room_id) WHERE status = 'active' AND room_id IS NOT NULL;

CREATE TABLE public.chat_participants (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  display_name text NOT NULL,
  retained boolean NOT NULL DEFAULT true,
  removed_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id),
  CHECK ((retained AND removed_at IS NULL) OR (NOT retained AND removed_at IS NOT NULL))
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'message' CHECK (kind IN ('message','system')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  client_nonce uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'message' AND sender_id IS NOT NULL) OR kind = 'system')
);
CREATE INDEX chat_messages_history_idx ON public.chat_messages(conversation_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX chat_message_dedupe_idx ON public.chat_messages(conversation_id, sender_id, client_nonce)
  WHERE client_nonce IS NOT NULL;

CREATE TABLE public.chat_hidden_messages (
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id),
  FOREIGN KEY (conversation_id, user_id) REFERENCES public.chat_participants(conversation_id, user_id) ON DELETE CASCADE
);
CREATE INDEX chat_hidden_by_conversation_idx ON public.chat_hidden_messages(conversation_id, user_id);

-- No direct browser access: the application uses its own session authentication.
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_hidden_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_conversations, public.chat_participants, public.chat_messages, public.chat_hidden_messages FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations, public.chat_participants, public.chat_messages, public.chat_hidden_messages TO service_role;

-- Message insertion, archiving, retention release, and Undo deadlines must be
-- implemented as server-authorized transactional operations in the next phase.
