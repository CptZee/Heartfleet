import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

export async function POST() {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json(
                { error: "Please log in first." },
                { status: 401 }
            );
        }

        for (let attempt = 0; attempt < 5; attempt++) {
            const code = randomBytes(6)
                .toString("hex")
                .toUpperCase();

            const { data, error } = await db()
                .from("game_rooms")
                .insert({
                    code,
                    host_id: user.id,
                    status: "waiting",
                })
                .select("id,code,status")
                .single();

            if (!error) {
                return NextResponse.json(
                    { room: data },
                    { status: 201 }
                );
            }

            // Retry only if the generated invite code collides.
            if (error.code !== "23505") {
                throw error;
            }
        }

        return NextResponse.json(
            { error: "Unable to generate a room code." },
            { status: 500 }
        );
    } catch (error) {
        console.error("Room creation failed", error);

        return NextResponse.json(
            { error: "Unable to create room." },
            { status: 500 }
        );
    }
}

export async function GET(_request: NextRequest) {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 }
            );
        }

        const { data: rooms, error } = await db()
            .from("game_rooms")
            .select("id,code,status,host_id,guest_id,created_at")
            .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        return NextResponse.json(
            {
                rooms: (rooms ?? []).map((room) => ({
                    id: room.id,
                    code: room.code,
                    status: room.status,
                    role: room.host_id === user.id ? "host" : "guest",
                    hasOpponent: Boolean(room.host_id && room.guest_id),
                    createdAt: room.created_at,
                })),
            },
            {
                headers: {
                    "Cache-Control": "private, no-store",
                },
            }
        );
    } catch (error) {
        console.error("Room list failed:", error);

        return NextResponse.json(
            { error: "Unable to load rooms." },
            { status: 500 }
        );
    }
}
