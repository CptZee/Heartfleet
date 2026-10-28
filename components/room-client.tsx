
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Room = {
    id: string;
    code: string;
    status: "waiting" | "placing" | "playing" | "finished";
    isHost: boolean;
    host: string;
    guest: string | null;
};

export default function RoomClient({
    roomId,
}: {
    roomId: string;
}) {
    const router = useRouter();
    const [room, setRoom] = useState<Room | null>(null);
    const [loading, setLoading] = useState(true);
    const [leaving, setLeaving] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    const loadRoom = useCallback(async () => {
        try {
            const response = await fetch(`/api/rooms/${roomId}`, {
                cache: "no-store",
            });

            if (response.status === 401) {
                router.replace("/login");
                return;
            }

            if (response.status === 404) {
                setError("This room is closed or unavailable.");
                setRoom(null);
                return;
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Unable to load room.");
            }

            setRoom(result.room);
            setError("");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to connect to the room."
            );
        } finally {
            setLoading(false);
        }
    }, [roomId, router]);

    useEffect(() => {
        void loadRoom();

        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void loadRoom();
            }
        }, 3000);

        const onVisible = () => {
            if (document.visibilityState === "visible") {
                void loadRoom();
            }
        };

        document.addEventListener("visibilitychange", onVisible);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener(
                "visibilitychange",
                onVisible
            );
        };
    }, [loadRoom]);

    async function copyInvite() {
        if (!room) return;

        const link = `${window.location.origin}/lobby?code=${room.code}`;

        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
        } catch {
            setError("Unable to copy. Please copy the room code.");
        }
    }

    async function leaveRoom() {
        if (leaving) return;

        setLeaving(true);
        setError("");

        try {
            const response = await fetch(
                `/api/rooms/${roomId}/leave`,
                { method: "POST" }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Unable to leave room.");
            }

            router.replace("/lobby");
            router.refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to leave room."
            );
            setLeaving(false);
        }
    }

    if (loading) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center">
                <p className="animate-pulse text-[#927e96]">
                    Preparing your room...
                </p>
            </main>
        );
    }

    if (!room) {
        return (
            <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-5 text-center">
                <div className="text-5xl text-[#d58cab]">♡</div>
                <h1 className="text-2xl font-bold text-[#765773]">
                    Voyage unavailable
                </h1>
                <p className="text-[#817187]">
                    {error || "We couldn't find this room."}
                </p>
                <Link
                    href="/lobby"
                    className="rounded-full bg-[#b97498] px-7 py-3 font-bold text-white"
                >
                    Return to lobby
                </Link>
            </main>
        );
    }

    const ready = Boolean(room.guest);
    const playing = room.status === "playing";
    const finished = room.status === "finished";

    return (
        <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col justify-center px-5 py-10 text-[#51475d] sm:px-8 lg:py-14">
            <div className="mb-8 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b7789c]">
                    Heartfleet · Private voyage
                </p>

                <h1 className="mt-3 text-3xl font-bold text-[#765773] sm:text-5xl">
                    {finished
                        ? "A voyage to remember ♡"
                        : playing
                            ? "The battle is underway!"
                            : ready
                                ? "Both captains aboard ♡"
                                : "Waiting for someone special"}
                </h1>

                <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[#817187]">
                    {finished
                        ? "This match has reached its ending."
                        : playing
                            ? "Your fleets are ready for battle."
                            : ready
                                ? "Your opponent has arrived. It's time to prepare your fleets."
                                : "Every great adventure begins with an invitation."}
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                {/* Captains */}
                <section className="rounded-[2rem] border border-[#f0e0ed] bg-white/90 p-6 shadow-xl shadow-[#d6b8d0]/15 sm:p-9">
                    <div className="mb-7 flex items-center justify-between gap-3">
                        <h2 className="text-xl font-bold text-[#765773]">
                            Your captains
                        </h2>

                        <span className="rounded-full bg-[#f3eafa] px-3 py-1 text-xs font-bold text-[#a26085]">
                            {ready ? "2 / 2 aboard" : "1 / 2 aboard"}
                        </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <CaptainCard
                            name={room.host}
                            role="Room creator"
                            present
                            accent="pink"
                        />

                        <CaptainCard
                            name={room.guest || "Waiting for captain"}
                            role="Invited captain"
                            present={ready}
                            accent="blue"
                        />
                    </div>

                    <div className="mt-7 rounded-2xl bg-[#f3f6fc] p-5 text-center">
                        <div className="text-3xl text-[#a9a5cf]">
                            {ready ? "♡" : "⚓"}
                        </div>

                        <p className="mt-3 font-bold text-[#765773]">
                            {playing
                                ? "Battle in progress"
                                : finished
                                    ? "Match complete"
                                    : ready
                                        ? "Your fleet awaits!"
                                        : "One more captain needed"}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-[#817187]">
                            {ready
                                ? "Both players are connected to this room."
                                : "Share your invite code to bring your opponent aboard."}
                        </p>
                    </div>
                </section>

                {/* Invitation */}
                <section className="rounded-[2rem] border border-[#f0e0ed] bg-white/90 p-6 shadow-xl shadow-[#d6b8d0]/15 sm:p-9">
                    <h2 className="text-xl font-bold text-[#765773]">
                        Your invitation ♡
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-[#817187]">
                        {ready
                            ? "Your private room is now full."
                            : "Send this code to the person you'd like to play with."}
                    </p>

                    <div className="mt-7 rounded-2xl border border-dashed border-[#dcb7d0] bg-[#fff7fa] px-4 py-6 text-center">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#b7789c]">
                            Room code
                        </p>

                        <p className="mt-3 break-all font-mono text-2xl font-black tracking-[0.12em] text-[#765773] sm:text-3xl">
                            {room.code}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={copyInvite}
                        className="mt-5 w-full cursor-pointer rounded-full bg-[#b97498] px-6 py-3.5 font-bold text-white transition hover:bg-[#a45e83]"
                    >
                        {copied ? "Invitation copied ✓" : "Copy invite link ♡"}
                    </button>

                    <p className="mt-5 text-center text-xs leading-6 text-[#927e96]">
                        Only two registered captains can join this voyage.
                    </p>
                </section>
            </div>

            {/* Next step */}
            <div className="mt-7 rounded-[2rem] border border-[#f0e0ed] bg-gradient-to-r from-[#f9e9f1] to-[#e6f4f8] p-6 text-center sm:p-8">
                <h2 className="text-xl font-bold text-[#765773]">
                    {ready
                        ? "Ready to arrange your ships?"
                        : "Your adventure is almost ready"}
                </h2>

                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#817187]">
                    {ready
                        ? "The next phase is placing your five ships on a 10 × 10 board."
                        : "Once your opponent joins, you'll both be able to prepare your fleets."}
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {ready && !finished ? (
                        <Link
                            href={`/room/${roomId}/placement`}
                            className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#b97498] px-7 py-3 font-bold text-white transition hover:bg-[#a45e83]"
                        >
                            {playing ? "View your fleet →" : "Prepare your fleet →"}
                        </Link>
                    ) : (
                        <Link
                            href={
                                playing
                                    ? `/room/${roomId}/match`
                                    : `/room/${roomId}/placement`
                            }
                            className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#b97498] px-7 py-3 font-bold text-white transition hover:bg-[#a45e83]"
                        >
                            {playing ? "Enter the battlefield →" : "Prepare your fleet →"}
                        </Link>
                    )}

                    <button
                        type="button"
                        onClick={leaveRoom}
                        disabled={leaving || playing || finished}
                        className="cursor-pointer rounded-full border border-[#dcb7d0] bg-white px-7 py-3 font-bold text-[#a26085] transition hover:bg-[#fff7fa] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {leaving ? "Leaving..." : "Leave room"}
                    </button>
                </div>

                {error && (
                    <p role="alert" className="mt-4 text-sm text-rose-700">
                        {error}
                    </p>
                )}
            </div>
        </main>
    );
}

function CaptainCard({
    name,
    role,
    present,
    accent,
}: {
    name: string;
    role: string;
    present: boolean;
    accent: "pink" | "blue";
}) {
    return (
        <div
            className={`rounded-2xl border p-5 text-center ${accent === "pink"
                ? "border-[#f0dce8] bg-[#fff7fa]"
                : "border-[#dcecf3] bg-[#f3f9fc]"
                }`}
        >
            <div
                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold ${accent === "pink"
                    ? "bg-[#f3d8e5] text-[#a26085]"
                    : "bg-[#dcecf3] text-[#7b8fb6]"
                    }`}
            >
                {present ? name.charAt(0).toUpperCase() : "?"}
            </div>

            <p className="mt-4 truncate font-bold text-[#765773]">
                {name}
            </p>

            <p className="mt-1 text-xs text-[#927e96]">
                {role}
            </p>

            <p
                className={`mt-3 text-xs font-bold ${present ? "text-[#739a86]" : "text-[#b7789c]"
                    }`}
            >
                {present ? "✓ Aboard" : "Waiting..."}
            </p>
        </div>
    );
}
