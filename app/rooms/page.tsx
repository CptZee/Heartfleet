"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Room = {
    id: string;
    code: string;
    status: string;
    role: "host" | "guest";
    hasOpponent: boolean;
    createdAt: string;
};

export default function MyRoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadRooms = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/rooms", {
                cache: "no-store",
            });

            if (!response.ok) {
                throw new Error("Unable to load your rooms.");
            }

            const result = await response.json();
            setRooms(result.rooms ?? []);
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Something went wrong."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRooms();
    }, [loadRooms]);

    const statusLabel = (room: Room) => {
        if (!room.hasOpponent) return "Waiting";

        switch (room.status) {
            case "waiting":
                return "Waiting";
            case "playing":
            case "active":
                return "In Progress";
            case "finished":
            case "completed":
                return "Finished";
            default:
                return room.status.replace(/_/g, " ");
        }
    };

    return (
        <main className="mx-auto w-full max-w-5xl px-6 py-10">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#b97498]">
                        Your Voyages
                    </p>

                    <h1 className="text-3xl font-black text-[#815875]">
                        My Rooms ♡
                    </h1>

                    <p className="mt-2 text-sm text-[#9b7891]">
                        Pick up where your last voyage left off.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => void loadRooms()}
                    disabled={loading}
                    className="rounded-full border border-[#e9d5e3] bg-white px-5 py-2 text-sm font-semibold text-[#815875] transition hover:bg-[#fff0f5] disabled:opacity-50"
                >
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-[#e9d5e3] bg-white p-10 text-center text-sm text-[#9b7891]">
                    Loading your voyages...
                </div>
            ) : error ? (
                <div
                    role="alert"
                    className="rounded-2xl border border-[#e9d5e3] bg-white p-8 text-center"
                >
                    <p className="mb-4 text-sm text-[#b97498]">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() => void loadRooms()}
                        className="rounded-full bg-[#b97498] px-5 py-2 text-sm font-semibold text-white"
                    >
                        Try Again
                    </button>
                </div>
            ) : rooms.length === 0 ? (
                <div className="rounded-3xl border border-[#e9d5e3] bg-[#fff7fa] px-6 py-14 text-center">
                    <div className="mb-4 text-4xl text-[#e99eb8]">
                        ♡
                    </div>

                    <h2 className="text-xl font-bold text-[#815875]">
                        No voyages yet
                    </h2>

                    <p className="mx-auto mt-2 max-w-sm text-sm text-[#9b7891]">
                        Your rooms will appear here once you create
                        or join a voyage.
                    </p>

                    <Link
                        href="/"
                        className="mt-6 inline-flex rounded-full bg-[#b97498] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a96388]"
                    >
                        Start a Voyage
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {rooms.map((room) => (
                        <article
                            key={room.id}
                            className="rounded-3xl border border-[#e9d5e3] bg-white p-6 shadow-sm transition hover:shadow-md"
                        >
                            <div className="mb-5 flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-[#b97498]">
                                        {room.role === "host"
                                            ? "Your Room"
                                            : "Joined Room"}
                                    </p>

                                    <h2 className="mt-2 break-all font-mono text-xl font-bold text-[#815875]">
                                        {room.code}
                                    </h2>
                                </div>

                                <span className="rounded-full bg-[#fff0f5] px-3 py-1 text-xs font-semibold text-[#b97498]">
                                    {statusLabel(room)}
                                </span>
                            </div>

                            <div className="mb-6 space-y-2 text-sm text-[#9b7891]">
                                <p>
                                    Role:{" "}
                                    <span className="font-medium text-[#815875]">
                                        {room.role === "host"
                                            ? "Host"
                                            : "Guest"}
                                    </span>
                                </p>

                                <p>
                                    Opponent:{" "}
                                    <span className="font-medium text-[#815875]">
                                        {room.hasOpponent
                                            ? "Joined"
                                            : "Waiting"}
                                    </span>
                                </p>
                            </div>

                            <Link
                                href={`/room/${room.id}`}
                                className="flex w-full items-center justify-center rounded-full bg-[#b97498] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#a96388]"
                            >
                                Resume Voyage
                            </Link>
                        </article>
                    ))}
                </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-sm">
                <Link
                    href="/lobby"
                    className="font-medium text-[#b97498] hover:underline"
                >
                    Create or Join Room
                </Link>

                <Link
                    href="/conversations"
                    className="font-medium text-[#b97498] hover:underline"
                >
                    View Chat Archives
                </Link>
            </div>
        </main>
    );
}