"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type KeepsakeData = {
    finishedAt: string | null;
    totalShots: number;
    heartbeatsShared: number;
    captains: {
        name: string;
        winner: boolean;
        shots: number;
        hits: number;
        shipsSunk: number;
    }[];
};

type VoyageKeepsakeProps = {
    data: KeepsakeData;
};

const WIDTH = 900;
const HEIGHT = 1200;

function roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: string
) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
}

function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign = "center"
) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}

function fitName(
    ctx: CanvasRenderingContext2D,
    name: string,
    maxWidth: number
) {
    if (ctx.measureText(name).width <= maxWidth) return name;

    let result = name;

    while (
        result.length > 0 &&
        ctx.measureText(`${result}…`).width > maxWidth
    ) {
        result = result.slice(0, -1);
    }

    return `${result}…`;
}

function renderKeepsake(
    canvas: HTMLCanvasElement,
    data: KeepsakeData,
    anonymous: boolean
) {
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const pink = "#d77ca5";
    const purple = "#765773";
    const muted = "#927e96";

    // Background
    const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    background.addColorStop(0, "#fff0f6");
    background.addColorStop(0.55, "#ffffff");
    background.addColorStop(1, "#eee9ff");

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Decorative background shapes
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#f6c9dd";
    ctx.beginPath();
    ctx.arc(60, 100, 175, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dcd2fa";
    ctx.beginPath();
    ctx.arc(850, 1090, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Card frame
    roundedRect(ctx, 52, 50, 796, 1100, 42, "#ffffffd9");

    ctx.strokeStyle = "#f0d4e3";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(52, 50, 796, 1100, 42);
    ctx.stroke();

    // Header
    drawText(
        ctx,
        "♡",
        450,
        165,
        "76px Georgia, serif",
        pink
    );

    drawText(
        ctx,
        "HEARTFLEET",
        450,
        224,
        "bold 25px Arial, sans-serif",
        pink
    );

    drawText(
        ctx,
        "Our Little Voyage",
        450,
        310,
        "bold 54px Georgia, serif",
        purple
    );

    drawText(
        ctx,
        "Two captains. One little adventure.",
        450,
        358,
        "25px Arial, sans-serif",
        muted
    );

    // Captain cards
    const captains = data.captains.slice(0, 2);

    captains.forEach((captain, index) => {
        const x = index === 0 ? 104 : 463;
        const name = anonymous
            ? `Captain ${index === 0 ? "A" : "B"}`
            : captain.name;

        roundedRect(ctx, x, 420, 333, 205, 26, "#fff3f8");

        drawText(
            ctx,
            index === 0 ? "FIRST CAPTAIN" : "SECOND CAPTAIN",
            x + 166,
            470,
            "bold 19px Arial, sans-serif",
            pink
        );

        ctx.font = "bold 32px Arial, sans-serif";

        drawText(
            ctx,
            fitName(ctx, name, 290),
            x + 166,
            527,
            "bold 32px Arial, sans-serif",
            purple
        );

        drawText(
            ctx,
            captain.winner ? "♡ VICTORIOUS ♡" : "FELLOW CAPTAIN",
            x + 166,
            577,
            "bold 19px Arial, sans-serif",
            captain.winner ? pink : muted
        );
    });

    // Summary
    drawText(
        ctx,
        "A LITTLE ADVENTURE IN NUMBERS",
        450,
        705,
        "bold 22px Arial, sans-serif",
        purple
    );

    const stats = [
        { label: "TOTAL SHOTS", value: data.totalShots },
        { label: "SUCCESSFUL HITS", value: captains.reduce((sum, c) => sum + c.hits, 0) },
        { label: "SHIPS SUNK", value: captains.reduce((sum, c) => sum + c.shipsSunk, 0) },
        { label: "HEARTBEAT MOMENTS", value: data.heartbeatsShared },
    ];

    stats.forEach((stat, index) => {
        const x = index % 2 === 0 ? 105 : 463;
        const y = index < 2 ? 745 : 880;

        roundedRect(ctx, x, y, 333, 116, 22, "#f7f1fb");

        drawText(
            ctx,
            String(stat.value),
            x + 166,
            y + 53,
            "bold 42px Arial, sans-serif",
            purple
        );

        drawText(
            ctx,
            stat.label,
            x + 166,
            y + 88,
            "bold 17px Arial, sans-serif",
            muted
        );
    });

    const date =
        data.finishedAt && !Number.isNaN(Date.parse(data.finishedAt))
            ? new Date(data.finishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
            })
            : "A lovely day";

    drawText(
        ctx,
        date,
        450,
        1060,
        "24px Arial, sans-serif",
        muted
    );

    drawText(
        ctx,
        "The battle ends. The memories stay. ♡",
        450,
        1100,
        "italic 24px Georgia, serif",
        pink
    );
}

export default function VoyageKeepsake({
    data,
}: VoyageKeepsakeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [anonymous, setAnonymous] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const render = useCallback(() => {
        if (!canvasRef.current) return;

        try {
            renderKeepsake(canvasRef.current, data, anonymous);
            setError(null);
        } catch (err) {
            console.error("Keepsake rendering failed:", err);
            setError("Unable to generate your keepsake.");
        }
    }, [data, anonymous]);

    useEffect(() => {
        render();
    }, [render]);

    function download() {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.toBlob((blob) => {
            if (!blob) {
                setError("Unable to download your keepsake.");
                return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = "heartfleet-our-little-voyage.png";
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, "image/png");
    }

    return (
        <section className="space-y-5 rounded-2xl border border-[#ead4eb] bg-white/80 p-5 sm:p-6">
            <div className="text-center">
                <h3 className="text-xl font-black text-[#765773]">
                    A Little Keepsake ♡
                </h3>

                <p className="mt-2 text-sm text-[#927e96]">
                    A little memory of our voyage, made to keep.
                </p>
            </div>

            <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-[#f0d4e3] shadow-lg">
                <canvas
                    ref={canvasRef}
                    width={WIDTH}
                    height={HEIGHT}
                    role="img"
                    aria-label="Preview of your Heartfleet voyage keepsake"
                    className="block h-auto w-full"
                />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#fff6fa] p-4">
                <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(event) =>
                        setAnonymous(event.target.checked)
                    }
                    className="mt-1 accent-[#d77ca5]"
                />

                <span>
                    <span className="block text-sm font-bold text-[#765773]">
                        Hide captain usernames
                    </span>

                    <span className="mt-1 block text-xs leading-relaxed text-[#927e96]">
                        Replace usernames with Captain A and Captain B
                        on the downloaded image.
                    </span>
                </span>
            </label>

            <p className="text-center text-xs leading-relaxed text-[#a18ba5]">
                Only match statistics are included. Your Heartbeat
                conversations and closing letters remain private.
            </p>

            {error && (
                <p role="alert" className="text-center text-sm text-rose-600">
                    {error}
                </p>
            )}

            <button
                type="button"
                onClick={download}
                disabled={Boolean(error)}
                className="w-full rounded-full bg-[#d77ca5] px-6 py-3 text-sm font-black text-white transition hover:bg-[#c46b94] disabled:opacity-50"
            >
                Download Our Keepsake ♡
            </button>
        </section>
    );
}