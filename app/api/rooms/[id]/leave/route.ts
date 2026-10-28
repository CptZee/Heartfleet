
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

type Context = {
    params: Promise<{ id: string }>;
};

export async function POST(
    _request: NextRequest,
    { params }: Context
) {
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

    const { data, error } = await db().rpc(
        "leave_game_room",
        {
            p_room_id: id,
            p_user_id: user.id,
        }
    );

    if (error) {
        return NextResponse.json(
            { error: "Unable to leave room." },
            { status: 500 }
        );
    }

    if (!data) {
        return NextResponse.json(
            { error: "Room unavailable or game already started." },
            { status: 409 }
        );
    }

    return NextResponse.json({ success: true });
}
