
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

type Context = {
    params: Promise<{ id: string }>;
};

export async function GET(
    _request: Request,
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

        const { data: room, error: roomError } = await db()
            .from("game_rooms")
            .select("host_id,guest_id,status")
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

        const [heartsResult, eventsResult, opportunitiesResult] =
            await Promise.all([
                db()
                    .from("game_hearts")
                    .select("balance")
                    .eq("room_id", id)
                    .eq("user_id", user.id)
                    .maybeSingle(),

                db()
                    .from("game_heart_events")
                    .select("id,milestone,amount,created_at")
                    .eq("room_id", id)
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: true })
                    .order("id", { ascending: true }),

                db()
                    .from("game_heartbeat_opportunities")
                    .select("id,milestone,status")
                    .eq("room_id", id)
                    .eq("user_id", user.id)
                    .eq("status", "available"),
            ]);

        if (
            heartsResult.error ||
            eventsResult.error ||
            opportunitiesResult.error
        ) {
            throw (
                heartsResult.error ||
                eventsResult.error ||
                opportunitiesResult.error
            );
        }

        return NextResponse.json(
            {
                balance: heartsResult.data?.balance ?? 2,
                heartbeatCost: 3,
                canAffordHeartbeat:
                    (heartsResult.data?.balance ?? 2) >= 3,
                availableOpportunities:
                    opportunitiesResult.data ?? [],
                events: eventsResult.data ?? [],
            },
            {
                headers: {
                    "Cache-Control": "private, no-store",
                },
            }
        );
    } catch (error) {
        return NextResponse.json(
            { error: "Unable to load Hearts." },
            { status: 500 }
        );
    }
}
