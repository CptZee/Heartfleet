"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

type Decision = "sealed" | "passed";

type RevealedLetter = {
    role: "you" | "opponent";
    decision: Decision;
    text: string | null;
    submittedAt: string;
};

type LettersData = {
    revealed: boolean;
    myDecision: Decision | null;
    opponentSubmitted: boolean;
    letters: RevealedLetter[] | null;
};

type ClosingLettersProps = {
    roomId: string;
    opponentName: string;
    onContinue: () => void;
};

export default function ClosingLetters({
    roomId,
    opponentName,
    onContinue,
}: ClosingLettersProps) {
    const [data, setData] = useState<LettersData | null>(null);
    const [letter, setLetter] = useState("");
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showReveal, setShowReveal] = useState(false);

    const previousRevealed = useRef<boolean | null>(null);
    const submitting = useRef(false);
    const loadingRef = useRef(false);

    const load = useCallback(async () => {
        if (loadingRef.current) return;

        loadingRef.current = true;

        try {
            const response = await fetch(
                `/api/rooms/${roomId}/letters`,
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error("Unable to load closing letters.");
            }

            const result = (await response.json()) as LettersData;

            if (
                result.revealed &&
                previousRevealed.current === false
            ) {
                setShowReveal(true);
            }

            previousRevealed.current = result.revealed;
            setData(result);
            setError(null);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong."
            );
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        void load();

        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void load();
            }
        }, 2000);

        const refresh = () => void load();

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

    async function submit(decision: Decision) {
        if (submitting.current || data?.myDecision) return;

        const trimmed = letter.trim();

        if (decision === "sealed" && !trimmed) return;

        submitting.current = true;
        setBusy(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/rooms/${roomId}/letters`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        decision,
                        letterText:
                            decision === "sealed" ? trimmed : null,
                    }),
                }
            );

            if (!response.ok) {
                const result = await response.json();

                if (result.error === "LETTER_ALREADY_SUBMITTED") {
                    await load();
                    return;
                }

                throw new Error(
                    "We couldn't seal your decision. Please try again."
                );
            }

            await load();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong."
            );
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    const mySubmitted = Boolean(data?.myDecision);
    const revealed = Boolean(data?.revealed);

    return (
        <section className="mx-auto w-full max-w-3xl rounded-[2rem] border border-[#f0d4e3] bg-gradient-to-br from-[#fff0f6] via-white to-[#f5efff] p-6 shadow-xl sm:p-10">
            <div className="text-center">
                <div
                    aria-hidden="true"
                    className="mb-4 text-5xl text-[#d77ca5]"
                >
                    ♡
                </div>

                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b7789c]">
                    Before Our Voyage Becomes a Memory
                </p>

                <h2 className="mt-4 text-3xl font-black text-[#765773]">
                    {revealed
                        ? "A Few Words Before We Go ♡"
                        : "One Last Little Letter ♡"}
                </h2>

                <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#927e96]">
                    {revealed
                        ? "Two captains, one little adventure, and a moment to remember."
                        : "Is there anything you'd like to say before we close this chapter?"}
                </p>
            </div>

            {loading && !data && (
                <p
                    role="status"
                    className="mt-8 text-center text-sm text-[#927e96]"
                >
                    Opening our little letters...
                </p>
            )}

            {error && (
                <div
                    role="alert"
                    className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
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

            {data && !mySubmitted && !revealed && (
                <div className="mt-8 space-y-5">
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <label
                                htmlFor="heartfleet-closing-letter"
                                className="text-sm font-bold text-[#765773]"
                            >
                                Your private letter
                            </label>

                            <span className="text-xs text-[#a18ba5]">
                                {letter.length}/300
                            </span>
                        </div>

                        <textarea
                            id="heartfleet-closing-letter"
                            value={letter}
                            onChange={(event) =>
                                setLetter(
                                    event.target.value.slice(0, 300)
                                )
                            }
                            maxLength={300}
                            rows={5}
                            disabled={busy}
                            placeholder="A little something from the heart..."
                            className="w-full resize-y rounded-2xl border border-[#ead4eb] bg-white/90 p-4 text-sm leading-relaxed text-[#765773] outline-none transition placeholder:text-[#b9a6b8] focus:border-[#d77ca5] focus:ring-2 focus:ring-pink-100"
                        />

                        <p className="mt-2 text-xs leading-relaxed text-[#a18ba5]">
                            Your letter stays private until both captains
                            have submitted or passed. Once sealed, it
                            cannot be changed.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                            type="button"
                            disabled={busy || !letter.trim()}
                            onClick={() => void submit("sealed")}
                            className="flex-1 rounded-full bg-[#d77ca5] px-6 py-3 text-sm font-black text-white transition hover:bg-[#c46b94] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {busy ? "Sealing..." : "Seal My Letter ♡"}
                        </button>

                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void submit("passed")}
                            className="flex-1 rounded-full border border-[#ead4eb] bg-white px-6 py-3 text-sm font-bold text-[#927e96] transition hover:bg-[#fff0f6] disabled:opacity-50"
                        >
                            Gently Pass
                        </button>
                    </div>
                </div>
            )}

            {data && mySubmitted && !revealed && (
                <div
                    role="status"
                    className="mt-8 rounded-2xl border border-[#ead4eb] bg-white/75 p-6 text-center"
                >
                    <div className="mb-3 text-4xl text-[#d77ca5]">
                        ♡
                    </div>

                    <h3 className="text-lg font-black text-[#765773]">
                        {data.myDecision === "sealed"
                            ? "Your Letter Is Safely Sealed"
                            : "A Gentle Pass"}
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-[#927e96]">
                        {data.myDecision === "sealed"
                            ? "Your words are safely tucked away until both captains are ready."
                            : "You chose to let this little voyage speak for itself."}
                    </p>

                    <p className="mt-4 text-xs text-[#a18ba5]">
                        {data.opponentSubmitted
                            ? "Both decisions are ready. Opening letters..."
                            : `Waiting for ${opponentName} to decide. There's no rush.`}
                    </p>
                </div>
            )}

            {data && revealed && (
                <div
                    aria-live="polite"
                    className={`mt-8 space-y-4 ${showReveal
                        ? "motion-safe:animate-[shotReveal_500ms_ease-out]"
                        : ""
                        }`}
                >
                    {data.letters?.map((item) => (
                        <article
                            key={item.role}
                            className="rounded-2xl border border-[#ead4eb] bg-white/80 p-5"
                        >
                            <p className="text-xs font-black uppercase tracking-wider text-[#b7789c]">
                                {item.role === "you"
                                    ? "Your Little Letter"
                                    : `${opponentName}'s Little Letter`}
                            </p>

                            {item.decision === "sealed" ? (
                                <p className="mt-4 whitespace-pre-wrap break-words text-sm italic leading-relaxed text-[#765773]">
                                    {item.text}
                                </p>
                            ) : (
                                <p className="mt-4 text-sm italic leading-relaxed text-[#927e96]">
                                    Some journeys are lovely just as
                                    they are. ♡
                                </p>
                            )}
                        </article>
                    ))}
                </div>
            )}

            {data && (
                <div className="mt-8 border-t border-[#ead4eb] pt-6 text-center">
                    <button
                        type="button"
                        onClick={onContinue}
                        className="rounded-full border border-[#ead4eb] bg-white px-7 py-3 text-sm font-bold text-[#765773] transition hover:bg-[#fff0f6]"
                    >
                        {revealed
                            ? "Continue Our Voyage ♡"
                            : "View Our Voyage Summary"}
                    </button>

                    {!revealed && (
                        <p className="mt-3 text-xs leading-relaxed text-[#a18ba5]">
                            You can return later. Unrevealed letters
                            remain private.
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}