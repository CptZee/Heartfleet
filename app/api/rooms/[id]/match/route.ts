
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

type Context = {
    params: Promise<{ id: string }>;
};

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
    _request: NextRequest,
    { params }: Context
) {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 }
            );
        }

        const { id } = await params;

        if (!uuidPattern.test(id)) {
            return NextResponse.json(
                { error: "Invalid room ID." },
                { status: 400 }
            );
        }

        const { data: room, error: roomError } = await db()
            .from("game_rooms")
            .select(
                "id,host_id,guest_id,status,current_turn_id,winner_id"
            )
            .eq("id", id)
            .maybeSingle();

        if (roomError) throw roomError;

        if (
            !room ||
            (room.host_id !== user.id &&
                room.guest_id !== user.id)
        ) {
            return NextResponse.json(
                { error: "Room not found." },
                { status: 404 }
            );
        }

        if (!["playing", "finished"].includes(room.status)) {
            return NextResponse.json(
                { error: "Match has not started." },
                { status: 409 }
            );
        }

        const opponentId =
            room.host_id === user.id
                ? room.guest_id
                : room.host_id;

        const [fleetResult, shotsResult, playersResult] =
            await Promise.all([
                db()
                    .from("game_fleets")
                    .select("ships")
                    .eq("room_id", id)
                    .eq("user_id", user.id)
                    .eq("is_ready", true)
                    .single(),

                db()
                    .from("game_shots")
                    .select(
                        "attacker_id,row,col,is_hit,sunk_ship,created_at,id"
                    )
                    .eq("room_id", id)
                    .order("created_at", { ascending: true })
                    .order("id", { ascending: true }),

                db()
                    .from("users")
                    .select("id,username")
                    .in("id", [user.id, opponentId!]),
            ]);

        if (
            fleetResult.error ||
            shotsResult.error ||
            playersResult.error
        ) {
            throw (
                fleetResult.error ||
                shotsResult.error ||
                playersResult.error
            );
        }

        const { data: activeHeartbeat, error: heartbeatError } = await db()
            .from("game_heartbeats")
            .select("id")
            .eq("room_id", id)
            .in("status", ["choosing", "answering"])
            .maybeSingle();

        if (heartbeatError) {
            throw heartbeatError;
        }

        const shots = shotsResult.data ?? [];

        const formatShot = (shot: (typeof shots)[number]) => ({
            row: shot.row,
            col: shot.col,
            hit: shot.is_hit,
            sunkShip: shot.sunk_ship,
        });

        const opponent = playersResult.data?.find(
            (player) => player.id === opponentId
        );

        return NextResponse.json(
            {
                status: room.status,
                yourTurn: room.current_turn_id === user.id,
                winner: room.winner_id
                    ? room.winner_id === user.id
                        ? "you"
                        : "opponent"
                    : null,
                opponentName: opponent?.username ?? "Captain",
                ownShips: fleetResult.data.ships,
                yourShots: shots
                    .filter((shot) => shot.attacker_id === user.id)
                    .map(formatShot),
                incomingShots: shots
                    .filter((shot) => shot.attacker_id === opponentId)
                    .map(formatShot),
                isHeartbeatActive: Boolean(activeHeartbeat),
            },
            {
                headers: {
                    "Cache-Control": "private, no-store",
                },
            }
        );
    } catch (error) {
        console.error("Match load failed:", error);

        return NextResponse.json(
            { error: "Unable to load match." },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: Context
) {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 }
            );
        }

        const { id } = await params;

        if (!uuidPattern.test(id)) {
            return NextResponse.json(
                { error: "Invalid room ID." },
                { status: 400 }
            );
        }

        const contentLength = request.headers.get("content-length");

        if (contentLength && Number(contentLength) > 1024) {
            return NextResponse.json(
                { error: "Request body too large." },
                { status: 413 }
            );
        }

        const rawBody = await request.text();

        if (rawBody.length > 1024) {
            return NextResponse.json(
                { error: "Request body too large." },
                { status: 413 }
            );
        }

        let body: unknown;

        try {
            body = JSON.parse(rawBody);
        } catch {
            return NextResponse.json(
                { error: "Invalid request body." },
                { status: 400 }
            );
        }

        const payload =
            body !== null &&
                typeof body === "object" &&
                !Array.isArray(body)
                ? (body as Record<string, unknown>)
                : {};

        const row = payload.row;
        const col = payload.col;

        if (
            typeof row !== "number" ||
            typeof col !== "number" ||
            !Number.isInteger(row) ||
            !Number.isInteger(col) ||
            row < 0 ||
            row >= 10 ||
            col < 0 ||
            col >= 10
        ) {
            return NextResponse.json(
                { error: "Invalid attack coordinate." },
                { status: 409 }
            );
        }

        // Membership is checked here and again atomically
        // inside fire_game_shot.
        const { data: room, error: roomError } = await db()
            .from("game_rooms")
            .select("host_id,guest_id")
            .eq("id", id)
            .maybeSingle();

        if (roomError) throw roomError;

        if (
            !room ||
            (room.host_id !== user.id &&
                room.guest_id !== user.id)
        ) {
            return NextResponse.json(
                { error: "Room not found." },
                { status: 404 }
            );
        }

        const { data, error } = await db().rpc(
            "fire_game_shot",
            {
                p_room_id: id,
                p_user_id: user.id,
                p_row: row,
                p_col: col,
            }
        );

        if (error) {
            const knownErrors: Record<string, string> = {
                "Invalid coordinate": "Invalid attack coordinate.",
                "Match is not active": "This match is no longer active.",
                "Not a participant": "You are not part of this match.",
                "Not your turn": "Please wait for your turn.",
                "Coordinate already attacked":
                    "You've already attacked this coordinate.",
                "Defender fleet unavailable":
                    "The opponent's fleet is unavailable.",
                HEARTBEAT_IN_PROGRESS:
                    "Please finish the current Heartbeat first.",
            };

            const message = knownErrors[error.message];

            if (!message) {
                console.error("Unexpected attack error:", error);

                return NextResponse.json(
                    { error: "Unable to process your attack." },
                    { status: 500 }
                );
            }

            return NextResponse.json(
                { error: message },
                { status: 409 }
            );
        }

        return NextResponse.json({ result: data });
    } catch (error) {
        console.error("Attack failed:", error);

        return NextResponse.json(
            { error: "Unable to fire shot." },
            { status: 500 }
        );
    }
}
