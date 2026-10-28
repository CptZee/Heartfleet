
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    BOARD_SIZE,
    SHIPS,
    isValidFleet,
    randomFleet,
    shipCells,
    type Orientation,
    type PlacedShip,
    type ShipId,
} from "@/lib/game/fleet";

type FleetStatus = {
    status: "waiting" | "placing" | "playing" | "finished";
    ownReady: boolean;
    opponentReady: boolean;
    ownShips: PlacedShip[] | null;
};

const LETTERS = "ABCDEFGHIJ";

export default function FleetPlacement({
    roomId,
    username,
}: {
    roomId: string;
    username: string;
}) {
    const [ships, setShips] = useState<PlacedShip[]>([]);
    const [selected, setSelected] = useState<ShipId>("carrier");
    const [orientation, setOrientation] =
        useState<Orientation>("horizontal");
    const [hovered, setHovered] = useState<{
        row: number;
        col: number;
    } | null>(null);
    const [status, setStatus] = useState<FleetStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const locked = status?.ownReady ?? false;

    const loadStatus = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/rooms/${roomId}/fleet`,
                { cache: "no-store" }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Unable to load fleet.");
            }

            const next = data as FleetStatus;
            setStatus(next);

            if (next.ownReady && next.ownShips) {
                setShips(next.ownShips);
            }

            setError("");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load fleet."
            );
        } finally {
            setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        void loadStatus();

        const interval = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void loadStatus();
            }
        }, 3000);

        return () => window.clearInterval(interval);
    }, [loadStatus]);

    const placedCells = useMemo(() => {
        const cells = new Map<string, ShipId>();

        for (const ship of ships) {
            for (const cell of shipCells(ship)) {
                cells.set(`${cell.row},${cell.col}`, ship.id);
            }
        }

        return cells;
    }, [ships]);

    const preview = useMemo(() => {
        if (!hovered || locked) return null;

        const candidate: PlacedShip = {
            id: selected,
            row: hovered.row,
            col: hovered.col,
            orientation,
        };

        const remaining = ships.filter(
            (ship) => ship.id !== selected
        );

        return {
            cells: new Set(
                shipCells(candidate).map(
                    (cell) => `${cell.row},${cell.col}`
                )
            ),
            valid: isValidFleet(
                [...remaining, candidate],
                false
            ),
        };
    }, [hovered, locked, orientation, selected, ships]);

    function placeShip(row: number, col: number) {
        if (locked || saving || status?.status !== "placing") {
            return;
        }

        const existing = placedCells.get(`${row},${col}`);

        if (existing && existing !== selected) {
            setSelected(existing);
            setError("");
            return;
        }

        const candidate: PlacedShip = {
            id: selected,
            row,
            col,
            orientation,
        };

        const next = [
            ...ships.filter((ship) => ship.id !== selected),
            candidate,
        ];

        if (!isValidFleet(next, false)) {
            setError(
                "That ship overlaps another or extends beyond the board."
            );
            return;
        }

        setShips(next);
        setError("");
    }

    function rotate() {
        if (locked) return;

        setOrientation((value) =>
            value === "horizontal" ? "vertical" : "horizontal"
        );
    }

    function arrangeRandomly() {
        if (locked) return;

        setShips(randomFleet());
        setError("");
    }

    async function confirmFleet() {
        if (saving || locked || !isValidFleet(ships)) return;

        setSaving(true);
        setError("");

        try {
            const response = await fetch(
                `/api/rooms/${roomId}/fleet`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ ships }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Unable to save fleet.");
            }

            await loadStatus();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to save fleet."
            );
        } finally {
            setSaving(false);
        }
    }

    const complete = isValidFleet(ships);

    if (loading) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center text-[#927e96]">
                Preparing your fleet...
            </main>
        );
    }

    if (!status) {
        return (
            <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-5 text-center">
                <h1 className="text-2xl font-bold text-[#765773]">
                    Fleet unavailable
                </h1>
                <p className="text-[#817187]">{error}</p>
                <Link
                    href={`/room/${roomId}`}
                    className="rounded-full bg-[#b97498] px-6 py-3 font-bold text-white"
                >
                    Return to room
                </Link>
            </main>
        );
    }

    return (
        <main className="mx-auto w-full max-w-[1250px] flex-1 px-4 py-8 text-[#51475d] sm:px-8 lg:py-12">
            <div className="mb-8 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b7789c]">
                    Heartfleet · Captain {username}
                </p>

                <h1 className="mt-3 text-3xl font-bold text-[#765773] sm:text-5xl">
                    Arrange your fleet ♡
                </h1>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#817187]">
                    Place all five ships on your private ocean.
                    Your opponent cannot see your arrangement.
                </p>
            </div>

            <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
                {/* Placement board */}
                <section className="min-w-0 rounded-[2rem] border border-[#f0e0ed] bg-white/90 p-4 shadow-xl shadow-[#d6b8d0]/15 sm:p-7">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-bold text-[#765773]">
                            Your ocean
                        </h2>

                        <span className="rounded-full bg-[#f3eafa] px-3 py-1 text-xs font-bold text-[#a26085]">
                            {ships.length} / 5 ships placed
                        </span>
                    </div>

                    <div className="mx-auto w-full max-w-[550px]">
                        <div
                            className="grid gap-1 sm:gap-1.5"
                            style={{
                                gridTemplateColumns:
                                    "24px repeat(10, minmax(0, 1fr))",
                            }}
                            onMouseLeave={() => setHovered(null)}
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
                                <div
                                    key={`row-${row}`}
                                    className="contents"
                                >
                                    <div className="flex items-center justify-center text-[10px] font-bold text-[#927e96] sm:text-xs">
                                        {LETTERS[row]}
                                    </div>

                                    {Array.from(
                                        { length: BOARD_SIZE },
                                        (_, col) => {
                                            const key = `${row},${col}`;
                                            const occupied = placedCells.get(key);
                                            const previewed =
                                                preview?.cells.has(key) ?? false;

                                            let background = "bg-[#e9f5fa]";

                                            if (occupied) {
                                                background =
                                                    occupied === selected
                                                        ? "bg-[#b97498]"
                                                        : "bg-[#a9a5cf]";
                                            }

                                            if (previewed) {
                                                background = preview?.valid
                                                    ? "bg-[#93c7bb]"
                                                    : "bg-[#eaa3ae]";
                                            }

                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    disabled={
                                                        locked ||
                                                        saving ||
                                                        status.status !== "placing"
                                                    }
                                                    onMouseEnter={() =>
                                                        setHovered({ row, col })
                                                    }
                                                    onFocus={() =>
                                                        setHovered({ row, col })
                                                    }
                                                    onClick={() =>
                                                        placeShip(row, col)
                                                    }
                                                    aria-label={`${LETTERS[row]}${col + 1}${occupied
                                                        ? `, ${occupied}`
                                                        : ", empty water"
                                                        }`}
                                                    className={`aspect-square min-w-0 rounded-[4px] border border-white/80 transition-colors sm:rounded-md ${background} ${locked
                                                        ? "cursor-default"
                                                        : "cursor-pointer hover:brightness-95"
                                                        }`}
                                                />
                                            );
                                        }
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="mt-5 text-center text-xs leading-6 text-[#927e96]">
                        Select a ship, then tap a square to place it.
                        Select another ship to move it.
                    </p>
                </section>

                {/* Controls */}
                <section className="min-w-0 space-y-5">
                    <div className="rounded-[2rem] border border-[#f0e0ed] bg-white/90 p-5 shadow-lg shadow-[#d6b8d0]/10 sm:p-7">
                        <h2 className="text-lg font-bold text-[#765773]">
                            Your ships
                        </h2>

                        <p className="mt-2 text-sm text-[#817187]">
                            Choose which ship to position.
                        </p>

                        <div className="mt-5 space-y-2">
                            {SHIPS.map((ship) => {
                                const isPlaced = ships.some(
                                    (item) => item.id === ship.id
                                );
                                const active = selected === ship.id;

                                return (
                                    <button
                                        key={ship.id}
                                        type="button"
                                        disabled={locked}
                                        onClick={() => {
                                            setSelected(ship.id);
                                            setError("");
                                        }}
                                        className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${active
                                            ? "border-[#d7a4bf] bg-[#fff0f6]"
                                            : "border-[#f0e0ed] bg-white hover:bg-[#fff7fa]"
                                            } disabled:cursor-default`}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-[#765773]">
                                                {ship.name}
                                            </p>

                                            <p className="mt-1 text-xs text-[#927e96]">
                                                {ship.size} squares
                                                {isPlaced ? " · Placed" : " · Not placed"}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 gap-1">
                                            {Array.from(
                                                { length: ship.size },
                                                (_, index) => (
                                                    <div
                                                        key={index}
                                                        className={`h-4 w-3 rounded-sm ${isPlaced
                                                            ? "bg-[#b97498]"
                                                            : "bg-[#dcecf3]"
                                                            }`}
                                                    />
                                                )
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={rotate}
                                disabled={locked}
                                className="cursor-pointer rounded-xl border border-[#e5cddd] bg-[#fff7fa] px-3 py-3 text-sm font-bold text-[#a26085] hover:bg-[#f9e9f1] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Rotate ↻
                            </button>

                            <div className="flex items-center justify-center rounded-xl bg-[#f3f6fc] px-2 text-center text-xs font-bold text-[#79768a]">
                                {orientation === "horizontal"
                                    ? "↔ Horizontal"
                                    : "↕ Vertical"}
                            </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={arrangeRandomly}
                                disabled={locked}
                                className="cursor-pointer rounded-xl border border-[#e5cddd] bg-white px-3 py-3 text-sm font-bold text-[#a26085] hover:bg-[#fff7fa] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Randomize
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setShips([]);
                                    setError("");
                                }}
                                disabled={locked}
                                className="cursor-pointer rounded-xl border border-[#e5cddd] bg-white px-3 py-3 text-sm font-bold text-[#a26085] hover:bg-[#fff7fa] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Clear board
                            </button>
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-[#f0e0ed] bg-gradient-to-br from-[#fff0f6] to-[#e9f5fa] p-6">
                        <h2 className="text-lg font-bold text-[#765773]">
                            {locked
                                ? "Fleet locked in ♡"
                                : "Ready to set sail?"}
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-[#817187]">
                            {status.status === "playing"
                                ? "Both captains have confirmed their fleets."
                                : locked
                                    ? "Your arrangement is saved. Waiting for your opponent."
                                    : "Once confirmed, your ship positions cannot be changed."}
                        </p>

                        <div className="mt-4 rounded-xl bg-white/70 p-3 text-sm text-[#765773]">
                            <p>
                                Your fleet:{" "}
                                <strong>
                                    {locked ? "Ready" : complete ? "Complete" : "Incomplete"}
                                </strong>
                            </p>
                            <p className="mt-1">
                                Opponent:{" "}
                                <strong>
                                    {status.opponentReady
                                        ? "Ready"
                                        : "Preparing"}
                                </strong>
                            </p>
                        </div>

                        {status.status === "waiting" && (
                            <p className="mt-4 text-sm text-[#91627d]">
                                Waiting for another captain to join the room.
                            </p>
                        )}

                        {status.status === "playing" ? (
                            <Link
                                href={`/room/${roomId}/match`}
                                className="mt-5 block rounded-full bg-[#b97498] px-6 py-4 text-center font-bold text-white transition hover:bg-[#a45e83]"
                            >
                                Enter the battlefield →
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={confirmFleet}
                                disabled={
                                    !complete ||
                                    locked ||
                                    saving ||
                                    status.status !== "placing"
                                }
                                className="mt-5 w-full cursor-pointer rounded-full bg-[#b97498] px-6 py-4 font-bold text-white transition hover:bg-[#a45e83] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving
                                    ? "Saving fleet..."
                                    : locked
                                        ? "Fleet confirmed ✓"
                                        : "Confirm my fleet ♡"}
                            </button>
                        )}

                        {error && (
                            <p
                                role="alert"
                                className="mt-4 text-sm text-rose-700"
                            >
                                {error}
                            </p>
                        )}

                        <Link
                            href={`/room/${roomId}`}
                            className="mt-5 block text-center text-sm font-bold text-[#a26085] underline"
                        >
                            Back to room
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}
