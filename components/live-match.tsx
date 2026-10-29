
"use client";

import Link from "next/link";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    BOARD_SIZE,
    SHIPS,
    shipCells,
    type PlacedShip,
} from "@/lib/game/fleet";
import ShotFeedbackPopup, {
    type ShotFeedback,
} from "@/components/shot-feedback-popup";
import {
    playGameSound,
    unlockGameAudio,
    setGameSoundEnabled,
} from "@/lib/game/sounds";
import {
    getEndgameStage,
    saveEndgameStage,
} from "@/lib/game/endgame-progress";
import StickyTurnIndicator from "@/components/sticky-turn-indicator";
import HeartEconomy from "@/components/heart-economy";
import HeartbeatPanel from "@/components/heartbeat-panel";
import EndgameCelebration from "@/components/endgame-celebration";
import RemainingHeartbeats from "@/components/remaining-heartbeats";
import ClosingLetters from "@/components/closing-letters";
import VoyageSummary from "@/components/voyage-summary";

type Shot = {
    row: number;
    col: number;
    hit: boolean;
    sunkShip: string | null;
};

type MatchState = {
    status: "playing" | "finished";
    yourTurn: boolean;
    winner: "you" | "opponent" | null;
    opponentName: string;
    ownShips: PlacedShip[];
    yourShots: Shot[];
    incomingShots: Shot[];
    isHeartbeatActive: boolean;
};

type ActiveHeartbeat = {
    status: "choosing" | "answering";
    role: "initiator" | "chooser";
} | null;

const LETTERS = "ABCDEFGHIJ";

function coordinate(row: number, col: number) {
    return `${LETTERS[row]}${col + 1}`;
}

function shotKey(row: number, col: number) {
    return `${row},${col}`;
}

export default function LiveMatch({
    roomId,
    username,
}: {
    roomId: string;
    username: string;
}) {
    const [match, setMatch] = useState<MatchState | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [lastResult, setLastResult] = useState("");
    const [feedback, setFeedback] = useState<ShotFeedback | null>(null);
    const [animatingCell, setAnimatingCell] = useState<string | null>(null);
    const previousIncomingCount = useRef<number | null>(null);
    const feedbackId = useRef(0);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const isHeartbeatActive = match?.isHeartbeatActive ?? false;
    const [activeHeartbeat, setActiveHeartbeat] = useState<ActiveHeartbeat>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const previousMatchStatus = useRef<string | null>(null);
    const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const celebrationScheduled = useRef(false);
    const [endgameStage, setEndgameStage] = useState<"battle" | "heartbeats" | "letters" | "summary">("battle");
    const [endgameRestored, setEndgameRestored] = useState(false);
    const initialMatchStatusChecked = useRef(false);

    useEffect(() => {
        if (!match) return;

        const previous = previousMatchStatus.current;
        const current = match.status;

        previousMatchStatus.current = current;

        if (
            previous !== "playing" ||
            current !== "finished" ||
            !match.winner ||
            celebrationScheduled.current
        ) {
            return;
        }

        const storageKey = `heartfleet-celebration-${roomId}`;

        if (sessionStorage.getItem(storageKey) === "completed") {
            return;
        }

        celebrationScheduled.current = true;
        celebrationTimer.current = setTimeout(() => {
            setShowCelebration(true);
            celebrationTimer.current = null;
        }, 3200);
    }, [match?.status, match?.winner, roomId]);

    useEffect(() => {
        return () => {
            if (celebrationTimer.current) {
                clearTimeout(celebrationTimer.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!match || initialMatchStatusChecked.current) return;

        initialMatchStatusChecked.current = true;

        if (match.status === "finished") {
            const savedStage = getEndgameStage(roomId);

            setEndgameStage(savedStage ?? "summary");
        }

        setEndgameRestored(true);
    }, [match?.status, roomId]);

    useEffect(() => {
        if (!endgameRestored || match?.status !== "finished") {
            return;
        }

        saveEndgameStage(roomId, endgameStage);
    }, [roomId, endgameStage, endgameRestored, match?.status]);

    const closeFeedback = useCallback(() => {
        setFeedback(null);
        setAnimatingCell(null);
    }, []);

    function toggleSound() {
        const next = !soundEnabled;

        setSoundEnabled(next);
        setGameSoundEnabled(next);

        if (next) {
            unlockGameAudio();
        }
    }

    useEffect(() => {
        if (!match) return;

        const shots = match.incomingShots;

        if (previousIncomingCount.current === null) {
            previousIncomingCount.current = shots.length;
            return;
        }

        if (shots.length > previousIncomingCount.current) {
            const latest = shots[shots.length - 1];

            const type = latest.sunkShip
                ? "sunk"
                : latest.hit
                    ? "hit"
                    : "miss";

            setFeedback({
                id: ++feedbackId.current,
                type,
                coordinate: coordinate(latest.row, latest.col),
                incoming: true,
                message: latest.sunkShip
                    ? "One of your ships has been sunk!"
                    : latest.hit
                        ? "Your fleet took a direct hit!"
                        : "Enemy attack missed your fleet!",
            });

            playGameSound(
                latest.hit ? "incoming-hit" : "incoming-miss"
            );
            setAnimatingCell(shotKey(latest.row, latest.col));
        }

        previousIncomingCount.current = shots.length;
    }, [match]);

    const loadMatch = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/rooms/${roomId}/match`,
                { cache: "no-store" }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Unable to load match.");
            }

            const heartbeatResponse = await fetch(
                `/api/rooms/${roomId}/heartbeats`,
                { cache: "no-store" }
            );

            if (heartbeatResponse.ok) {
                const heartbeatData = await heartbeatResponse.json();
                setActiveHeartbeat(heartbeatData.heartbeat);
            }

            setMatch(data as MatchState);
            setError("");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load match."
            );
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        void loadMatch();

        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void loadMatch();
            }
        }, 2000);

        const onVisible = () => {
            if (document.visibilityState === "visible") {
                void loadMatch();
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
    }, [loadMatch]);

    const ownCells = useMemo(() => {
        const cells = new Map<string, string>();

        for (const ship of match?.ownShips ?? []) {
            for (const cell of shipCells(ship)) {
                cells.set(shotKey(cell.row, cell.col), ship.id);
            }
        }

        return cells;
    }, [match?.ownShips]);

    const outgoing = useMemo(
        () =>
            new Map(
                (match?.yourShots ?? []).map((shot) => [
                    shotKey(shot.row, shot.col),
                    shot,
                ])
            ),
        [match?.yourShots]
    );

    const incoming = useMemo(
        () =>
            new Map(
                (match?.incomingShots ?? []).map((shot) => [
                    shotKey(shot.row, shot.col),
                    shot,
                ])
            ),
        [match?.incomingShots]
    );

    const sunkOwnShips = useMemo(() => {
        const sunk = new Set<string>();

        for (const ship of match?.ownShips ?? []) {
            const cells = shipCells(ship);

            if (
                cells.every(
                    (cell) =>
                        incoming.get(shotKey(cell.row, cell.col))?.hit
                )
            ) {
                sunk.add(ship.id);
            }
        }

        return sunk;
    }, [match?.ownShips, incoming]);

    const sunkEnemyShips = useMemo(
        () =>
            new Set(
                (match?.yourShots ?? [])
                    .map((shot) => shot.sunkShip)
                    .filter((id): id is string => Boolean(id))
            ),
        [match?.yourShots]
    );

    async function fire(row: number, col: number) {
        if (isHeartbeatActive) {
            return;
        }
        unlockGameAudio();
        if (
            !match ||
            busy ||
            match.status !== "playing" ||
            !match.yourTurn ||
            outgoing.has(shotKey(row, col))
        ) {
            return;
        }

        setBusy(true);
        setError("");
        setLastResult("");

        try {
            const response = await fetch(
                `/api/rooms/${roomId}/match`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ row, col }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Unable to fire shot.");
            }

            const result = data.result as {
                hit: boolean;
                sunkShip: string | null;
                won: boolean;
            };

            const target = coordinate(row, col);

            const type: ShotFeedback["type"] = result.won
                ? "victory"
                : result.sunkShip
                    ? "sunk"
                    : result.hit
                        ? "hit"
                        : "miss";

            const name = result.sunkShip
                ? SHIPS.find((ship) => ship.id === result.sunkShip)?.name ??
                "Ship"
                : null;

            const message = result.won
                ? "The final ship has fallen. Victory is yours!"
                : name
                    ? `You sank their ${name}!`
                    : result.hit
                        ? "Direct hit! Excellent shot!"
                        : "Splash! You missed. Better luck next turn.";

            setFeedback({
                id: ++feedbackId.current,
                type,
                coordinate: target,
                message,
                incoming: false,
            });

            playGameSound(
                result.won
                    ? "victory"
                    : result.sunkShip
                        ? "sunk"
                        : result.hit
                            ? "hit"
                            : "miss"
            );
            setAnimatingCell(shotKey(row, col));
            setLastResult(message);

            await loadMatch();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to fire shot."
            );
            await loadMatch();
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        if (!match) return;

        const previousStatus = previousMatchStatus.current;
        const currentStatus = match.status;

        previousMatchStatus.current = currentStatus;

        if (
            previousStatus !== "playing" ||
            currentStatus !== "finished" ||
            !match.winner
        ) {
            return;
        }

        const storageKey = `heartfleet-celebration-${roomId}`;

        if (sessionStorage.getItem(storageKey)) {
            return;
        }

        // Mark the celebration as seen so it does not
        // replay on refresh.
        sessionStorage.setItem(storageKey, "true");

        // Allow the existing final-shot feedback to finish
        // before opening the endgame celebration.
        celebrationTimer.current = setTimeout(() => {
            setShowCelebration(true);
            celebrationTimer.current = null;
        }, 3200);
    }, [match?.status, match?.winner, roomId]);

    useEffect(() => {
        return () => {
            if (celebrationTimer.current) {
                clearTimeout(celebrationTimer.current);
            }
        };
    }, []);

    if (loading) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center text-[#927e96]">
                Sailing into battle...
            </main>
        );
    }

    if (!match) {
        return (
            <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-5 text-center">
                <h1 className="text-2xl font-bold text-[#765773]">
                    Match unavailable
                </h1>
                <p className="text-[#817187]">{error}</p>
                <Link
                    href={`/room/${roomId}`}
                    className="rounded-full bg-[#b97498] px-7 py-3 font-bold text-white"
                >
                    Return to room
                </Link>
            </main>
        );
    }

    const finished = match.status === "finished";
    const hits = match.yourShots.filter((shot) => shot.hit).length;
    const misses = match.yourShots.length - hits;

    return (
        <main className="mx-auto w-full max-w-[1450px] flex-1 px-4 pt-8 pb-36 text-[#51475d] sm:px-8 lg:pt-12">
            <header className="mb-8 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b7789c]">
                    Heartfleet · Live battle
                </p>

                <h1 className="mt-3 text-3xl font-bold text-[#765773] sm:text-5xl">
                    Two fleets. One heart. ♡
                </h1>

                <p className="mt-3 text-sm text-[#817187]">
                    {username} vs. {match.opponentName}
                </p>
                <button
                    type="button"
                    onClick={toggleSound}
                    aria-pressed={soundEnabled}
                    className="mt-5 cursor-pointer rounded-full border border-[#e5cddd] bg-white/90 px-5 py-2.5 text-sm font-bold text-[#91627d] transition hover:bg-[#fff0f6]"
                >
                    {soundEnabled ? "♪ Sound on" : "♪ Sound off"}
                </button>
            </header>

            <ShotFeedbackPopup
                feedback={feedback}
                onClose={closeFeedback}
            />

            {lastResult && (
                <p className="mb-5 rounded-xl bg-[#fff0f6] px-5 py-3 text-center text-sm font-bold text-[#91627d]">
                    {lastResult}
                </p>
            )}

            {error && (
                <p
                    role="alert"
                    className="mb-5 rounded-xl bg-rose-50 px-5 py-3 text-center text-sm text-rose-700"
                >
                    {error}
                </p>
            )}
            <div className="mt-7 grid gap-4 sm:grid-cols-3 mb-4">
                <StatCard
                    label="Successful hits"
                    value={`${hits} / 17`}
                />
                <StatCard
                    label="Missed shots"
                    value={String(misses)}
                />
                <StatCard
                    label="Enemy ships sunk"
                    value={`${sunkEnemyShips.size} / 5`}
                />
            </div>
            <div className="relative mb-4">
                <div className="grid items-start gap-6 xl:grid-cols-2">
                    <BattleBoard
                        title="Your ocean"
                        subtitle="Your ships and incoming enemy attacks"
                        own
                        ships={ownCells}
                        shots={incoming}
                        sunkShips={sunkOwnShips}
                        animatingCell={feedback?.incoming ? animatingCell : null}
                        disabled
                    />

                    <BattleBoard
                        title={`${match.opponentName}'s ocean`}
                        subtitle="Choose a coordinate to attack"
                        own={false}
                        ships={new Map()}
                        shots={outgoing}
                        sunkShips={sunkEnemyShips}
                        animatingCell={!feedback?.incoming ? animatingCell : null}
                        isOpponentTurn={!match.yourTurn && !finished}
                        disabled={
                            busy ||
                            finished ||
                            !match.yourTurn ||
                            isHeartbeatActive
                        }
                        onFire={fire}
                    />
                </div>

                {isHeartbeatActive && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-[2rem] bg-[#241b35]/65 p-4 backdrop-blur-[3px] sm:p-6">
                        <div className="w-full max-w-md rounded-[2rem] border border-pink-200/80 bg-[#fff7fb] px-6 py-8 text-center shadow-2xl shadow-black/20 sm:px-8">
                            <div className="mb-4 text-4xl text-[#d77ca5]">
                                ♡
                            </div>

                            <h3 className="text-xl font-black text-[#765773] sm:text-2xl">
                                A Heartbeat Moment
                            </h3>

                            <p className="mt-3 text-sm leading-relaxed text-[#927e96]">
                                The battle is paused while you share a little
                                moment. Your turn will be waiting when
                                you're done.
                            </p>

                            <div className="mx-auto mt-5 h-1 w-16 rounded-full bg-gradient-to-r from-[#e9b5cf] via-[#d77ca5] to-[#b8a5d7]" />
                        </div>
                    </div>
                )}
            </div>
            <HeartEconomy roomId={roomId} />
            {match.status === "playing" &&
                !showCelebration && (
                    <HeartbeatPanel roomId={roomId} />
                )}
            {match?.status === "finished" &&
                endgameStage === "summary" &&
                !showCelebration && (
                    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#241b35]/75 px-4 py-8 backdrop-blur-md">
                        <div className="flex min-h-full items-center justify-center">
                            <VoyageSummary
                                roomId={roomId}
                                onHeartbeats={() => {
                                    setEndgameStage("heartbeats");
                                }}
                                onLetters={() => {
                                    setEndgameStage("letters");
                                }}
                            />
                        </div>
                    </div>
                )}
            <StickyTurnIndicator
                yourTurn={match.yourTurn}
                opponentName={match.opponentName}
                status={match.status}
                winner={match.winner}
                busy={busy}
                heartbeat={activeHeartbeat}
            />
            {endgameRestored &&
                match?.status === "finished" &&
                endgameStage === "heartbeats" &&
                !showCelebration && (
                    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#241b35]/75 px-4 py-8 backdrop-blur-md">
                        <div className="flex min-h-full items-center justify-center">
                            <RemainingHeartbeats
                                roomId={roomId}
                                onContinue={() => {
                                    setEndgameStage("letters");
                                }}
                                onBackToSummary={() => {
                                    setEndgameStage("summary");
                                }}
                            />
                        </div>
                    </div>
                )}

            {showCelebration && match?.winner && (
                <EndgameCelebration
                    winner={match.winner}
                    opponentName={match.opponentName}
                    onComplete={() => {
                        sessionStorage.setItem(
                            `heartfleet-celebration-${roomId}`,
                            "completed"
                        );

                        setShowCelebration(false);
                        setEndgameStage("heartbeats");
                    }}
                />
            )}

            {endgameRestored &&
                match?.status === "finished" &&
                endgameStage === "letters" &&
                !showCelebration && (
                    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#241b35]/75 px-4 py-8 backdrop-blur-md">
                        <div className="flex min-h-full items-center justify-center">
                            <ClosingLetters
                                roomId={roomId}
                                opponentName={match.opponentName}
                                onContinue={() => {
                                    setEndgameStage("summary");
                                }}
                            />
                        </div>
                    </div>
                )}
        </main>
    );
}

function BattleBoard({
    title,
    subtitle,
    own,
    ships,
    shots,
    sunkShips,
    disabled,
    isOpponentTurn = false,
    onFire,
    animatingCell,
}: {
    title: string;
    subtitle: string;
    own: boolean;
    ships: Map<string, string>;
    shots: Map<string, Shot>;
    sunkShips: Set<string>;
    disabled: boolean;
    isOpponentTurn?: boolean;
    onFire?: (row: number, col: number) => void;
    animatingCell?: string | null;
}) {
    return (
        <section className="min-w-0 rounded-[2rem] border border-[#f0e0ed] bg-white/90 p-4 shadow-xl shadow-[#d6b8d0]/15 sm:p-7">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-[#765773]">
                    {title}
                </h2>

                <p className="mt-1 text-sm text-[#817187]">
                    {subtitle}
                </p>
            </div>

            <div className="relative mx-auto w-full max-w-[550px]">
                <div
                    className="grid gap-1 sm:gap-1.5"
                    style={{
                        gridTemplateColumns:
                            "24px repeat(10, minmax(0, 1fr))",
                    }}
                >
                    <div />

                    {Array.from({ length: BOARD_SIZE }, (_, col) => (
                        <div
                            key={`col-${col}`}
                            className="flex items-center justify-center text-[10px] font-bold text-[#927e96] sm:text-xs"
                        >
                            {col + 1}
                        </div>
                    ))}

                    {Array.from({ length: BOARD_SIZE }, (_, row) => (
                        <div key={`row-${row}`} className="contents">
                            <div className="flex items-center justify-center text-[10px] font-bold text-[#927e96] sm:text-xs">
                                {LETTERS[row]}
                            </div>

                            {Array.from(
                                { length: BOARD_SIZE },
                                (_, col) => {
                                    const key = shotKey(row, col);
                                    const ship = ships.get(key);
                                    const shot = shots.get(key);

                                    const isSunk =
                                        Boolean(ship) &&
                                        sunkShips.has(ship!);

                                    const isAnimating =
                                        animatingCell === key &&
                                        Boolean(shot);

                                    const clickable =
                                        !own && !disabled && !shot;

                                    let background = "bg-[#e9f5fa]";

                                    if (ship) {
                                        background = isSunk
                                            ? "bg-[#b97498]"
                                            : "bg-[#a9a5cf]";
                                    }

                                    if (shot?.hit) {
                                        background = "bg-[#ed9ba8]";
                                    } else if (shot) {
                                        background = "bg-[#d4e1ec]";
                                    }

                                    const animationClass = isAnimating
                                        ? shot?.hit
                                            ? "animate-[hitPulse_650ms_ease-out]"
                                            : "animate-[missRipple_650ms_ease-out]"
                                        : "";

                                    const highlightClass = isAnimating
                                        ? shot?.hit
                                            ? "z-10 ring-2 ring-rose-400 ring-offset-1"
                                            : "z-10 ring-2 ring-sky-400 ring-offset-1"
                                        : "";

                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            disabled={!clickable}
                                            onClick={() =>
                                                onFire?.(row, col)
                                            }
                                            aria-label={`${coordinate(row, col)}: ${shot
                                                ? shot.hit
                                                    ? "hit"
                                                    : "miss"
                                                : own && ship
                                                    ? "ship"
                                                    : "unexplored"
                                                }`}
                                            className={`
                                                relative flex aspect-square min-w-0
                                                items-center justify-center
                                                rounded-[4px] border border-white/80
                                                text-sm font-black
                                                transition-colors duration-200
                                                sm:rounded-md
                                                ${background}
                                                ${animationClass}
                                                ${highlightClass}
                                                ${clickable
                                                    ? "cursor-crosshair hover:bg-[#b8e0e5] hover:ring-2 hover:ring-[#b97498]"
                                                    : "cursor-default"
                                                }
                                            `}
                                        >
                                            {shot?.hit ? (
                                                <>
                                                    <span
                                                        aria-hidden="true"
                                                        className="relative z-10 text-lg font-black text-white drop-shadow-sm sm:text-xl"
                                                    >
                                                        ×
                                                    </span>

                                                    {isAnimating && (
                                                        <span
                                                            aria-hidden="true"
                                                            className="pointer-events-none absolute inset-0 rounded-md bg-rose-300/30 animate-ping"
                                                        />
                                                    )}
                                                </>
                                            ) : shot ? (
                                                <>
                                                    <span
                                                        aria-hidden="true"
                                                        className="relative z-10 text-lg font-black text-[#7b8fb6] sm:text-xl"
                                                    >
                                                        •
                                                    </span>

                                                    {isAnimating && (
                                                        <span
                                                            aria-hidden="true"
                                                            className="pointer-events-none absolute inset-0 rounded-md border-2 border-sky-400 animate-ping"
                                                        />
                                                    )}
                                                </>
                                            ) : null}
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    ))}
                </div>
                {!own && isOpponentTurn && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-[#241b35]/55 backdrop-blur-[2px]">
                        <div className="mx-4 rounded-2xl border border-white/20 bg-[#fff7fb] px-8 py-6 text-center shadow-xl">
                            <div className="mb-2 text-3xl text-[#d77ca5]">
                                ♡
                            </div>

                            <h3 className="text-xl font-black text-[#765773]">
                                Not Your Turn
                            </h3>

                            <p className="mt-2 text-sm text-[#927e96]">
                                Your opponent is making their move.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-[#817187]">
                {own && (
                    <Legend
                        color="bg-[#a9a5cf]"
                        label="Your ship"
                    />
                )}

                <Legend
                    color="bg-[#ed9ba8]"
                    label="Hit"
                />

                <Legend
                    color="bg-[#d4e1ec]"
                    label="Miss"
                />

                {own && (
                    <Legend
                        color="bg-[#b97498]"
                        label="Sunk ship"
                    />
                )}
            </div>
        </section>
    );
}

function Legend({
    color,
    label,
}: {
    color: string;
    label: string;
}) {
    return (
        <span className="inline-flex items-center gap-2">
            <span className={`h-3 w-3 rounded-sm ${color}`} />
            {label}
        </span>
    );
}

function StatCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-[#f0e0ed] bg-white/90 p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-[#927e96]">
                {label}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#765773]">
                {value}
            </p>
        </div>
    );
}
