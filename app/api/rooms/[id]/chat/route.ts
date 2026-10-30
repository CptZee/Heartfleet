import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

// Chat uses server-side session auth, not Supabase browser credentials.
// Conversation creation is intentionally NOT performed here: it must be
// atomic with participant registration when a pair is formed/replaced.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = {
  params: Promise<{ id: string }>;
};

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });

async function authorize(roomId: string) {
  const user = await currentUser();

  if (!user) {
    return {
      failure: json({ error: "Unauthorized." }, 401),
    };
  }

  if (!UUID.test(roomId)) {
    return {
      failure: json({ error: "Invalid room ID." }, 400),
    };
  }

  const database = db();

  const { data: room, error } = await database
    .from("game_rooms")
    .select("id,host_id,guest_id")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    return {
      failure: json({ error: "Unable to load room." }, 500),
    };
  }

  if (
    !room ||
    (room.host_id !== user.id && room.guest_id !== user.id)
  ) {
    return {
      failure: json({ error: "Room not found." }, 404),
    };
  }

  if (!room.host_id || !room.guest_id) {
    return {
      failure: json(
        { error: "Waiting for another Captain." },
        409
      ),
    };
  }

  const chat = database;

  const { data: conversation, error: conversationError } = await chat
    .from("chat_conversations")
    .select("id,status")
    .eq("room_id", roomId)
    .eq("status", "active")
    .maybeSingle();

  if (conversationError) {
    return {
      failure: json({ error: "Unable to load chat." }, 500),
    };
  }

  if (!conversation) {
    return {
      failure: json({ error: "Chat is not initialized." }, 409),
    };
  }

  const { data: participants, error: participantError } = await chat
    .from("chat_participants")
    .select("user_id,retained")
    .eq("conversation_id", conversation.id);

  if (participantError) {
    return {
      failure: json(
        { error: "Unable to verify chat access." },
        500
      ),
    };
  }

  const activeIds = new Set([room.host_id, room.guest_id]);

  if (
    participants?.length !== 2 ||
    participants.some(
      (p: { user_id: string; retained: boolean }) =>
        !p.retained || !activeIds.has(p.user_id)
    )
  ) {
    return {
      failure: json(
        { error: "Chat membership is out of date." },
        409
      ),
    };
  }

  return {
    user,
    chat,
    conversation,
  };
}

export async function GET(
  request: NextRequest,
  { params }: Context
) {
  try {
    const { id } = await params;
    const access = await authorize(id);

    if (access.failure) {
      return access.failure;
    }

    const { user, chat, conversation } = access;

    const cursor = request.nextUrl.searchParams.get("before");

    if (cursor && !UUID.test(cursor)) {
      return json({ error: "Invalid cursor." }, 400);
    }

    let query = chat
      .from("chat_messages")
      .select("id,conversation_id,sender_id,kind,body,created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(51);

    if (cursor) {
      const { data: boundary } = await chat
        .from("chat_messages")
        .select("id,created_at")
        .eq("conversation_id", conversation.id)
        .eq("id", cursor)
        .maybeSingle();

      if (!boundary) {
        return json({ error: "Cursor not found." }, 400);
      }

      query = query.or(
        `created_at.lt.${boundary.created_at},and(created_at.eq.${boundary.created_at},id.lt.${boundary.id})`
      );
    }

    const { data, error } = await query;

    if (error) {
      return json({ error: "Unable to load messages." }, 500);
    }

    const rows = data ?? [];
    const hasMore = rows.length > 50;
    const page = rows.slice(0, 50);

    const nextCursor = hasMore
      ? page[page.length - 1]?.id ?? null
      : null;

    return json({
      conversationId: conversation.id,
      messages: page.reverse(),
      nextCursor,
      hasMore,
      viewerId: user.id,
    });
  } catch (error) {
    console.error("Chat GET failed:", error);

    return json({ error: "Unable to load chat." }, 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: Context
) {
  try {
    const user = await currentUser();

    if (!user) {
      return json({ error: "Unauthorized." }, 401);
    }

    const { id } = await params;

    if (!UUID.test(id)) {
      return json({ error: "Invalid room ID." }, 400);
    }

    let input: unknown;

    try {
      input = await request.json();
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }

    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      return json({ error: "Invalid message." }, 400);
    }

    const payload = input as Record<string, unknown>;

    const body =
      typeof payload.body === "string"
        ? payload.body.trim()
        : "";

    if (
      !body ||
      Array.from(body).length > 500 ||
      body.length > 500
    ) {
      return json(
        { error: "Message must contain 1–500 characters." },
        400
      );
    }

    if (
      typeof payload.clientNonce !== "string" ||
      !UUID.test(payload.clientNonce)
    ) {
      return json(
        { error: "A valid clientNonce UUID is required." },
        400
      );
    }

    // Membership, conversation state, idempotency, and rate limiting
    // are checked together inside one database transaction locked
    // against seat changes.

    const { data, error } = await db().rpc(
      "send_room_chat_message" as never,
      {
        p_room_id: id,
        p_user_id: user.id,
        p_body: body,
        p_client_nonce: payload.clientNonce,
      } as never
    );

    if (error) {
      const reason = error.message;

      if (reason.includes("CHAT_RATE_LIMITED")) {
        return json(
          { error: "Too many messages. Try again shortly." },
          429
        );
      }

      if (reason.includes("CHAT_ROOM_UNAVAILABLE")) {
        return json({ error: "Room unavailable." }, 404);
      }

      if (reason.includes("CHAT_CONVERSATION_UNAVAILABLE")) {
        return json({ error: "Chat is not available." }, 409);
      }

      if (reason.includes("CHAT_INVALID_INPUT")) {
        return json({ error: "Invalid message." }, 400);
      }

      console.error("Chat send RPC failed:", error.message);

      return json({ error: "Unable to send message." }, 500);
    }

    const result = data as unknown as {
      message: unknown;
      duplicate: boolean;
    };

    return json(result, result.duplicate ? 200 : 201);
  } catch (error) {
    console.error("Chat POST failed:", error);

    return json({ error: "Unable to send message." }, 500);
  }
}