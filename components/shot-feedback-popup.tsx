
"use client";

import { useEffect } from "react";

export type ShotFeedback = {
    id: number;
    type: "hit" | "miss" | "sunk" | "victory";
    coordinate: string;
    message: string;
    incoming: boolean;
};

type Props = {
    feedback: ShotFeedback | null;
    onClose: () => void;
};

const styles = {
    hit: {
        heading: "DIRECT HIT!",
        symbol: "✦",
        background: "from-rose-50 via-pink-50 to-white",
        border: "border-rose-200",
        text: "text-rose-600",
        symbolBackground: "bg-rose-100",
    },
    miss: {
        heading: "SPLASH!",
        symbol: "≈",
        background: "from-sky-50 via-cyan-50 to-white",
        border: "border-sky-200",
        text: "text-sky-600",
        symbolBackground: "bg-sky-100",
    },
    sunk: {
        heading: "SHIP SUNK!",
        symbol: "✧",
        background: "from-violet-50 via-purple-50 to-white",
        border: "border-violet-200",
        text: "text-violet-600",
        symbolBackground: "bg-violet-100",
    },
    victory: {
        heading: "VICTORY!",
        symbol: "♡",
        background: "from-amber-50 via-yellow-50 to-white",
        border: "border-amber-200",
        text: "text-amber-600",
        symbolBackground: "bg-amber-100",
    },
};

export default function ShotFeedbackPopup({
    feedback,
    onClose,
}: Props) {
    useEffect(() => {
        if (!feedback || feedback.type === "victory") return;

        const timeout = window.setTimeout(onClose, 3000);

        return () => window.clearTimeout(timeout);
    }, [feedback, onClose]);

    if (!feedback) return null;

    const style = styles[feedback.type];

    const heading = feedback.incoming
        ? feedback.type === "hit"
            ? "YOUR FLEET WAS HIT!"
            : feedback.type === "miss"
                ? "THEY MISSED!"
                : "YOUR SHIP WAS SUNK!"
        : style.heading;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            role="status"
            aria-live="polite"
        >
            {/* Dimmed backdrop */}
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-[#241b35]/55 backdrop-blur-[3px] animate-[fadeIn_250ms_ease-out]"
            />
            <div
                key={feedback.id}
                className={`
                    pointer-events-auto relative w-full max-w-sm
                    animate-[shotReveal_350ms_ease-out]
                    overflow-hidden rounded-[2rem] border-2
                    bg-gradient-to-br p-6 text-center
                    shadow-2xl shadow-[#d6b8d0]/30
                    ${style.background}
                    ${style.border}
                `}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Dismiss notification"
                    className="absolute right-4 top-3 cursor-pointer rounded-full px-2 py-1 text-lg text-[#9a8a9e] hover:bg-white/70"
                >
                    ×
                </button>

                <div
                    className={`
                        mx-auto mb-4 flex h-16 w-16
                        items-center justify-center rounded-full
                        text-4xl ${style.symbolBackground}
                        ${style.text}
                    `}
                >
                    <span aria-hidden="true">{style.symbol}</span>
                </div>

                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9c8ca0]">
                    {feedback.incoming
                        ? "Incoming attack"
                        : "Attack result"}
                </p>

                <h2
                    className={`mt-2 text-3xl font-black tracking-tight ${style.text}`}
                >
                    {heading}
                </h2>

                <p className="mt-2 text-sm font-semibold text-[#786a81]">
                    {feedback.coordinate}
                </p>

                <p className="mt-3 text-sm leading-relaxed text-[#817187]">
                    {feedback.message}
                </p>

                {feedback.type !== "victory" && (
                    <div className="mt-5 h-1 overflow-hidden rounded-full bg-black/5">
                        <div
                            key={feedback.id}
                            className="h-full w-full origin-left animate-[popupCountdown_3s_linear_forwards] rounded-full bg-current opacity-30"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
