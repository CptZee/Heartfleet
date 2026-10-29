
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { db } from "@/lib/auth/db";
import {
    isValidFleet,
    type PlacedShip,
} from "@/lib/game/fleet";

type Context = {
    params: Promise<{ id: string }>;
};

async function getAccess(id: string, userId: string) {
    const { data: room, error } = await db()
        .from("game_rooms")
        .select("id,host_id,guest_id,status")
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;

    if (
        !room ||
        (room.host_id !== userId && room.guest_id !== userId)
    ) {
        return null;
    }

    return room;
}

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

        if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return NextResponse.json(
                { error: "Invalid room ID." },
                { status: 400 }
            );
        }

        const room = await getAccess(id, user.id);

        if (!room) {
            return NextResponse.json(
                { error: "Room not found." },
                { status: 404 }
            );
        }

        const { data: fleets, error } = await db()
            .from("game_fleets")
            .select("user_id,is_ready")
            .eq("room_id", id)
            .eq("is_ready", true);

        if (error) throw error;

        const { data: ownFleet, error: ownError } = await db()
            .from("game_fleets")
            .select("ships,is_ready")
            .eq("room_id", id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (ownError) throw ownError;

        return NextResponse.json(
            {
                status: room.status,
                ownReady: ownFleet?.is_ready ?? false,
                ownShips: ownFleet?.ships ?? null,
                opponentReady:
                    fleets?.some(
                        (fleet) =>
                            fleet.user_id !== user.id && fleet.is_ready
                    ) ?? false,
            },
            {
                headers: {
                    "Cache-Control": "private, no-store",
                },
            }
        );
    } catch (error) {
        console.error("Fleet load failed", error);

        return NextResponse.json(
            { error: "Unable to load fleet." },
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

        if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return NextResponse.json(
                { error: "Invalid room ID." },
                { status: 400 }
            );
        }

        const body = await request.json();
        const ships: unknown = body?.ships;

        if (!Array.isArray(ships)) {
            return NextResponse.json(
                { error: "Invalid fleet data." },
                { status: 400 }
            );
        }

        const shipsJson = ships as Json;

        if (!isValidFleet(ships as PlacedShip[])) {
            return NextResponse.json(
                { error: "Invalid fleet arrangement." },
                { status: 400 }
            );
        }

        const room = await getAccess(id, user.id);

        if (!room) {
            return NextResponse.json(
                { error: "Room not found." },
                { status: 404 }
            );
        }

        if (room.status !== "placing") {
            return NextResponse.json(
                { error: "Fleet placement is unavailable." },
                { status: 409 }
            );
        }

        const { data: status, error } = await db().rpc(
            "submit_game_fleet",
            {
                p_room_id: id,
                p_user_id: user.id,
                p_ships: shipsJson,
            }
        );

        if (error) {
            console.error("Fleet submission rejected", error);

            return NextResponse.json(
                { error: "Unable to lock in this fleet." },
                { status: 409 }
            );
        }

        return NextResponse.json({ status, ready: true });
    } catch (error) {
        console.error("Fleet submission failed", error);

        return NextResponse.json(
            { error: "Unable to save fleet." },
            { status: 500 }
        );
    }
}
