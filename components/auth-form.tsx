
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const register = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    if (register && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Something went wrong.");
        setBusy(false);
        return;
      }

      router.replace("/lobby");
      router.refresh();
    } catch {
      setError("Connection failed. Please try again.");
      setBusy(false);
    }
  }

  const inputClassName =
    "w-full rounded-xl border border-[#ead9e7] bg-white px-4 py-3 text-[#765773] placeholder:text-[#b4a1b4] outline-none transition focus:border-[#b97498] focus:ring-2 focus:ring-[#f3d8e5]";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-5 py-10 sm:py-16">
      <section className="w-full rounded-[2rem] border border-[#f0e0ed] bg-white/90 p-6 shadow-xl shadow-[#d6b8d0]/15 sm:p-10">
        <div className="text-center">
          <div className="text-4xl text-[#d58cab]">♡</div>

          <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-[#b7789c]">
            Heartfleet captains
          </p>

          <h1 className="mt-3 text-3xl font-bold text-[#765773]">
            {register ? "Join the fleet" : "Welcome back"}
          </h1>

          <p className="mt-2 text-sm text-[#817187]">
            {register
              ? "Create your captain account. No email needed."
              : "Your next adventure is waiting."}
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5">
          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-bold text-[#765773]"
            >
              Username
            </label>

            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClassName}
              placeholder="Captain name"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-bold text-[#765773]"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                register ? "new-password" : "current-password"
              }
              required
              minLength={register ? 8 : undefined}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClassName}
              placeholder="Your password"
            />
          </div>

          {/* Confirm Password */}
          {register && (
            <div>
              <label
                htmlFor="confirm"
                className="mb-2 block text-sm font-bold text-[#765773]"
              >
                Confirm password
              </label>

              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClassName}
                placeholder="Repeat password"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={busy}
            className="w-full cursor-pointer rounded-full bg-[#b97498] px-6 py-4 font-bold text-white shadow-md shadow-[#dfb5cb]/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#a45e83] hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {busy
              ? "Please wait..."
              : register
                ? "Create account ♡"
                : "Log in ♡"}
          </button>
        </form>

        {/* Switch Between Login and Registration */}
        <p className="mt-6 text-center text-sm text-[#817187]">
          {register
            ? "Already a captain? "
            : "New to Heartfleet? "}

          <Link
            className="font-bold text-[#a45e83] underline transition hover:text-[#815875]"
            href={register ? "/login" : "/register"}
          >
            {register ? "Log in" : "Create account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
