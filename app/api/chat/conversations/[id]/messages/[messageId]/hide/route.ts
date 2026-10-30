import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

type Context = { params: Promise<{ id: string; messageId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const respond = (data: unknown, status = 200) => NextResponse.json(data, {
  status, headers: { "Cache-Control": "private, no-store" },
});

async function act(context: Context, undo: boolean) {
  try {
    const user = await currentUser();
    if (!user) return respond({ error: "Unauthorized." }, 401);
    const { id, messageId } = await context.params;
    if (!UUID.test(id) || !UUID.test(messageId)) return respond({ error: "Invalid ID." }, 400);
    const { data, error } = await db().rpc(
      undo ? "undo_archived_chat_message_hide" : "hide_archived_chat_message",
      { p_conversation_id: id, p_message_id: messageId, p_user_id: user.id },
    );
    if (error) {
      if (/CHAT_ARCHIVE_UNAVAILABLE|CHAT_MESSAGE_UNAVAILABLE/.test(error.message))
        return respond({ error: "Archived message not found." }, 404);
      throw error;
    }
    if (undo) return data === true
      ? respond({ restored: true })
      : respond({ error: "Undo window expired or message was not hidden." }, 409);
    return respond({ hidden: true, undoUntil: data });
  } catch (error) {
    console.error("Archive message hide operation failed:", error);
    return respond({ error: "Unable to update archived message." }, 500);
  }
}

export async function POST(_request: Request, context: Context) { return act(context, false); }
export async function DELETE(_request: Request, context: Context) { return act(context, true); }
