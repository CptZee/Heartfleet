"use client";

import { useState } from "react";
import HeartbeatPanel from "@/components/heartbeat-panel";

type RemainingHeartbeatsProps = {
    roomId: string;
    onContinue: () => void;
    onBackToSummary?: () => void;
};

export default function RemainingHeartbeats({
    roomId,
    onContinue,
    onBackToSummary,
}: RemainingHeartbeatsProps) {
    const [showHeartbeats, setShowHeartbeats] = useState(false);

    return (
        <section className="mx-auto w-full max-w-3xl rounded-[2rem] border border-[#f0d4e3] bg-gradient-to-br from-[#fff0f6] via-white to-[#f5efff] p-6 shadow-xl sm:p-10">
            <div className="text-center">
                <div className="mb-4 text-5xl text-[#d77ca5]">
                    ♡
                </div>

                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b7789c]">
                    Before Our Final Letters
                </p>

                <h2 className="mt-4 text-3xl font-black text-[#765773]">
                    One Last Heartbeat? ♡
                </h2>

                <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#927e96]">
                    Our little battle may be over, but there
                    might still be a few questions worth asking.
                </p>

                <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-[#a18ba5]">
                    You can spend your remaining Heartbeat
                    opportunities now, or save them for another
                    time. They never expire.
                </p>
            </div>

            {showHeartbeats && (
                <div className="mt-8">
                    <HeartbeatPanel roomId={roomId} />
                </div>
            )}

            <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button
                    type="button"
                    onClick={() => setShowHeartbeats((value) => !value)}
                    className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#d77ca5] px-5 py-3 text-center text-sm font-black leading-snug text-white transition hover:bg-[#c46b94]"
                >
                    {showHeartbeats
                        ? "Hide Heartbeats"
                        : "Spend Our Heartbeats"}
                </button>

                {onBackToSummary && (
                    <button
                        type="button"
                        onClick={onBackToSummary}
                        className="flex min-h-12 w-full items-center justify-center rounded-full border border-[#ead4eb] bg-white px-5 py-3 text-center text-sm font-bold leading-snug text-[#927e96] transition hover:bg-[#fff0f6]"
                    >
                        Back to Our Little Voyage
                    </button>
                )}

                <button
                    type="button"
                    onClick={onContinue}
                    className="flex min-h-12 w-full items-center justify-center rounded-full border border-[#ead4eb] bg-white px-5 py-3 text-center text-sm font-bold leading-snug text-[#927e96] transition hover:bg-[#fff0f6]"
                >
                    Continue to Our Letters
                </button>
            </div>
        </section>
    );
}