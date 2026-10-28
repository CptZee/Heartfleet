
"use client";

type StickyTurnIndicatorProps = {
    yourTurn: boolean;
    opponentName: string;
    status: "playing" | "finished";
    winner: "you" | "opponent" | null;
    busy?: boolean;
};

export default function StickyTurnIndicator({
    yourTurn,
    opponentName,
    status,
    winner,
    busy = false,
}: StickyTurnIndicatorProps) {
    const finished = status === "finished";

    const title = finished
        ? winner === "you"
            ? "You won the battle!"
            : `${opponentName} won the battle`
        : yourTurn
            ? busy
                ? "Firing your shot..."
                : "Your turn to attack!"
            : `${opponentName} is attacking`;

    const subtitle = finished
        ? "The battle has come to an end."
        : yourTurn
            ? "Choose a coordinate on your opponent's ocean."
            : "Stand by and protect your fleet.";

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6">
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={`
                    pointer-events-auto flex w-full max-w-md
                    items-center gap-4 rounded-2xl border-2
                    px-5 py-4 shadow-xl
                    backdrop-blur-xl transition-all duration-500
                    ${finished
                        ? "border-pink-200 bg-[#fff0f6]/95 shadow-pink-200/40"
                        : yourTurn
                            ? "border-emerald-300 bg-emerald-50/95 shadow-emerald-200/40"
                            : "border-violet-200 bg-[#f5efff]/95 shadow-violet-200/40"
                    }
                `}
            >
                <div
                    className={`
                        relative flex h-12 w-12 shrink-0
                        items-center justify-center rounded-xl
                        text-2xl font-black
                        ${finished
                            ? "bg-pink-100 text-pink-600"
                            : yourTurn
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-violet-100 text-violet-600"
                        }
                    `}
                >
                    {finished ? "♡" : yourTurn ? "✦" : "◷"}

                    {!finished && yourTurn && !busy && (
                        <span className="absolute inset-0 animate-ping rounded-xl bg-emerald-300/20" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <p
                        className={`text-sm font-black sm:text-base ${finished
                                ? "text-pink-700"
                                : yourTurn
                                    ? "text-emerald-800"
                                    : "text-violet-800"
                            }`}
                    >
                        {title}
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-[#817187]">
                        {subtitle}
                    </p>
                </div>

                {!finished && (
                    <span
                        className={`
                            shrink-0 rounded-full px-3 py-1
                            text-[10px] font-black uppercase tracking-wide
                            ${yourTurn
                                ? "bg-emerald-500 text-white"
                                : "bg-violet-200 text-violet-800"
                            }
                        `}
                    >
                        {yourTurn ? "Attack" : "Waiting"}
                    </span>
                )}
            </div>
        </div>
    );
}
