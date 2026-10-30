import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };
const reply = (value: unknown, status = 200) => NextResponse.json(value, {
  status, headers: { "Cache-Control": "private, no-store" },
});

async function authorize(id: string) {
  const user = await currentUser();
  if (!user) return { failure: reply({ error: "Unauthorized." }, 401) };
  if (!UUID.test(id)) return { failure: reply({ error: "Invalid conversation ID." }, 400) };
  const database = db();
  const { data: participant, error: participantError } = await database.from("chat_participants")
    .select("user_id").eq("conversation_id", id).eq("user_id", user.id)
    .eq("retained", true).maybeSingle();
  if (participantError) throw participantError;
  if (!participant) return { failure: reply({ error: "Conversation not found." }, 404) };
  const { data: conversation, error: conversationError } = await database.from("chat_conversations")
    .select("id,status,archived_at").eq("id", id).eq("status", "archived").maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) return { failure: reply({ error: "Archive not found." }, 404) };
  return { user, database, conversation };
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const access = await authorize(id);
    if (access.failure) return access.failure;
    const { database, user } = access;
    if (!database || !user) return reply({ error: "Unauthorized." }, 401);
    const before = request.nextUrl.searchParams.get("before");
    if (before && !UUID.test(before)) return reply({ error: "Invalid cursor." }, 400);
    let query = database.from("chat_messages")
      .select("id,sender_id,kind,body,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(51);
    if (before) {
      const { data: boundary, error: boundaryError } = await database.from("chat_messages")
        .select("id,created_at").eq("conversation_id", id).eq("id", before).maybeSingle();
      if (boundaryError) throw boundaryError;
      if (!boundary) return reply({ error: "Cursor not found." }, 400);
      query = query.or(`created_at.lt.${boundary.created_at},and(created_at.eq.${boundary.created_at},id.lt.${boundary.id})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    const page = rows.slice(0, 50);
    const nextCursor = rows.length > 50 ? page[page.length - 1]?.id ?? null : null;
    const { data: hidden, error: hiddenError } = await database.from("chat_hidden_messages")
      .select("message_id").eq("conversation_id", id).eq("user_id", user.id)
      .in("message_id", page.map(m => m.id).length ? page.map(m => m.id) : ["00000000-0000-0000-0000-000000000000"]);
    if (hiddenError) throw hiddenError;
    const hiddenIds = new Set((hidden ?? []).map(h => h.message_id));
    return reply({ messages: page.reverse().map(m => ({ ...m, body: hiddenIds.has(m.id) ? null : m.body,
      hidden: hiddenIds.has(m.id) })), hasMore: rows.length > 50,
      nextCursor });
  } catch (error) {
    console.error("Archive read failed:", error);
    return reply({ error: "Unable to load archive." }, 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const access = await authorize(id);
    if (access.failure) return access.failure;
    const { user, database } = access;
    if (!user || !database) return reply({ error: "Unauthorized." }, 401);
    const { data, error } = await database.rpc("release_chat_archive", {
      p_conversation_id: id, p_user_id: user.id,
    });
    if (error) {
      if (error.message.includes("CHAT_NOT_FOUND") || error.message.includes("CHAT_NOT_ARCHIVED"))
        return reply({ error: "Archive not found or no longer available." }, 404);
      throw error;
    }
    return reply({ removed: true, permanentlyPurged: data });
  } catch (error) {
    console.error("Archive removal failed:", error);
    return reply({ error: "Unable to remove archive." }, 500);
  }
}
