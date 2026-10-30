import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

export async function GET(_request: NextRequest) {
  await connection();

  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const chat = db();

    const { data: membership, error } = await chat
      .from("chat_participants")
      .select("conversation_id,display_name,joined_at")
      .eq("user_id", user.id)
      .eq("retained", true);

    if (error) {
      throw error;
    }

    const ids = (membership ?? []).map(
      (p) => p.conversation_id
    );

    if (!ids.length) {
      return NextResponse.json(
        { conversations: [] },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    const {
      data: conversations,
      error: conversationsError,
    } = await chat
      .from("chat_conversations")
      .select("id,status,created_at,archived_at")
      .in("id", ids)
      .eq("status", "archived")
      .order("archived_at", { ascending: false });

    if (conversationsError) {
      throw conversationsError;
    }

    const archivedIds = (conversations ?? []).map(
      (c) => c.id
    );

    if (!archivedIds.length) {
      return NextResponse.json(
        { conversations: [] },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    const {
      data: participants,
      error: participantsError,
    } = await chat
      .from("chat_participants")
      .select("conversation_id,user_id,display_name")
      .in("conversation_id", archivedIds);

    if (participantsError) {
      throw participantsError;
    }

    return NextResponse.json(
      {
        conversations: (conversations ?? []).map((c) => ({
          id: c.id,
          status: c.status,
          createdAt: c.created_at,
          archivedAt: c.archived_at,
          otherParticipant:
            (participants ?? [])
              .filter(
                (p) =>
                  p.conversation_id === c.id &&
                  p.user_id !== user.id
              )
              .map((p) => ({
                displayName: p.display_name,
              }))[0] ?? null,
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Archive list failed:", error);

    return NextResponse.json(
      { error: "Unable to load archives." },
      { status: 500 }
    );
  }
}