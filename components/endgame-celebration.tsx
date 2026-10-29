"use client";

import { useEffect, useState } from "react";

type EndgameCelebrationProps = {
    winner: "you" | "opponent";
    opponentName: string;
    onComplete: () => void;
};

export default function EndgameCelebration({
    winner,
    opponentName,
    onComplete,
}: EndgameCelebrationProps) {
    const [stage, setStage] = useState<0 | 1 | 2>(0);

    useEffect(() => {
        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        if (reducedMotion) {
            setStage(2);
            return;
        }

        const victoryTimer = window.setTimeout(() => {
            setStage(1);
        }, 1800);

        const voyageTimer = window.setTimeout(() => {
            setStage(2);
        }, 6000);

        return () => {
            window.clearTimeout(victoryTimer);
            window.clearTimeout(voyageTimer);
        };
    }, []);

    const won = winner === "you";

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Heartfleet endgame celebration"
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#241b35]/75 px-4 py-8 backdrop-blur-md"
        >
            <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border-2 border-[#f0d4e3] bg-gradient-to-br from-[#fff0f6] via-white to-[#f5efff] px-6 py-10 text-center shadow-2xl sm:px-10 sm:py-12">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                >
                    <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-pink-200/40 blur-3xl" />
                    <div className="absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-violet-200/40 blur-3xl" />

                    <span className="absolute left-[12%] top-[18%] text-2xl text-[#e9a8c7] motion-safe:animate-bounce">
                        ♡
                    </span>

                    <span className="absolute right-[14%] top-[24%] text-xl text-[#b8a5d7] motion-safe:animate-pulse">
                        ✦
                    </span>

                    <span className="absolute bottom-[20%] left-[17%] text-lg text-[#d77ca5] motion-safe:animate-pulse">
                        ✧
                    </span>

                    <span className="absolute bottom-[16%] right-[16%] text-2xl text-[#e9a8c7] motion-safe:animate-bounce">
                        ♡
                    </span>
                </div>

                <div className="relative z-10">
                    {stage === 0 && (
                        <div className="animate-[shotReveal_500ms_ease-out]">
                            <div className="mb-6 text-6xl text-[#a9a5cf]">
                                ≋
                            </div>

                            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b7789c]">
                                The Final Splash
                            </p>

                            <h2 className="mt-4 text-3xl font-black text-[#765773] sm:text-4xl">
                                The last ship has sunk!
                            </h2>

                            <p className="mt-4 text-sm leading-relaxed text-[#927e96]">
                                Our little battle has reached its final
                                wave.
                            </p>
                        </div>
                    )}

                    {stage === 1 && (
                        <div className="animate-[shotReveal_500ms_ease-out]">
                            <div className="mb-5 text-6xl text-[#d77ca5]">
                                {won ? "✦" : "♡"}
                            </div>

                            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b7789c]">
                                A Little Celebration
                            </p>

                            <h2 className="mt-4 text-3xl font-black text-[#765773] sm:text-4xl">
                                {won
                                    ? "You Won the Battle! ♡"
                                    : `${opponentName} Won the Battle!`}
                            </h2>

                            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#927e96]">
                                {won
                                    ? "Your strategy carried you to victory. What a lovely little adventure!"
                                    : "The battle may be over, but every little moment made this voyage special."}
                            </p>
                        </div>
                    )}

                    {stage === 2 && (
                        <div className="animate-[shotReveal_500ms_ease-out]">
                            <div className="mb-5 text-6xl text-[#d77ca5]">
                                ♡
                            </div>

                            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b7789c]">
                                Our Little Voyage
                            </p>

                            <h2 className="mt-4 text-3xl font-black text-[#765773] sm:text-4xl">
                                The Battle Ends,
                                <span className="block text-[#d77ca5]">
                                    The Memories Stay.
                                </span>
                            </h2>

                            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#927e96]">
                                Before we close this chapter, there's
                                room for one last little letter.
                            </p>

                            <div className="mt-6 rounded-2xl border border-[#f0d4e3] bg-white/75 p-4">
                                <p className="text-sm font-bold text-[#765773]">
                                    One Last Little Letter ♡
                                </p>

                                <p className="mt-2 text-xs leading-relaxed text-[#927e96]">
                                    You can write a closing message,
                                    gently pass, or visit your voyage
                                    summary.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="mt-9 flex flex-col items-center gap-4">
                        {stage === 2 ? (
                            <button
                                type="button"
                                onClick={onComplete}
                                autoFocus
                                className="rounded-full bg-[#d77ca5] px-8 py-3 text-sm font-black text-white shadow-lg shadow-pink-200/50 transition hover:bg-[#c46b94] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d77ca5]"
                            >
                                Continue Our Voyage ♡
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={onComplete}
                                className="rounded-full border border-[#ead4eb] bg-white/80 px-6 py-2 text-xs font-bold text-[#927e96] transition hover:bg-white"
                            >
                                Skip celebration
                            </button>
                        )}

                        <div className="flex items-center gap-2">
                            {[0, 1, 2].map((index) => (
                                <span
                                    key={index}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${stage === index
                                            ? "w-8 bg-[#d77ca5]"
                                            : "w-2 bg-[#ead4eb]"
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}