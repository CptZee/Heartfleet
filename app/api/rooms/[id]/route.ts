
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/auth/db";

type Context = {
    params: Promise<{ id: string }>;
};

export async function GET(
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

    const { data: room, error } = await db()
        .from("game_rooms")
        .select("id,code,host_id,guest_id,status")
        .eq("id", id)
        .maybeSingle();

    if (error) {
        return NextResponse.json(
            { error: "Unable to load room." },
            { status: 500 }
        );
    }

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

    const ids = [room.host_id, room.guest_id].filter(
        (value): value is string => Boolean(value)
    );

    const { data: users, error: usersError } = await db()
        .from("users")
        .select("id,username")
        .in("id", ids);

    if (usersError) {
        return NextResponse.json(
            { error: "Unable to load captains." },
            { status: 500 }
        );
    }

    return NextResponse.json(
        {
            room: {
                id: room.id,
                code: room.code,
                status: room.status,
                isHost: room.host_id === user.id,
                host: users?.find(
                    (player) => player.id === room.host_id
                )?.username ?? "Captain",
                guest: room.guest_id
                    ? users?.find(
                        (player) => player.id === room.guest_id
                    )?.username ?? "Captain"
                    : null,
            },
        },
        {
            headers: {
                "Cache-Control": "private, no-store",
            },
        }
    );
}
