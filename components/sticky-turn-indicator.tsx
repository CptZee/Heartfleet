
"use client";

type HeartbeatState = {
    status: "choosing" | "answering";
    role: "initiator" | "chooser";
} | null;

type StickyTurnIndicatorProps = {
    yourTurn: boolean;
    opponentName: string;
    status: "playing" | "finished";
    winner: "you" | "opponent" | null;
    busy?: boolean;
    heartbeat?: HeartbeatState;
};

export default function StickyTurnIndicator({
    yourTurn,
    opponentName,
    status,
    winner,
    busy = false,
    heartbeat = null,
}: StickyTurnIndicatorProps) {
    const finished = status === "finished";
    const isHeartbeatActive = heartbeat !== null;

    const needsToChoose =
        heartbeat?.status === "choosing" &&
        heartbeat.role === "chooser";

    const needsToAnswer =
        heartbeat?.status === "answering" &&
        heartbeat.role === "initiator";

    const needsAction = needsToChoose || needsToAnswer;

    const title = isHeartbeatActive
        ? needsToChoose
            ? "Your turn to choose a question!"
            : needsToAnswer
                ? "A question is waiting for you!"
                : heartbeat.status === "choosing"
                    ? `${opponentName} is choosing a question`
                    : `${opponentName} is answering your question`
        : finished
            ? winner === "you"
                ? "You won the battle!"
                : `${opponentName} won the battle`
            : yourTurn
                ? busy
                    ? "Firing your shot..."
                    : "Your turn to attack!"
                : `${opponentName} is attacking`;

    const subtitle = isHeartbeatActive
        ? needsToChoose
            ? "Choose one of the questions or write your own."
            : needsToAnswer
                ? "Share your answer, or gently skip. There's no time limit."
                : "The battle is paused for a little Heartbeat moment."
        : finished
            ? "The battle has come to an end."
            : yourTurn
                ? "Choose a coordinate on your opponent's ocean."
                : "Stand by and protect your fleet.";

    const theme = isHeartbeatActive
        ? needsAction
            ? "action"
            : "waiting"
        : finished
            ? "finished"
            : yourTurn
                ? "turn"
                : "waitingBattle";

    const containerColors = {
        action:
            "border-pink-300 bg-[#fff0f6]/95 shadow-pink-200/50",
        waiting:
            "border-fuchsia-200 bg-[#faf0ff]/95 shadow-fuchsia-200/40",
        finished:
            "border-pink-200 bg-[#fff0f6]/95 shadow-pink-200/40",
        turn:
            "border-emerald-300 bg-emerald-50/95 shadow-emerald-200/40",
        waitingBattle:
            "border-violet-200 bg-[#f5efff]/95 shadow-violet-200/40",
    };

    const iconColors = {
        action: "bg-pink-100 text-pink-600",
        waiting: "bg-fuchsia-100 text-fuchsia-600",
        finished: "bg-pink-100 text-pink-600",
        turn: "bg-emerald-100 text-emerald-600",
        waitingBattle: "bg-violet-100 text-violet-600",
    };

    const titleColors = {
        action: "text-pink-700",
        waiting: "text-fuchsia-800",
        finished: "text-pink-700",
        turn: "text-emerald-800",
        waitingBattle: "text-violet-800",
    };

    const badgeColors = {
        action: "bg-pink-500 text-white",
        waiting: "bg-fuchsia-200 text-fuchsia-800",
        finished: "bg-pink-200 text-pink-800",
        turn: "bg-emerald-500 text-white",
        waitingBattle: "bg-violet-200 text-violet-800",
    };

    const badge = isHeartbeatActive
        ? needsToChoose
            ? "Choose"
            : needsToAnswer
                ? "Answer"
                : "Waiting"
        : yourTurn
            ? "Attack"
            : "Waiting";

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
                    ${containerColors[theme]}
                `}
            >
                <div
                    className={`
                        relative flex h-12 w-12 shrink-0
                        items-center justify-center rounded-xl
                        text-2xl font-black
                        ${iconColors[theme]}
                    `}
                >
                    {isHeartbeatActive
                        ? "♡"
                        : finished
                            ? "♡"
                            : yourTurn
                                ? "✦"
                                : "◷"}

                    {((isHeartbeatActive && needsAction) ||
                        (!isHeartbeatActive &&
                            !finished &&
                            yourTurn &&
                            !busy)) && (
                            <span
                                className={`absolute inset-0 animate-ping rounded-xl ${isHeartbeatActive
                                        ? "bg-pink-300/20"
                                        : "bg-emerald-300/20"
                                    }`}
                            />
                        )}
                </div>

                <div className="min-w-0 flex-1">
                    <p
                        className={`text-sm font-black sm:text-base ${titleColors[theme]}`}
                    >
                        {title}
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-[#817187]">
                        {subtitle}
                    </p>
                </div>

                {(!finished || isHeartbeatActive) && (
                    <span
                        className={`
                            shrink-0 rounded-full px-3 py-1
                            text-[10px] font-black uppercase tracking-wide
                            ${badgeColors[theme]}
                        `}
                    >
                        {badge}
                    </span>
                )}
            </div>
        </div>
    );
}
