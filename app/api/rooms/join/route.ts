
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

export async function POST(request: NextRequest) {
    try {
        const user = await currentUser();

        if (!user) {
            return NextResponse.json(
                { error: "Please log in first." },
                { status: 401 }
            );
        }

        const body = await request.json();
        const code =
            typeof body.code === "string"
                ? body.code.trim().toUpperCase()
                : "";

        if (!/^[A-F0-9]{12}$/.test(code)) {
            return NextResponse.json(
                { error: "Invalid invite code." },
                { status: 400 }
            );
        }

        const { data, error } = await db().rpc(
            "join_game_room",
            {
                p_code: code,
                p_user_id: user.id,
            }
        );

        if (error || !data) {
            return NextResponse.json(
                {
                    error:
                        "Room not found, already full, or unavailable.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json({
            room: {
                id: data.id,
                code: data.code,
                status: data.status,
            },
        });
    } catch (error) {
        console.error("Room join failed", error);

        return NextResponse.json(
            { error: "Unable to join room." },
            { status: 500 }
        );
    }
}
