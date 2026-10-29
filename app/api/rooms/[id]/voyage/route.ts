import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

type RouteContext = {
    params: Promise<{ id: string }>;
};

type Shot = {
    attacker_id: string;
    is_hit: boolean;
    sunk_ship: string | null;
};

type HeartEvent = {
    user_id: string;
    milestone: string;
    amount: number;
};

type HeartBalance = {
    user_id: string;
    balance: number;
};

type Heartbeat = {
    id: string;
    initiator_id: string;
    chooser_id: string;
    status: string;
    question_text: string | null;
    answer_text: string | null;
    completed_at: string | null;
};

type Letter = {
    user_id: string;
    decision: "sealed" | "passed";
    letter_text: string | null;
};

export async function GET(
    _request: NextRequest,
    { params }: RouteContext
) {
    const { id } = await params;
    const user = await currentUser();

    if (!user) {
        return NextResponse.json(
            { error: "UNAUTHORIZED" },
            { status: 401 }
        );
    }

    const database = db();

    const { data: room, error: roomError } = await database
        .from("game_rooms")
        .select(
            "id, host_id, guest_id, status, winner_id, " +
            "started_at, finished_at, comeback_captain_id"
        )
        .eq("id", id)
        .single();

    if (roomError || !room) {
        return NextResponse.json(
            { error: "ROOM_NOT_FOUND" },
            { status: 404 }
        );
    }

    if (room.host_id !== user.id && room.guest_id !== user.id) {
        return NextResponse.json(
            { error: "FORBIDDEN" },
            { status: 403 }
        );
    }

    if (room.status !== "finished" || !room.guest_id) {
        return NextResponse.json(
            { error: "MATCH_NOT_FINISHED" },
            { status: 409 }
        );
    }

    const [
        shotsResult,
        heartEventsResult,
        heartsResult,
        heartbeatsResult,
        lettersResult,
        usersResult,
    ] = await Promise.all([
        database
            .from("game_shots")
            .select("attacker_id, is_hit, sunk_ship")
            .eq("room_id", id),

        database
            .from("game_heart_events")
            .select("user_id, milestone, amount")
            .eq("room_id", id),

        database
            .from("game_hearts")
            .select("user_id, balance")
            .eq("room_id", id),

        database
            .from("game_heartbeats")
            .select(
                "id, initiator_id, chooser_id, status, " +
                "question_text, answer_text, completed_at"
            )
            .eq("room_id", id)
            .in("status", ["completed", "skipped"])
            .order("completed_at", { ascending: true }),

        database
            .from("game_closing_letters")
            .select("user_id, decision, letter_text")
            .eq("room_id", id),

        database
            .from("users")
            .select("id, username")
            .in("id", [room.host_id, room.guest_id]),
    ]);

    const results = [
        shotsResult,
        heartEventsResult,
        heartsResult,
        heartbeatsResult,
        lettersResult,
        usersResult,
    ];

    if (results.some((result) => result.error)) {
        console.error(
            "Voyage query failed:",
            results
                .filter((result) => result.error)
                .map((result) => result.error?.message)
        );

        return NextResponse.json(
            { error: "COULD_NOT_LOAD_VOYAGE" },
            { status: 500 }
        );
    }

    const shots = (shotsResult.data ?? []) as Shot[];
    const heartEvents = (heartEventsResult.data ?? []) as HeartEvent[];
    const hearts = (heartsResult.data ?? []) as HeartBalance[];
    const heartbeats = (heartbeatsResult.data ?? []) as Heartbeat[];
    const letters = (lettersResult.data ?? []) as Letter[];
    const users = usersResult.data ?? [];

    const names = new Map(
        users.map((captain) => [captain.id, captain.username])
    );

    const captainIds = [room.host_id, room.guest_id];

    const captains = captainIds.map((captainId) => {
        const attacks = shots.filter(
            (shot) => shot.attacker_id === captainId
        );

        const hits = attacks.filter((shot) => shot.is_hit).length;
        const misses = attacks.length - hits;

        const earned = heartEvents
            .filter((event) => event.user_id === captainId)
            .reduce((sum, event) => sum + event.amount, 0);

        const balance =
            hearts.find((heart) => heart.user_id === captainId)
                ?.balance ?? 2;

        // Each captain starts with 2 Hearts.
        // This is derived from the current balance and rewards.
        const spent = Math.max(0, 2 + earned - balance);

        return {
            role: captainId === user.id ? "you" : "opponent",
            name: names.get(captainId) ?? "Captain",
            winner: captainId === room.winner_id,
            comebackCaptain:
                captainId === room.comeback_captain_id,
            shots: attacks.length,
            hits,
            misses,
            accuracy:
                attacks.length > 0
                    ? Math.round((hits / attacks.length) * 100)
                    : 0,
            shipsSunk: attacks.filter(
                (shot) => shot.sunk_ship !== null
            ).length,
            heartsEarned: earned,
            heartsSpent: spent,
            heartsRemaining: balance,
        };
    });

    const revealed = captainIds.every((captainId) =>
        letters.some((letter) => letter.user_id === captainId)
    );

    const memories = heartbeats.map((heartbeat) => ({
        id: heartbeat.id,
        question: heartbeat.question_text,
        answer:
            heartbeat.status === "completed"
                ? heartbeat.answer_text
                : null,
        skipped: heartbeat.status === "skipped",
        initiator:
            heartbeat.initiator_id === user.id
                ? "you"
                : "opponent",
        answeredBy:
            heartbeat.initiator_id === user.id
                ? "you"
                : "opponent",
        askedBy:
            heartbeat.chooser_id === user.id
                ? "you"
                : "opponent",
        completedAt: heartbeat.completed_at,
    }));

    const revealedLetters = revealed
        ? captainIds.map((captainId) => {
            const letter = letters.find(
                (item) => item.user_id === captainId
            )!;

            return {
                role:
                    captainId === user.id
                        ? "you"
                        : "opponent",
                name: names.get(captainId) ?? "Captain",
                decision: letter.decision,
                text: letter.letter_text,
            };
        })
        : null;

    return NextResponse.json(
        {
            finishedAt: room.finished_at,
            startedAt: room.started_at,
            captains,
            totalShots: shots.length,
            heartbeatsShared: heartbeats.length,
            memories,
            letters: {
                revealed,
                mySubmitted: letters.some(
                    (letter) => letter.user_id === user.id
                ),
                opponentSubmitted: letters.some(
                    (letter) => letter.user_id !== user.id
                ),
                entries: revealedLetters,
            },
        },
        {
            headers: {
                "Cache-Control": "private, no-store",
            },
        }
    );
}