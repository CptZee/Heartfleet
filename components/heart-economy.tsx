
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type HeartEvent = {
    id: string;
    milestone: string;
    amount: number;
    created_at: string;
};

type HeartEconomyData = {
    balance: number;
    heartbeatCost: number;
    canAffordHeartbeat: boolean;
    availableOpportunities: {
        id: string;
        milestone: string;
        status: string;
    }[];
    events: HeartEvent[];
};

const milestoneNames: Record<string, string> = {
    first_hit: "First successful hit",
    attacks_5: "Five attacks completed",
    attacks_10: "Ten attacks completed",
    attacks_20: "Twenty attacks completed",
    ships_1: "First enemy ship sunk",
    ships_3: "Third enemy ship sunk",
    ships_5: "Final enemy ship sunk",

    gentle_comeback_first: "A Little Encouragement ♡",
    gentle_comeback_stronger: "The Tide Is Turning ♡",
    multiple_comeback: "A Little Encouragement ♡",
};

const comebackDescriptions: Record<string, string> = {
    gentle_comeback_first:
        "Even when the tides are against you, there's always a little hope. You've earned 1 extra Heart.",

    gentle_comeback_stronger:
        "Your journey isn't over yet. You've earned 2 extra Hearts to share more little moments.",

    multiple_comeback:
        "You've reached new milestones and earned a little encouragement along the way.",
};

export default function HeartEconomy({
    roomId,
}: {
    roomId: string;
}) {
    const [data, setData] = useState<HeartEconomyData | null>(null);
    const [reward, setReward] = useState<HeartEvent | null>(null);

    const knownEvents = useRef<Set<string> | null>(null);

    const load = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/rooms/${roomId}/hearts`,
                { cache: "no-store" }
            );

            if (!response.ok) return;

            const result =
                (await response.json()) as HeartEconomyData;

            const ids = new Set(
                result.events.map((event) => event.id)
            );

            if (knownEvents.current !== null) {
                const newEvents = result.events.filter(
                    (event) => !knownEvents.current!.has(event.id)
                );

                if (newEvents.length > 0) {
                    const comebackEvent = newEvents.find((event) =>
                        event.milestone.startsWith("gentle_comeback")
                    );

                    const totalAmount = newEvents.reduce(
                        (total, event) => total + event.amount,
                        0
                    );

                    const selectedEvent =
                        comebackEvent ?? newEvents[newEvents.length - 1];

                    setReward({
                        ...selectedEvent,
                        amount: totalAmount,
                        milestone:
                            newEvents.length === 1
                                ? selectedEvent.milestone
                                : comebackEvent
                                    ? "multiple_comeback"
                                    : "multiple",
                    });
                }
            }

            knownEvents.current = ids;
            setData(result);
        } catch (error) {
            console.error("Heart refresh failed:", error);
        }
    }, [roomId]);

    useEffect(() => {
        void load();

        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void load();
            }
        }, 2000);

        return () => window.clearInterval(interval);
    }, [load]);

    useEffect(() => {
        if (!reward) return;

        const timeout = window.setTimeout(() => {
            setReward(null);
        }, 4000);

        return () => window.clearTimeout(timeout);
    }, [reward]);

    return (
        <>
            <section className="mb-7 rounded-[2rem] border border-[#f0d4e3] bg-gradient-to-r from-[#fff0f6] via-white to-[#f5efff] p-5 shadow-lg shadow-pink-100/40 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-5">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b7789c]">
                            Your Heart Collection
                        </p>

                        <div className="mt-2 flex items-center gap-3">
                            <span
                                aria-hidden="true"
                                className="text-3xl text-[#db719b]"
                            >
                                ♥
                            </span>

                            <span className="text-4xl font-black text-[#765773]">
                                {data?.balance ?? "—"}
                            </span>

                            <span className="text-sm font-semibold text-[#927e96]">
                                Hearts
                            </span>
                        </div>
                    </div>

                    <div className="text-left sm:text-right">
                        <p className="text-sm font-bold text-[#765773]">
                            Heartbeat cost: 3 Hearts
                        </p>

                        <p className="mt-1 text-xs text-[#927e96]">
                            {data
                                ? `${data.availableOpportunities.length} saved Heartbeat opportunities`
                                : "Loading opportunities..."}
                        </p>

                        {data && (
                            <p
                                className={`mt-2 text-xs font-bold ${data.canAffordHeartbeat
                                    ? "text-emerald-700"
                                    : "text-[#b7789c]"
                                    }`}
                            >
                                {data.canAffordHeartbeat
                                    ? "Enough Hearts for a Heartbeat"
                                    : `${3 - data.balance} more Heart${3 - data.balance === 1 ? "" : "s"} needed`}
                            </p>
                        )}
                    </div>
                </div>

                <p className="text-xs leading-relaxed text-[#927e96]">
                    Earn Hearts by reaching battle milestones and
                    through Gentle Comeback when the tides are against you.
                    Spend 3 Hearts to activate a Heartbeat and share
                    a little moment with your opponent.
                </p>
            </section>

            {reward && (
                <div
                    key={reward.id}
                    role="status"
                    aria-live="polite"
                    className="pointer-events-none fixed inset-x-0 top-24 z-[60] flex justify-center px-4"
                >
                    <div className="animate-[shotReveal_350ms_ease-out] rounded-[1.5rem] border-2 border-pink-200 bg-[#fff0f6] px-8 py-5 text-center shadow-2xl shadow-pink-200/50">
                        <p className="text-xs font-black uppercase tracking-widest text-[#b7789c]">
                            {reward.milestone.startsWith("gentle_comeback") ||
                                reward.milestone === "multiple_comeback"
                                ? "Gentle Comeback ♡"
                                : "Milestone reached!"}
                        </p>

                        <p className="mt-2 text-3xl font-black text-[#d76b96]">
                            +{reward.amount} ♥
                        </p>

                        <p className="mt-2 text-sm font-semibold text-[#765773]">
                            {milestoneNames[reward.milestone] ??
                                "Multiple milestones completed"}
                        </p>

                        {comebackDescriptions[reward.milestone] && (
                            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#927e96]">
                                {comebackDescriptions[reward.milestone]}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
