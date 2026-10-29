"use client";

import { useCallback, useEffect, useState } from "react";
import VoyageKeepsake from "@/components/voyage-keepsake";

type Captain = {
    role: "you" | "opponent";
    name: string;
    winner: boolean;
    comebackCaptain: boolean;
    shots: number;
    hits: number;
    misses: number;
    accuracy: number;
    shipsSunk: number;
    heartsEarned: number;
    heartsSpent: number;
    heartsRemaining: number;
};

type Memory = {
    id: string;
    question: string | null;
    answer: string | null;
    skipped: boolean;
    initiator: "you" | "opponent";
    answeredBy: "you" | "opponent";
    askedBy: "you" | "opponent";
    completedAt: string | null;
};

type Letter = {
    role: "you" | "opponent";
    name: string;
    decision: "sealed" | "passed";
    text: string | null;
};

type VoyageData = {
    startedAt: string | null;
    finishedAt: string | null;
    captains: Captain[];
    totalShots: number;
    heartbeatsShared: number;
    memories: Memory[];
    letters: {
        revealed: boolean;
        mySubmitted: boolean;
        opponentSubmitted: boolean;
        entries: Letter[] | null;
    };
};

type VoyageSummaryProps = {
    roomId: string;
    onHeartbeats: () => void;
    onLetters: () => void;
};

function formatDate(date: string | null) {
    if (!date) return "A lovely day";

    return new Date(date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

export default function VoyageSummary({
    roomId,
    onHeartbeats,
    onLetters,
}: VoyageSummaryProps) {
    const [data, setData] = useState<VoyageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/rooms/${roomId}/voyage`,
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error("Unable to load our voyage.");
            }

            const result = (await response.json()) as VoyageData;

            setData(result);
            setError(null);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong."
            );
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        void load();

        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void load();
            }
        }, 3000);

        const refresh = () => {
            if (document.visibilityState === "visible") {
                void load();
            }
        };

        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener("focus", refresh);
            document.removeEventListener(
                "visibilitychange",
                refresh
            );
        };
    }, [load]);

    const winner = data?.captains.find(
        (captain) => captain.winner
    );

    return (
        <section className="mx-auto w-full max-w-4xl space-y-6 rounded-[2rem] border border-[#f0d4e3] bg-gradient-to-br from-[#fff0f6] via-white to-[#f5efff] p-5 shadow-xl sm:p-8">
            <header className="text-center">
                <div className="mb-3 text-5xl text-[#d77ca5]">
                    ♡
                </div>

                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b7789c]">
                    Heartfleet · Voyage Complete
                </p>

                <h2 className="mt-3 text-3xl font-black text-[#765773] sm:text-4xl">
                    Our Little Voyage ♡
                </h2>

                <p className="mt-3 text-sm text-[#927e96]">
                    The battle may be over, but the memories stay.
                </p>

                {data && (
                    <p className="mt-2 text-xs text-[#a18ba5]">
                        {formatDate(data.finishedAt)}
                    </p>
                )}
            </header>

            {loading && !data && (
                <p
                    role="status"
                    className="py-10 text-center text-sm text-[#927e96]"
                >
                    Gathering our little memories...
                </p>
            )}

            {error && (
                <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
                >
                    {error}

                    <button
                        type="button"
                        onClick={() => void load()}
                        className="ml-3 font-bold underline"
                    >
                        Retry
                    </button>
                </div>
            )}

            {data && (
                <>
                    <div className="rounded-2xl border border-[#ead4eb] bg-white/80 p-5 text-center">
                        <p className="text-xs font-black uppercase tracking-wider text-[#b7789c]">
                            Victorious Captain
                        </p>

                        <h3 className="mt-2 text-2xl font-black text-[#765773]">
                            {winner?.name ?? "Our Captain"} ♡
                        </h3>

                        <p className="mt-2 text-sm text-[#927e96]">
                            Two captains. One little adventure.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {data.captains.map((captain) => (
                            <article
                                key={captain.role}
                                className="rounded-2xl border border-[#ead4eb] bg-white/80 p-5"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-[#b7789c]">
                                            {captain.role === "you"
                                                ? "Your Voyage"
                                                : "Your Opponent"}
                                        </p>

                                        <h3 className="mt-1 text-xl font-black text-[#765773]">
                                            {captain.name}
                                        </h3>
                                    </div>

                                    {captain.winner && (
                                        <span className="rounded-full bg-[#fff0f6] px-3 py-1 text-xs font-bold text-[#b7789c]">
                                            Winner ♡
                                        </span>
                                    )}
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-3">
                                    {[
                                        ["Shots", captain.shots],
                                        ["Hits", captain.hits],
                                        ["Misses", captain.misses],
                                        ["Accuracy", `${captain.accuracy}%`],
                                        ["Ships Sunk", captain.shipsSunk],
                                        ["Hearts Earned", captain.heartsEarned],
                                        ["Hearts Spent", captain.heartsSpent],
                                        ["Hearts Left", captain.heartsRemaining],
                                    ].map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="rounded-xl bg-[#fff6fa] p-3"
                                        >
                                            <p className="text-xs text-[#a18ba5]">
                                                {label}
                                            </p>

                                            <p className="mt-1 text-lg font-black text-[#765773]">
                                                {value}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {captain.comebackCaptain && (
                                    <div className="mt-4 rounded-xl border border-[#f0d4e3] bg-[#fff0f6] p-3">
                                        <p className="text-sm font-black text-[#b7789c]">
                                            Gentle Comeback ♡
                                        </p>

                                        <p className="mt-1 text-xs leading-relaxed text-[#927e96]">
                                            Even when the tides were
                                            against this captain, a
                                            little encouragement
                                            carried the journey onward.
                                        </p>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-[#ead4eb] bg-white/75 p-5 text-center">
                            <p className="text-3xl font-black text-[#765773]">
                                {data.totalShots}
                            </p>

                            <p className="mt-1 text-xs text-[#927e96]">
                                Total Shots Fired
                            </p>
                        </div>

                        <div className="rounded-2xl border border-[#ead4eb] bg-white/75 p-5 text-center">
                            <p className="text-3xl font-black text-[#765773]">
                                {data.heartbeatsShared}
                            </p>

                            <p className="mt-1 text-xs text-[#927e96]">
                                Heartbeat Moments
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#ead4eb] bg-white/80 p-5 sm:p-6">
                        <h3 className="text-xl font-black text-[#765773]">
                            Our Heartbeat Memories ♡
                        </h3>

                        <p className="mt-2 text-sm text-[#927e96]">
                            The little questions and answers we
                            shared along the way.
                        </p>

                        {data.memories.length === 0 ? (
                            <p className="mt-5 rounded-xl bg-[#fff6fa] p-4 text-sm text-[#927e96]">
                                No Heartbeat memories just yet.
                                There's still time to make some.
                            </p>
                        ) : (
                            <div className="mt-5 space-y-3">
                                {data.memories.map((memory, index) => (
                                    <article
                                        key={memory.id}
                                        className="rounded-xl border border-[#f0d4e3] bg-[#fff9fc] p-4"
                                    >
                                        <p className="text-xs font-black uppercase tracking-wider text-[#b7789c]">
                                            Heartbeat #{index + 1}
                                        </p>

                                        <p className="mt-3 text-sm font-bold leading-relaxed text-[#765773]">
                                            {memory.question}
                                        </p>

                                        <p className="mt-3 whitespace-pre-wrap break-words text-sm italic leading-relaxed text-[#927e96]">
                                            {memory.skipped
                                                ? "This little question was gently passed."
                                                : memory.answer}
                                        </p>

                                        {memory.completedAt && (
                                            <p className="mt-3 text-xs text-[#a18ba5]">
                                                {formatDate(
                                                    memory.completedAt
                                                )}
                                            </p>
                                        )}
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-[#ead4eb] bg-white/80 p-5 sm:p-6">
                        <h3 className="text-xl font-black text-[#765773]">
                            Our Last Little Letters ♡
                        </h3>

                        {data.letters.revealed ? (
                            <div className="mt-5 space-y-3">
                                {data.letters.entries?.map((letter) => (
                                    <article
                                        key={letter.role}
                                        className="rounded-xl bg-[#fff6fa] p-4"
                                    >
                                        <p className="text-xs font-black uppercase tracking-wider text-[#b7789c]">
                                            From {letter.name}
                                        </p>

                                        <p className="mt-3 whitespace-pre-wrap break-words text-sm italic leading-relaxed text-[#765773]">
                                            {letter.decision === "sealed"
                                                ? letter.text
                                                : "Some journeys are lovely just as they are. ♡"}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-4 space-y-3">
                                <p className="text-sm leading-relaxed text-[#927e96]">
                                    Our letters are still sealed.
                                    They'll be revealed once both
                                    captains have decided.
                                </p>

                                <p className="text-xs text-[#a18ba5]">
                                    Your decision:{" "}
                                    {data.letters.mySubmitted
                                        ? "Complete"
                                        : "Pending"}
                                    {" · "}
                                    Other captain:{" "}
                                    {data.letters.opponentSubmitted
                                        ? "Complete"
                                        : "Pending"}
                                </p>
                            </div>
                        )}
                    </div>

                    <VoyageKeepsake
                        data={{
                            finishedAt: data.finishedAt,
                            totalShots: data.totalShots,
                            heartbeatsShared: data.heartbeatsShared,
                            captains: data.captains.map((captain) => ({
                                name: captain.name,
                                winner: captain.winner,
                                shots: captain.shots,
                                hits: captain.hits,
                                shipsSunk: captain.shipsSunk,
                            })),
                        }}
                    />

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={onHeartbeats}
                            className="flex-1 rounded-full bg-[#d77ca5] px-6 py-3 text-sm font-black text-white transition hover:bg-[#c46b94]"
                        >
                            Our Heartbeats ♡
                        </button>

                        <button
                            type="button"
                            onClick={onLetters}
                            className="flex-1 rounded-full border border-[#ead4eb] bg-white px-6 py-3 text-sm font-bold text-[#765773] transition hover:bg-[#fff0f6]"
                        >
                            Our Little Letters ♡
                        </button>
                    </div>

                    <p className="text-center text-xs leading-relaxed text-[#a18ba5]">
                        Unused Heartbeat opportunities never expire.
                        You can return to share another little moment.
                    </p>
                </>
            )}
        </section>
    );
}