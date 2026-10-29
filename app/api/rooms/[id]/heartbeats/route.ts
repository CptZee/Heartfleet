
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";
import { getHeartbeatQuestion } from "@/lib/game/heartbeat-questions";

type Context = {
    params: Promise<{ id: string }>;
};

const noStore = {
    "Cache-Control": "private, no-store",
};

function fail(message: string, status = 400) {
    return NextResponse.json(
        { error: message },
        { status, headers: noStore }
    );
}

async function getParticipant(roomId: string) {
    const user = await currentUser();
    if (!user) return null;

    const { data: room, error } = await db()
        .from("game_rooms")
        .select("host_id,guest_id,status")
        .eq("id", roomId)
        .maybeSingle();

    if (error) throw error;

    if (
        !room ||
        (room.host_id !== user.id &&
            room.guest_id !== user.id)
    ) {
        return null;
    }

    return { user, room };
}

export async function GET(
    _request: Request,
    { params }: Context
) {
    try {
        const { id } = await params;
        const participant = await getParticipant(id);

        if (!participant) return fail("Access denied.", 403);

        const { data: history, error: historyError } = await db()
            .from("game_heartbeats")
            .select(`
        id,
        initiator_id,
        chooser_id,
        status,
        question_source,
        question_text,
        answer_text,
        created_at,
        completed_at
    `)
            .eq("room_id", id)
            .in("status", ["completed", "skipped"])
            .order("completed_at", { ascending: false })
            .limit(100);

        if (historyError) throw historyError;

        const { data: heartbeat, error } = await db()
            .from("game_heartbeats")
            .select(
                `id,
         initiator_id,
         chooser_id,
         status,
         question_source,
         question_key,
         question_text,
         created_at`
            )
            .eq("room_id", id)
            .in("status", ["choosing", "answering"])
            .maybeSingle();

        if (error) throw error;

        const { data: latestResolved, error: resolvedError } = await db()
            .from("game_heartbeats")
            .select(
                `id,
         initiator_id,
         chooser_id,
         status,
         question_text,
         answer_text,
         completed_at`
            )
            .eq("room_id", id)
            .in("status", ["completed", "skipped"])
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (resolvedError) throw resolvedError;

        return NextResponse.json(
            {
                heartbeat: heartbeat
                    ? {
                        id: heartbeat.id,
                        status: heartbeat.status,
                        role:
                            heartbeat.initiator_id ===
                                participant.user.id
                                ? "initiator"
                                : "chooser",
                        questionText: heartbeat.question_text,
                        questionSource: heartbeat.question_source,
                    }
                    : null,
                latestResolved: latestResolved
                    ? {
                        id: latestResolved.id,
                        status: latestResolved.status,
                        role:
                            latestResolved.initiator_id === participant.user.id
                                ? "initiator"
                                : "chooser",
                        questionText: latestResolved.question_text,
                        answerText: latestResolved.answer_text,
                        completedAt: latestResolved.completed_at,
                    }
                    : null,
                history: (history ?? []).map((item) => ({
                    id: item.id,
                    status: item.status,
                    questionSource: item.question_source,
                    questionText: item.question_text,
                    answerText: item.answer_text,
                    createdAt: item.created_at,
                    completedAt: item.completed_at,
                    role:
                        item.initiator_id === participant.user.id
                            ? "initiator"
                            : "chooser",
                })),
            },
            { headers: noStore }
        );
    } catch (error) {
        console.error("Heartbeat GET failed:", error);
        return fail("Unable to load Heartbeat.", 500);
    }
}

export async function POST(
    request: Request,
    { params }: Context
) {
    try {
        const { id } = await params;
        const participant = await getParticipant(id);

        if (!participant) return fail("Access denied.", 403);

        const body = await request.json().catch(() => null);

        if (!body || typeof body !== "object") {
            return fail("Invalid request.");
        }

        if (body.action === "activate") {
            if (typeof body.opportunityId !== "string") {
                return fail("Select a Heartbeat opportunity.");
            }

            const { data, error } = await db().rpc(
                "activate_game_heartbeat",
                {
                    p_room_id: id,
                    p_user_id: participant.user.id,
                    p_opportunity_id: body.opportunityId,
                }
            );

            if (error) {
                console.error("Heartbeat activation:", error);
                return fail(
                    "Unable to activate Heartbeat. Check your Hearts, opportunity, and active sessions.",
                    409
                );
            }

            return NextResponse.json(
                { success: true, heartbeatId: data },
                { headers: noStore }
            );
        }

        if (body.action === "choose") {
            if (
                typeof body.heartbeatId !== "string" ||
                !["curated", "custom"].includes(body.source)
            ) {
                return fail("Invalid question selection.");
            }

            let questionKey: string | null = null;
            let questionText: string;

            if (body.source === "curated") {
                if (typeof body.questionId !== "string") {
                    return fail("Select a question.");
                }

                const question = getHeartbeatQuestion(
                    body.questionId
                );

                if (!question) {
                    return fail("Unknown curated question.");
                }

                questionKey = question.id;
                questionText = question.text;
            } else {
                if (typeof body.question !== "string") {
                    return fail("Write a question.");
                }

                questionText = body.question.trim();

                if (
                    questionText.length < 1 ||
                    questionText.length > 300
                ) {
                    return fail(
                        "Questions must be between 1 and 300 characters."
                    );
                }
            }

            if (typeof questionKey !== "string" || !questionKey.trim()) {
                return NextResponse.json(
                    { error: "A valid curated question is required." },
                    { status: 400 }
                );
            }

            const { error } = await db().rpc(
                "choose_game_heartbeat_question",
                {
                    p_room_id: id,
                    p_user_id: participant.user.id,
                    p_heartbeat_id: body.heartbeatId,
                    p_source: body.source,
                    p_question_key: questionKey,
                    p_question_text: questionText,
                }
            );

            if (error) {
                console.error("Heartbeat question:", error);
                return fail(
                    "Unable to submit question. The Heartbeat may have changed.",
                    409
                );
            }

            return NextResponse.json(
                { success: true },
                { headers: noStore }
            );
        }

        if (body.action === "answer" || body.action === "skip") {
            if (typeof body.heartbeatId !== "string") {
                return fail("Invalid Heartbeat.");
            }

            const answer =
                typeof body.answer === "string"
                    ? body.answer.trim()
                    : "";

            if (answer.length < 1 || answer.length > 1000) {
                return NextResponse.json(
                    { error: "Answer must contain 1–1000 characters." },
                    { status: 400 }
                );
            }

            const { error } = await db().rpc(
                "respond_game_heartbeat",
                {
                    p_room_id: id,
                    p_user_id: participant.user.id,
                    p_heartbeat_id: body.heartbeatId,
                    p_action: body.action,
                    p_answer: answer,
                }
            );

            if (error) {
                console.error("Heartbeat response failed:", error);

                return fail(
                    "Unable to finish this Heartbeat. It may have already been resolved.",
                    409
                );
            }

            return NextResponse.json(
                { success: true },
                { headers: noStore }
            );
        }

        return fail("Unknown Heartbeat action.");
    } catch (error) {
        console.error("Heartbeat POST failed:", error);
        return fail("Unable to process Heartbeat.", 500);
    }
}
