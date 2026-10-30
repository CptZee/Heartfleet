
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  BOARD_SIZE,
  isValidFleet,
  shipCells,
  type PlacedShip,
} from "@/lib/game/fleet";

const LETTERS = "ABCDEFGHIJ";
const KEY = "heartfleet-tutorial-completed";

const target: PlacedShip = {
  id: "patrol",
  row: 2,
  col: 3,
  orientation: "horizontal",
};

const opponent: PlacedShip = {
  id: "patrol",
  row: 4,
  col: 4,
  orientation: "horizontal",
};

const lessons = [
  {
    title: "Welcome aboard",
    body: "Welcome to Heartfleet! Hide your fleet, take turns attacking coordinates, and sink all five enemy ships to win.",
    target: "welcome",
  },
  {
    title: "Place a ship",
    body: "This is your ocean. Select D3 to place a horizontal Patrol Boat. During a real match, you'll place all five ships.",
    target: "own-2-3",
  },
  {
    title: "Try a miss",
    body: "This is the opponent's ocean. Attack A1 to see what happens when a shot misses.",
    target: "enemy-0-0",
  },
  {
    title: "Find a hit",
    body: "Now attack E5. A hit reveals part of an enemy ship!",
    target: "enemy-4-4",
  },
  {
    title: "Sink the ship",
    body: "Attack E6 to destroy the remaining segment and sink the Patrol Boat.",
    target: "enemy-4-5",
  },
  {
    title: "Hearts and Heartbeats",
    body: "Hearts support special social moments called Heartbeats. Your opponent chooses the question when a Heartbeat is triggered.",
    target: "hearts",
  },
  {
    title: "A little question",
    body: "During a Heartbeat, you can answer the question or let it pass. Heartbeats never expire.",
    target: "heartbeat",
  },
  {
    title: "Ready to sail",
    body: "You've learned ship placement, attacking, sinking ships, and Heartbeats. You're ready for a real match!",
    target: "lesson-panel",
  },
] as const;

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export default function GuidedTutorial({
  username,
}: {
  username: string;
}) {
  const [step, setStep] = useState(0);
  const [fleet, setFleet] = useState<PlacedShip[]>([]);
  const [shots, setShots] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [finished, setFinished] = useState(false);

  const [spotlight, setSpotlight] =
    useState<SpotlightRect | null>(null);

  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
  });

  const rootRef = useRef<HTMLElement>(null);
  const lessonRef = useRef<HTMLElement>(null);

  const activeTarget = lessons[step].target;

  const shipKeys = new Set(
    fleet.flatMap((ship) =>
      shipCells(ship).map((cell) => `${cell.row},${cell.col}`)
    )
  );

  const enemyKeys = new Set(
    shipCells(opponent).map(
      (cell) => `${cell.row},${cell.col}`
    )
  );

  const required =
    step === 2 ? "0,0" : step === 3 ? "4,4" : "4,5";

  const updateSpotlight = useCallback(() => {
    const element =
      rootRef.current?.querySelector<HTMLElement>(
        `[data-tutorial="${activeTarget}"]`
      );

    const width = window.innerWidth;
    const height = window.innerHeight;

    setViewport({ width, height });

    if (!element) {
      setSpotlight(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 7;

    const left = Math.max(0, rect.left - padding);
    const top = Math.max(0, rect.top - padding);
    const right = Math.min(width, rect.right + padding);
    const bottom = Math.min(height, rect.bottom + padding);

    setSpotlight({
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    });
  }, [activeTarget]);

  useLayoutEffect(() => {
    const element =
      rootRef.current?.querySelector<HTMLElement>(
        `[data-tutorial="${activeTarget}"]`
      );

    if (!element) return;

    const lessonHeight =
      lessonRef.current?.getBoundingClientRect().height ?? 160;

    element.style.scrollMarginTop = `${lessonHeight + 35}px`;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    const timeout = window.setTimeout(
      updateSpotlight,
      350
    );

    return () => window.clearTimeout(timeout);
  }, [activeTarget, updateSpotlight]);

  useEffect(() => {
    const handleUpdate = () => updateSpotlight();

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    const observer = new ResizeObserver(handleUpdate);

    if (rootRef.current) {
      observer.observe(rootRef.current);
    }

    updateSpotlight();

    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
      observer.disconnect();
    };
  }, [updateSpotlight]);

  function advance() {
    setFeedback("");
    setStep((current) =>
      Math.min(current + 1, lessons.length - 1)
    );
  }

  function interact(
    row: number,
    col: number,
    own: boolean
  ) {
    const key = `${row},${col}`;

    if (own && step === 1) {
      const candidate: PlacedShip = {
        ...target,
        row,
        col,
      };

      if (
        row !== target.row ||
        col !== target.col ||
        !isValidFleet([candidate], false)
      ) {
        setFeedback(
          "Select D3 to place your Patrol Boat."
        );
        return;
      }

      setFleet([candidate]);
      advance();
      return;
    }

    if (!own && step >= 2 && step <= 4) {
      if (key !== required) {
        setFeedback(
          `Select ${step === 2
            ? "A1"
            : step === 3
              ? "E5"
              : "E6"
          } to continue.`
        );
        return;
      }

      if (!shots.includes(key)) {
        setShots((current) => [...current, key]);
      }

      advance();
    }
  }

  function complete() {
    window.localStorage.setItem(KEY, "true");
    setFinished(true);
  }

  function reset() {
    setStep(0);
    setFleet([]);
    setShots([]);
    setAnswer("");
    setFeedback("");
    setFinished(false);
  }

  function board(own: boolean) {
    const highlight =
      own && step === 1
        ? "2,3"
        : !own && step >= 2 && step <= 4
          ? required
          : null;

    return (
      <div
        data-tutorial={
          own ? "own-board" : "enemy-board"
        }
        className="min-w-0 rounded-2xl border border-[#ebdeec] bg-white/90 p-3 sm:p-5"
      >
        <h2 className="mb-3 text-center font-bold text-[#765773]">
          {own
            ? "Your ocean"
            : "Opponent's ocean"}
        </h2>

        <div className="grid grid-cols-[20px_repeat(10,minmax(0,1fr))] gap-1">
          <span />

          {Array.from(
            { length: BOARD_SIZE },
            (_, col) => (
              <span
                key={col}
                className="text-center text-[10px] text-[#89788d]"
              >
                {col + 1}
              </span>
            )
          )}

          {Array.from(
            { length: BOARD_SIZE },
            (_, row) => (
              <div key={row} className="contents">
                <span className="flex items-center justify-center text-[10px] text-[#89788d]">
                  {LETTERS[row]}
                </span>

                {Array.from(
                  { length: BOARD_SIZE },
                  (_, col) => {
                    const key = `${row},${col}`;

                    const fired =
                      shots.includes(key);

                    const hit =
                      fired &&
                      enemyKeys.has(key);

                    const occupied =
                      own &&
                      shipKeys.has(key);

                    const active =
                      highlight === key;

                    const enabled =
                      (own && step === 1) ||
                      (!own &&
                        step >= 2 &&
                        step <= 4);

                    const tutorialId = own
                      ? `own-${row}-${col}`
                      : `enemy-${row}-${col}`;

                    return (
                      <button
                        key={key}
                        type="button"
                        data-tutorial={
                          tutorialId
                        }
                        aria-label={`${own
                          ? "Your"
                          : "Opponent"
                          } ${LETTERS[row]}${col + 1
                          }`}
                        disabled={!enabled}
                        onClick={() =>
                          interact(
                            row,
                            col,
                            own
                          )
                        }
                        className={`
                          relative aspect-square min-w-0
                          rounded-[4px] border
                          text-[clamp(8px,1.5vw,15px)]
                          transition
                          ${active
                            ? "border-[#a65c84] bg-[#f5bdd5] ring-2 ring-[#d68cae] ring-offset-1"
                            : occupied
                              ? "border-[#9588b6] bg-[#b1a6d0]"
                              : hit
                                ? "border-[#bd6483] bg-[#efafc5]"
                                : fired
                                  ? "border-[#a6c7d2] bg-[#cde8f0]"
                                  : "border-[#e1e8ee] bg-[#edf5f9]"
                          }
                          ${enabled
                            ? "cursor-pointer hover:brightness-95"
                            : "cursor-default"
                          }
                        `}
                      >
                        {hit
                          ? "×"
                          : fired
                            ? "•"
                            : occupied
                              ? "◆"
                              : ""}
                      </button>
                    );
                  }
                )}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  const overlayPanels =
    spotlight && viewport.width > 0
      ? [
        {
          top: 0,
          left: 0,
          width: viewport.width,
          height: spotlight.top,
        },
        {
          top:
            spotlight.top +
            spotlight.height,
          left: 0,
          width: viewport.width,
          height: Math.max(
            0,
            viewport.height -
            spotlight.top -
            spotlight.height
          ),
        },
        {
          top: spotlight.top,
          left: 0,
          width: spotlight.left,
          height: spotlight.height,
        },
        {
          top: spotlight.top,
          left:
            spotlight.left +
            spotlight.width,
          width: Math.max(
            0,
            viewport.width -
            spotlight.left -
            spotlight.width
          ),
          height: spotlight.height,
        },
      ]
      : [];

  return (
    <main
      ref={rootRef}
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 text-[#51475d] sm:px-8"
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div data-tutorial="welcome">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b7789c]">
            Heartfleet Academy
          </p>

          <h1 className="text-2xl font-bold text-[#765773]">
            Practice voyage, Captain{" "}
            {username}
          </h1>
        </div>

        <Link
          href="/lobby"
          className="rounded-full border border-[#e7d5e4] bg-white px-5 py-2 text-sm font-semibold hover:bg-[#fff2f7]"
        >
          Exit tutorial
        </Link>
      </header>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#f0e5ee]">
        <div
          className="h-full rounded-full bg-[#c68caa] transition-all"
          style={{
            width: `${((step + 1) /
              lessons.length) *
              100
              }%`,
          }}
        />
      </div>

      {/* Sticky lesson instructions */}
      <section
        ref={lessonRef}
        data-tutorial="lesson-panel"
        aria-live="polite"
        className="sticky top-3 z-[120] mb-5 rounded-2xl border border-[#efdce8] bg-[#fff7fa]/95 p-4 shadow-xl backdrop-blur-md sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#b7789c]">
              Lesson {step + 1} of{" "}
              {lessons.length}
            </p>

            <h2 className="mt-1 text-lg font-bold text-[#765773]">
              {lessons[step].title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#817187]">
              {lessons[step].body}
            </p>

            {feedback && (
              <p
                role="alert"
                className="mt-2 text-sm font-semibold text-[#a75d81]"
              >
                {feedback}
              </p>
            )}
          </div>

          {(step === 0) && (
            <button
              type="button"
              onClick={advance}
              className="shrink-0 rounded-full bg-[#b97498] px-5 py-2 text-sm font-bold text-white"
            >
              Continue →
            </button>
          )}

          {step === 7 && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-[#e7d5e4] bg-white px-5 py-2 text-sm font-semibold text-[#765773] transition hover:bg-[#fff2f7]"
              >
                Restart Tutorial
              </button>

              {!finished ? (
                <button
                  type="button"
                  onClick={complete}
                  className="rounded-full bg-[#b97498] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#a96388]"
                >
                  Complete Tutorial ✓
                </button>
              ) : (
                <Link
                  href="/lobby"
                  className="rounded-full bg-[#b97498] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#a96388]"
                >
                  Return to Lobby →
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Game boards */}
      <div className="grid gap-4 md:grid-cols-2">
        {board(true)}
        {board(false)}
      </div>

      {/* Hearts section */}
      {step >= 5 && (
        <section
          data-tutorial="hearts"
          className="mt-5 rounded-2xl border border-[#efdce8] bg-white p-5"
        >
          <p className="font-bold text-[#a26085]">
            ♡ Hearts
          </p>

          <p className="mt-2 text-sm text-[#817187]">
            Practice Hearts: 3
          </p>

          <p className="mt-2 text-sm text-[#817187]">
            Earn Hearts during gameplay to unlock special social moments.
          </p>
          {step === 5 && (
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={advance}
                className="rounded-full bg-[#b97498] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#a96388]"
              >
                Start Heartbeat ♡
              </button>
            </div>
          )}
        </section>
      )}

      {/* Heartbeat section */}
      {step >= 6 && (
        <section
          data-tutorial="heartbeat"
          className="mt-4 rounded-2xl border border-[#efdce8] bg-white p-5"
        >
          <p className="font-bold text-[#a26085]">
            ♡ A Little Heartbeat
          </p>

          <p className="mt-2 text-sm font-semibold text-[#765773]">
            What is something small that made you smile recently?
          </p>

          <label
            htmlFor="tutorial-answer"
            className="mt-4 block text-sm font-semibold text-[#765773]"
          >
            Your optional answer
          </label>

          <textarea
            id="tutorial-answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="A small thing that made me smile..."
            disabled={step !== 6}
            className="mt-2 w-full rounded-xl border border-[#e8d5e2] bg-white p-3 outline-[#c68caa] disabled:opacity-60"
          />

          {step === 6 && (
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={advance}
                className="rounded-full border border-[#e7d5e4] bg-white px-5 py-2.5 text-sm font-semibold text-[#765773] transition hover:bg-[#fff2f7]"
              >
                Let it pass
              </button>

              <button
                type="button"
                onClick={advance}
                disabled={!answer.trim()}
                className="rounded-full bg-[#b97498] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#a96388] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Answer →
              </button>
            </div>
          )}
        </section>
      )}

      {/* Spotlight overlay */}
      {spotlight &&
        !finished && (
          <>
            {overlayPanels.map(
              (panel, index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className="pointer-events-auto fixed z-[100] bg-[#191122]/75"
                  style={panel}
                />
              )
            )}

            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-[105] rounded-lg border-2 border-[#f2a9ca] shadow-[0_0_24px_rgba(242,169,202,0.8)]"
              style={{
                top: spotlight.top,
                left: spotlight.left,
                width: spotlight.width,
                height: spotlight.height,
              }}
            />
          </>
        )}
    </main>
  );
}
