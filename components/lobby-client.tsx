
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Mode = "create" | "join";

export default function LobbyClient({
  username,
}: {
  username: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [roomCode, setRoomCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code && /^[A-F0-9]{12}$/i.test(code)) {
      setMode("join");
      setRoomCode(code.toUpperCase());
    }
  }, []);


  async function handleContinue(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy) return;

    if (mode === "join" && !roomCode.trim()) {
      setMessage("Enter an invite code to join.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/rooms"
          : "/api/rooms/join",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          ...(mode === "join"
            ? {
              body: JSON.stringify({
                code: roomCode.trim().toUpperCase(),
              }),
            }
            : {}),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error || "Unable to continue."
        );
        return;
      }

      router.push(`/room/${result.room.id}`);
    } catch (error) {
      console.error("Room request failed:", error);
      setMessage(
        "Connection failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }


  return (
    <main className="relative mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center px-5 py-12 text-[#51475d] sm:px-8 lg:px-12">
      <div className="grid w-full items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="hidden rounded-[2.5rem] bg-gradient-to-br from-[#e6f4f8] to-[#f9e9f1] p-10 text-center lg:block">
          <div className="mb-6 text-5xl text-[#b97498] motion-safe:animate-pulse">
            ♡
          </div>

          <h2 className="text-3xl font-bold text-[#765773]">
            Two fleets, one adventure.
          </h2>

          <p className="mt-4 leading-7 text-[#817187]">
            Invite someone special, plan your strategy, and make memories
            between the waves.
          </p>

          <div className="mx-auto mt-8 grid max-w-xs grid-cols-8 gap-2">
            {Array.from({ length: 64 }, (_, i) => (
              <div
                key={i}
                className={`aspect-square rounded-md ${[11, 12, 13, 19, 27, 35].includes(i)
                  ? "bg-[#a9a5cf]"
                  : i === 45
                    ? "bg-[#e7a3b7]"
                    : "bg-white/70"
                  }`}
              />
            ))}
          </div>
        </aside>

        <section className="w-full max-w-xl rounded-[2rem] border border-[#f0e0ed] bg-white/90 p-7 shadow-xl shadow-[#d6b8d0]/15 sm:p-11">
          <div className="text-center">
            <div className="text-4xl text-[#d58cab]">♡</div>

            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-[#b7789c]">
              Your voyage begins here
            </p>

            <h1 className="mt-3 text-3xl font-bold text-[#765773] sm:text-4xl">
              Ready to set sail?
            </h1>

            <p className="mt-3 text-[#817187]">
              Just two captains, two fleets, and a little chemistry.
            </p>
          </div>

          {/* Create / Join Room Selection */}
          <div
            className="mt-9 grid grid-cols-2 gap-2 rounded-2xl bg-[#f7eff6] p-1.5"
            role="group"
            aria-label="Choose room action"
          >
            <button
              type="button"
              onClick={() => {
                setMode("create");
                setMessage("");
              }}
              aria-pressed={mode === "create"}
              className={`cursor-pointer rounded-xl px-4 py-3 text-sm font-bold transition ${mode === "create"
                ? "bg-white text-[#a26085] shadow-sm"
                : "text-[#8b7a91] hover:bg-white/50"
                }`}
            >
              ♡ Create room
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("join");
                setMessage("");
              }}
              aria-pressed={mode === "join"}
              className={`cursor-pointer rounded-xl px-4 py-3 text-sm font-bold transition ${mode === "join"
                ? "bg-white text-[#a26085] shadow-sm"
                : "text-[#8b7a91] hover:bg-white/50"
                }`}
            >
              ↗ Join room
            </button>
          </div>

          <form onSubmit={handleContinue} className="mt-8 space-y-5">
            {/* Authenticated Captain Identity */}
            <div className="rounded-2xl border border-[#f0e0ed] bg-[#fff7fa] px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#b7789c]">
                Your captain identity
              </p>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f3d8e5] text-xl font-bold text-[#a26085]">
                  {username.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p className="truncate font-bold text-[#765773]">
                    {username}
                  </p>

                  <p className="text-xs text-[#927e96]">
                    Ready to command your fleet ♡
                  </p>
                </div>
              </div>
            </div>

            {/* Invite Code */}
            {mode === "join" && (
              <div>
                <label
                  htmlFor="roomCode"
                  className="mb-2 block text-sm font-bold text-[#765773]"
                >
                  Invite code
                </label>

                <input
                  id="roomCode"
                  name="roomCode"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.toUpperCase())
                  }
                  maxLength={12}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="e.g. LOVE42"
                  className="w-full rounded-xl border border-[#ead9e7] bg-[#fffcfe] px-4 py-3 text-[#765773] uppercase tracking-widest placeholder:text-[#b4a1b4] outline-none transition focus:border-[#c785a6] focus:ring-2 focus:ring-[#f3d8e5]"
                />
              </div>
            )}

            {/* Room Description */}
            <div className="rounded-2xl bg-[#f3f6fc] p-4 text-sm leading-6 text-[#79768a]">
              {mode === "create"
                ? "Create a private room and invite someone special. You'll be able to share a link or room code once multiplayer is connected."
                : "Have an invite code? Enter it above to join your opponent's private room once multiplayer is connected."}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="w-full cursor-pointer rounded-full bg-[#b97498] px-6 py-4 font-bold text-white transition hover:bg-[#a45e83] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? "Please wait..."
                : mode === "create"
                  ? "Create our room →"
                  : "Join the voyage →"}
            </button>

            {/* Status Message */}
            {message && (
              <p
                role="status"
                className="text-center text-sm leading-6 text-[#91627d]"
              >
                {message}
              </p>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
