
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HEARTBEAT_QUESTIONS } from "@/lib/game/heartbeat-questions";

type Opportunity = {
    id: string;
    milestone: string;
    status: string;
};

type ResolvedHeartbeat = {
    id: string;
    status: "completed" | "skipped";
    role: "initiator" | "chooser";
    questionText: string | null;
    answerText: string | null;
    completedAt: string;
};

type Heartbeat = {
    id: string;
    status: "choosing" | "answering";
    role: "initiator" | "chooser";
    questionText: string | null;
    questionSource: "curated" | "custom" | null;
};

type Economy = {
    balance: number;
    heartbeatCost: number;
    availableOpportunities: Opportunity[];
};

type HeartbeatHistoryItem = {
    id: string;
    status: "completed" | "skipped";
    questionSource: "curated" | "custom";
    questionText: string;
    answerText: string | null;
    createdAt: string;
    completedAt: string;
    role: "initiator" | "chooser";
};

function getRandomQuestions(count = 3) {
    return [...HEARTBEAT_QUESTIONS]
        .sort(() => Math.random() - 0.5)
        .slice(0, count);
}

export default function HeartbeatPanel({
    roomId,

}: {
    roomId: string;
}) {
    const [answer, setAnswer] = useState("");
    const [latestResolved, setLatestResolved] = useState<ResolvedHeartbeat | null>(null);
    const [dismissedResultId, setDismissedResultId] = useState<string | null>(null);
    const [economy, setEconomy] = useState<Economy | null>(null);
    const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
    const [source, setSource] = useState<"curated" | "custom">(
        "curated"
    );
    const [questionId, setQuestionId] = useState<string>("");
    const [customQuestion, setCustomQuestion] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [history, setHistory] = useState<HeartbeatHistoryItem[]>([]);
    const [historyExpanded, setHistoryExpanded] = useState(false);

    const curatedQuestions = useMemo(
        () => getRandomQuestions(3),
        [heartbeat?.id]
    );

    useEffect(() => {
        setQuestionId(curatedQuestions[0]?.id ?? "");
    }, [curatedQuestions]);

    const refresh = useCallback(async () => {
        const [heartsResult, heartbeatResult] = await Promise.allSettled([
            fetch(`/api/rooms/${roomId}/hearts`, {
                cache: "no-store",
            }),
            fetch(`/api/rooms/${roomId}/heartbeats`, {
                cache: "no-store",
            }),
        ]);

        if (heartsResult.status === "fulfilled") {
            try {
                if (heartsResult.value.ok) {
                    const heartsData = await heartsResult.value.json();
                    setEconomy(heartsData);
                } else {
                    console.error(
                        "Heart economy refresh failed:",
                        heartsResult.value.status
                    );
                }
            } catch (error) {
                console.error("Invalid Heart economy response:", error);
            }
        } else {
            console.error("Heart economy request failed:", heartsResult.reason);
        }

        if (heartbeatResult.status === "fulfilled") {
            try {
                if (heartbeatResult.value.ok) {
                    const heartbeatData = await heartbeatResult.value.json();
                    setHeartbeat(heartbeatData.heartbeat);
                    setLatestResolved(heartbeatData.latestResolved ?? null);
                    setHistory(heartbeatData.history ?? []);
                } else {
                    console.error(
                        "Heartbeat refresh failed:",
                        heartbeatResult.value.status
                    );
                }
            } catch (error) {
                console.error("Invalid Heartbeat response:", error);
            }
        } else {
            console.error("Heartbeat request failed:", heartbeatResult.reason);
        }
    }, [roomId]);

    useEffect(() => {
        let active = true;
        let refreshing = false;
        let interval: ReturnType<typeof setInterval> | undefined;

        const sync = async () => {
            if (!active || refreshing) return;

            refreshing = true;

            try {
                await refresh();
            } finally {
                refreshing = false;
            }
        };

        void sync();

        interval = setInterval(() => {
            void sync();
        }, 2000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void sync();
            }
        };

        const handleFocus = () => {
            void sync();
        };

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        window.addEventListener("focus", handleFocus);

        return () => {
            active = false;

            if (interval) {
                clearInterval(interval);
            }

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );

            window.removeEventListener("focus", handleFocus);
        };
    }, [refresh]);

    async function submit(payload: Record<string, unknown>) {
        setBusy(true);
        setError("");

        try {
            const response = await fetch(
                `/api/rooms/${roomId}/heartbeats`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error ?? "Something went wrong."
                );
            }

            await refresh();
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Something went wrong."
            );
        } finally {
            setBusy(false);
        }
    }

    const opportunities =
        economy?.availableOpportunities ?? [];

    return (
        <section className="mb-7 rounded-[2rem] border border-[#ead4eb] bg-white/90 p-5 shadow-lg shadow-purple-100/30 sm:p-6">
            <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b7789c]">
                    Heartfleet Moments
                </p>

                <h2 className="mt-2 text-2xl font-black text-[#765773]">
                    Heartbeats ♡
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-[#927e96]">
                    Spend 3 Hearts to share a little moment.
                    Your opponent chooses the question.
                </p>
            </div>

            {error && (
                <p
                    role="alert"
                    className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
                >
                    {error}
                </p>
            )}

            {!heartbeat && (
                <div className="rounded-2xl bg-[#fff6fa] p-5">
                    <p className="text-sm font-bold text-[#765773]">
                        Your saved opportunities
                    </p>

                    <p className="mt-1 text-xs text-[#927e96]">
                        {opportunities.length} available ·{" "}
                        {economy?.balance ?? "—"} Hearts
                    </p>

                    {opportunities.length === 0 ? (
                        <p className="mt-4 text-sm text-[#927e96]">
                            Reach a special battle milestone to
                            unlock a Heartbeat.
                        </p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {opportunities.map((opportunity) => (
                                <div
                                    key={opportunity.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f0d4e3] bg-white p-4"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-[#765773]">
                                            Saved Heartbeat
                                        </p>
                                        <p className="mt-1 text-xs text-[#927e96]">
                                            {opportunity.milestone.replaceAll(
                                                "_",
                                                " "
                                            )}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={
                                            busy ||
                                            !economy ||
                                            economy.balance < 3
                                        }
                                        onClick={() =>
                                            void submit({
                                                action: "activate",
                                                opportunityId:
                                                    opportunity.id,
                                            })
                                        }
                                        className="rounded-full bg-[#d77ca5] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#c46b94] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Activate · 3 ♥
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="mt-4 text-xs text-[#927e96]">
                        Let It Pass: Simply leave an opportunity
                        unused. It never expires.
                    </p>
                </div>
            )}

            {heartbeat?.status === "choosing" &&
                heartbeat.role === "initiator" && (
                    <div className="rounded-2xl border border-[#ead4eb] bg-[#f8f1ff] p-6 text-center">
                        <div className="mb-3 text-4xl">♡</div>
                        <h3 className="text-xl font-black text-[#765773]">
                            A Heartbeat has begun!
                        </h3>
                        <p className="mt-2 text-sm text-[#927e96]">
                            Your opponent is choosing a question
                            for you. There's no time limit.
                        </p>
                    </div>
                )}

            {heartbeat?.status === "choosing" &&
                heartbeat.role === "chooser" && (
                    <div className="rounded-2xl border border-[#ead4eb] bg-[#f8f1ff] p-5">
                        <h3 className="text-lg font-black text-[#765773]">
                            Your choice!
                        </h3>

                        <p className="mt-2 text-sm text-[#927e96]">
                            Your opponent has invited you to ask
                            them a question.
                        </p>

                        <div className="mt-5 flex gap-2">
                            {(["curated", "custom"] as const).map(
                                (option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setSource(option)}
                                        className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${source === option
                                            ? "bg-[#d77ca5] text-white"
                                            : "bg-white text-[#927e96]"
                                            }`}
                                    >
                                        {option}
                                    </button>
                                )
                            )}
                        </div>

                        {source === "curated" ? (
                            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                                {curatedQuestions.map((question) => (
                                    <label
                                        key={question.id}
                                        className={`block cursor-pointer rounded-xl border p-3 ${questionId === question.id
                                            ? "border-[#d77ca5] bg-[#fff0f6]"
                                            : "border-[#ead4eb] bg-white"
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="heartbeat-question"
                                            value={question.id}
                                            checked={
                                                questionId === question.id
                                            }
                                            onChange={() =>
                                                setQuestionId(question.id)
                                            }
                                            className="mr-2 accent-[#d77ca5]"
                                        />
                                        <span className="text-xs font-bold text-[#b7789c]">
                                            {question.category}
                                        </span>
                                        <p className="mt-1 text-sm text-[#765773]">
                                            {question.text}
                                        </p>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-4">
                                <textarea
                                    value={customQuestion}
                                    onChange={(event) =>
                                        setCustomQuestion(
                                            event.target.value
                                        )
                                    }
                                    maxLength={300}
                                    rows={4}
                                    placeholder="Ask something sweet, thoughtful, or playful..."
                                    className="w-full rounded-xl border border-[#ead4eb] bg-white p-4 text-sm text-[#765773] outline-none focus:border-[#d77ca5]"
                                />
                                <p className="mt-1 text-right text-xs text-[#927e96]">
                                    {customQuestion.length}/300
                                </p>
                            </div>
                        )}

                        <button
                            type="button"
                            disabled={
                                busy ||
                                (source === "custom" &&
                                    !customQuestion.trim())
                            }
                            onClick={() =>
                                void submit({
                                    action: "choose",
                                    heartbeatId: heartbeat.id,
                                    source,
                                    ...(source === "curated"
                                        ? { questionId }
                                        : { question: customQuestion }),
                                })
                            }
                            className="mt-5 w-full rounded-full bg-[#d77ca5] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c46b94] disabled:opacity-40"
                        >
                            {busy
                                ? "Sending..."
                                : "Send this question ♡"}
                        </button>
                    </div>
                )}

            {heartbeat?.status === "answering" && (
                <div className="rounded-2xl border border-[#ead4eb] bg-[#fff0f6] p-6">
                    <div className="text-center">
                        <p className="text-xs font-black uppercase tracking-widest text-[#b7789c]">
                            A question from the heart
                        </p>

                        <h3 className="mt-4 text-xl font-bold leading-relaxed text-[#765773]">
                            {heartbeat.questionText}
                        </h3>
                    </div>

                    {heartbeat.role === "initiator" ? (
                        <div className="mt-6">
                            <label
                                htmlFor="heartbeat-answer"
                                className="mb-2 block text-sm font-bold text-[#765773]"
                            >
                                Your answer
                            </label>

                            <textarea
                                id="heartbeat-answer"
                                value={answer}
                                onChange={(event) =>
                                    setAnswer(event.target.value)
                                }
                                maxLength={1000}
                                rows={4}
                                placeholder="Share what's on your mind..."
                                disabled={busy}
                                className="w-full resize-y rounded-2xl border border-[#ead4eb] bg-white p-4 text-sm text-[#765773] outline-none transition focus:border-[#d77ca5] focus:ring-2 focus:ring-pink-100 disabled:opacity-60"
                            />

                            <p className="mt-1 text-right text-xs text-[#927e96]">
                                {answer.length}/1000
                            </p>

                            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    disabled={busy || !answer.trim()}
                                    onClick={() =>
                                        void submit({
                                            action: "answer",
                                            heartbeatId: heartbeat.id,
                                            answer: answer.trim(),
                                        })
                                    }
                                    className="flex-1 rounded-full bg-[#d77ca5] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#c46b94] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {busy ? "Sending..." : "Send my answer ♡"}
                                </button>

                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                        void submit({
                                            action: "skip",
                                            heartbeatId: heartbeat.id,
                                        })
                                    }
                                    className="rounded-full border border-[#ead4eb] bg-white px-6 py-3 text-sm font-bold text-[#927e96] transition hover:bg-[#f9eaf3] disabled:opacity-40"
                                >
                                    Skip gently
                                </button>
                            </div>

                            <p className="mt-4 text-center text-xs text-[#927e96]">
                                You can take your time. It's always okay
                                to skip a question.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-6 rounded-2xl border border-[#ead4eb] bg-white/80 p-5 text-center">
                            <p className="text-sm font-semibold text-[#765773]">
                                Waiting for their response ♡
                            </p>

                            <p className="mt-2 text-xs leading-relaxed text-[#927e96]">
                                They can answer or skip whenever
                                they're comfortable.
                            </p>
                        </div>
                    )}
                </div>
            )}
            {!heartbeat &&
                latestResolved &&
                latestResolved.id !== dismissedResultId && (
                    <div className="rounded-2xl border border-[#ead4eb] bg-[#f8f1ff] p-6">
                        <div className="text-center">
                            <p className="text-xs font-black uppercase tracking-widest text-[#b7789c]">
                                Heartbeat Memory ♡
                            </p>

                            <h3 className="mt-3 text-xl font-black text-[#765773]">
                                {latestResolved.status === "completed"
                                    ? "A little moment shared"
                                    : "A moment gently passed"}
                            </h3>

                            <p className="mt-4 text-sm font-semibold leading-relaxed text-[#765773]">
                                {latestResolved.questionText}
                            </p>
                        </div>

                        {latestResolved.status === "completed" ? (
                            <div className="mt-5 rounded-2xl bg-white p-5">
                                <p className="text-xs font-bold uppercase tracking-widest text-[#b7789c]">
                                    {latestResolved.role === "initiator"
                                        ? "Your answer"
                                        : "Their answer"}
                                </p>

                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#765773]">
                                    {latestResolved.answerText}
                                </p>
                            </div>
                        ) : (
                            <p className="mt-4 text-center text-sm text-[#927e96]">
                                This question was skipped. No explanation
                                needed.
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={() =>
                                setDismissedResultId(latestResolved.id)
                            }
                            className="mt-6 w-full rounded-full border border-[#ead4eb] bg-white px-5 py-3 text-sm font-bold text-[#765773] transition hover:bg-[#fff0f6]"
                        >
                            Return to the battle ♡
                        </button>
                    </div>
                )}
            <div className="mt-8 border-t border-[#ead4eb] pt-6">
                <button
                    type="button"
                    onClick={() => setHistoryExpanded((prev) => !prev)}
                    aria-expanded={historyExpanded}
                    className="flex w-full items-center justify-between gap-4 text-left"
                >
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b7789c]">
                            Our Little Moments
                        </p>

                        <h3 className="mt-2 text-xl font-black text-[#765773]">
                            Heartbeat Memories ♡
                        </h3>

                        <p className="mt-1 text-sm text-[#927e96]">
                            {history.length}{" "}
                            {history.length === 1 ? "memory" : "memories"} shared
                        </p>
                    </div>

                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f6] text-xl font-bold text-[#b7789c]">
                        {historyExpanded ? "−" : "+"}
                    </span>
                </button>

                {historyExpanded && (
                    <div className="mt-6 space-y-4">
                        {history.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[#ead4eb] bg-[#fff9fc] px-5 py-8 text-center">
                                <div className="mb-3 text-3xl text-[#d77ca5]">
                                    ♡
                                </div>

                                <p className="text-sm font-bold text-[#765773]">
                                    No Heartbeat memories yet
                                </p>

                                <p className="mt-2 text-xs leading-relaxed text-[#927e96]">
                                    Your answered and skipped questions
                                    will appear here.
                                </p>
                            </div>
                        ) : (
                            history.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="rounded-2xl border border-[#ead4eb] bg-[#fff9fc] p-5 transition-colors hover:bg-[#fff2f8]"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#b7789c]">
                                                #{history.length - index}
                                            </span>

                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "completed"
                                                        ? "bg-[#e9f7ef] text-[#54866c]"
                                                        : "bg-[#f0eaf6] text-[#927e96]"
                                                    }`}
                                            >
                                                {item.status === "completed"
                                                    ? "Answered ♡"
                                                    : "Gently skipped"}
                                            </span>
                                        </div>

                                        <span className="text-xs text-[#927e96]">
                                            {new Date(
                                                item.completedAt
                                            ).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                    </div>

                                    <div className="mt-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-[#b7789c]">
                                            {item.role === "initiator"
                                                ? "A question for you"
                                                : "Your question to them"}
                                        </p>

                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed text-[#765773]">
                                            {item.questionText}
                                        </p>
                                    </div>

                                    {item.status === "completed" ? (
                                        <div className="mt-4 rounded-xl border border-[#f0e0ed] bg-white p-4">
                                            <p className="text-xs font-bold uppercase tracking-wider text-[#b7789c]">
                                                {item.role === "initiator"
                                                    ? "Your answer"
                                                    : "Their answer"}
                                            </p>

                                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#765773]">
                                                {item.answerText}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mt-4 rounded-xl bg-white/70 p-4">
                                            <p className="text-sm italic text-[#927e96]">
                                                This question was gently passed.
                                                No answer was needed.
                                            </p>
                                        </div>
                                    )}

                                    <p className="mt-4 text-right text-xs text-[#b79bad]">
                                        {item.questionSource === "custom"
                                            ? "A personal question"
                                            : "A little Heartfleet question"}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
