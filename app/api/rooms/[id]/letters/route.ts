import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

type RouteContext = {
    params: Promise<{ id: string }>;
};

type Decision = "sealed" | "passed";

type LetterRow = {
    user_id: string;
    decision: Decision;
    letter_text: string | null;
    submitted_at: string;
};

async function getRoomAccess(roomId: string) {
    const user = await currentUser();

    if (!user) {
        return { error: "UNAUTHORIZED", status: 401 } as const;
    }

    const database = db();

    const { data: room, error } = await database
        .from("game_rooms")
        .select("id, host_id, guest_id, status")
        .eq("id", roomId)
        .single();

    if (error || !room) {
        return { error: "ROOM_NOT_FOUND", status: 404 } as const;
    }

    if (room.host_id !== user.id && room.guest_id !== user.id) {
        return { error: "FORBIDDEN", status: 403 } as const;
    }

    return { user, room, database };
}

export async function GET(
    _request: NextRequest,
    { params }: RouteContext
) {
    const { id } = await params;
    const access = await getRoomAccess(id);

    if ("error" in access) {
        return NextResponse.json(
            { error: access.error },
            { status: access.status }
        );
    }

    const { user, room, database } = access;

    if (room.status !== "finished") {
        return NextResponse.json(
            { error: "MATCH_NOT_FINISHED" },
            { status: 409 }
        );
    }

    const { data, error } = await database
        .from("game_closing_letters")
        .select("user_id, decision, letter_text, submitted_at")
        .eq("room_id", id);

    if (error) {
        console.error("Closing letters query failed:", error.message);

        return NextResponse.json(
            { error: "COULD_NOT_LOAD_LETTERS" },
            { status: 500 }
        );
    }

    const letters = (data ?? []) as LetterRow[];

    const mine = letters.find(
        (letter) => letter.user_id === user.id
    );

    const opponentId =
        room.host_id === user.id
            ? room.guest_id
            : room.host_id;

    const theirs = letters.find(
        (letter) => letter.user_id === opponentId
    );

    const revealed = Boolean(mine && theirs);

    return NextResponse.json(
        {
            revealed,
            myDecision: mine?.decision ?? null,
            opponentSubmitted: Boolean(theirs),

            // Never send the letter contents before
            // both decisions have been finalized.
            letters: revealed
                ? [
                    {
                        role: "you",
                        decision: mine!.decision,
                        text: mine!.letter_text,
                        submittedAt: mine!.submitted_at,
                    },
                    {
                        role: "opponent",
                        decision: theirs!.decision,
                        text: theirs!.letter_text,
                        submittedAt: theirs!.submitted_at,
                    },
                ]
                : null,
        },
        {
            headers: {
                "Cache-Control": "private, no-store",
            },
        }
    );
}

export async function POST(
    request: NextRequest,
    { params }: RouteContext
) {
    const { id } = await params;
    const access = await getRoomAccess(id);

    if ("error" in access) {
        return NextResponse.json(
            { error: access.error },
            { status: access.status }
        );
    }

    if (access.room.status !== "finished") {
        return NextResponse.json(
            { error: "MATCH_NOT_FINISHED" },
            { status: 409 }
        );
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "INVALID_JSON" },
            { status: 400 }
        );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json(
            { error: "INVALID_REQUEST" },
            { status: 400 }
        );
    }

    const input = body as Record<string, unknown>;
    const decision = input.decision;

    if (decision !== "sealed" && decision !== "passed") {
        return NextResponse.json(
            { error: "INVALID_DECISION" },
            { status: 400 }
        );
    }

    const letterText =
        decision === "sealed" && typeof input.letterText === "string"
            ? input.letterText.trim()
            : undefined;

    if (
        decision === "sealed" &&
        (!letterText || letterText.length > 300)
    ) {
        return NextResponse.json(
            { error: "INVALID_LETTER" },
            { status: 400 }
        );
    }

    const { error } = await access.database.rpc(
        "submit_game_closing_letter",
        {
            p_room_id: id,
            p_user_id: access.user.id,
            p_decision: decision,
            p_letter_text: letterText,
        }
    );

    if (error) {
        const message = error.message;

        if (message.includes("LETTER_ALREADY_SUBMITTED")) {
            return NextResponse.json(
                { error: "LETTER_ALREADY_SUBMITTED" },
                { status: 409 }
            );
        }

        if (message.includes("MATCH_NOT_FINISHED")) {
            return NextResponse.json(
                { error: "MATCH_NOT_FINISHED" },
                { status: 409 }
            );
        }

        if (
            message.includes("INVALID_LETTER") ||
            message.includes("INVALID_DECISION")
        ) {
            return NextResponse.json(
                { error: "INVALID_LETTER" },
                { status: 400 }
            );
        }

        console.error("Closing letter submission failed:", message);

        return NextResponse.json(
            { error: "COULD_NOT_SUBMIT_LETTER" },
            { status: 500 }
        );
    }

    return NextResponse.json(
        { success: true },
        { headers: { "Cache-Control": "private, no-store" } }
    );
}