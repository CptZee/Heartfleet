import Link from "next/link";
import { GAME_RULES } from "@/constants/game";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Heartfleet",
  url: siteUrl,
  description:
    "A free online two-player Battleship-style game with romantic questions and social interactions.",
  image: new URL("/og-image.png", siteUrl).toString(),
  genre: ["Strategy", "Casual", "Social"],
  gamePlatform: "Web Browser",
  numberOfPlayers: {
    "@type": "QuantitativeValue",
    minValue: 2,
    maxValue: 2,
  },
  inLanguage: "en",
  isAccessibleForFree: true,
};

export function HeartfleetStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData)
          .replace(/</g, "\\u003c"),
      }}
    />
  );
}

export default function HomePage() {
  return (
    <main className="relative mx-auto w-full max-w-[1440px] px-5 pb-16 sm:px-8 lg:px-12">
      <HeartfleetStructuredData />
      <section className="relative w-full min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#ffedf3] via-[#f9f0fb] to-[#e4f5fa] px-4 py-12 shadow-sm sm:rounded-[2.5rem] sm:px-12 sm:py-16 lg:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute left-8 top-10 text-5xl text-[#efb6cb]"
        >
          ♡
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute bottom-12 right-12 text-6xl text-[#bddce9]"
        >
          ✦
        </div>

        <div className="relative z-10 grid min-w-0 grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">

          {/* Hero Content */}
          <div className="min-w-0 text-center lg:text-left">
            <p className="mx-auto mb-5 max-w-full text-[10px] font-bold uppercase tracking-[0.15em] text-[#aa7396] sm:text-xs sm:tracking-[0.24em] lg:mx-0">
              A little battle. A lot of heart.
            </p>

            <h1 className="max-w-full text-[clamp(2.5rem,11vw,6rem)] font-black leading-[1.1] tracking-tight text-[#815875] sm:text-7xl xl:text-8xl">
              Heartfleet
              <span className="ml-2 text-[#e99eb8]">♡</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#796b83] sm:text-lg lg:mx-0">
              Play Battleship online with someone special. Heartfleet is a free,
              two-player strategy game where classic naval battles meet thoughtful
              questions and meaningful conversations. Sink ships, earn Hearts,
              and discover a little more about each other.
            </p>

            <Link
              href="/lobby"
              className="mt-9 inline-flex max-w-full items-center justify-center rounded-full bg-[#b97498] px-6 py-4 text-center text-sm font-bold text-white shadow-lg shadow-[#dfb5cb]/40 transition hover:-translate-y-0.5 hover:bg-[#a45e83] sm:px-8 sm:text-base"
            >
              Play Heartfleet Together →
            </Link>

            <p className="mt-5 text-xs leading-relaxed text-[#927e96] sm:text-sm">
              Free to play · Two players · Private rooms · Around 30–45 minutes
            </p>
          </div>

          {/* Decorative Battleship Board */}
          <div className="relative mx-auto w-full min-w-0 max-w-md rounded-[1.5rem] border border-white/80 bg-white/60 p-3 shadow-xl shadow-[#c9a7c1]/20 backdrop-blur-sm sm:rounded-[2rem] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2 text-[10px] font-bold tracking-wider text-[#9d7895] sm:text-xs sm:tracking-widest">
              <span>YOUR LITTLE OCEAN</span>
              <span className="shrink-0 animate-pulse text-[#d67c9d]">
                ♥ ♥ ♥
              </span>
            </div>

            <div
              aria-label="Decorative Battleship game board"
              className="grid w-full min-w-0 grid-cols-10 gap-1 sm:gap-1.5"
            >
              {Array.from({ length: 100 }, (_, index) => (
                <span
                  key={index}
                  className={`aspect-square min-w-0 rounded-[3px] transition-transform hover:scale-110 sm:rounded-md ${[22, 23, 24, 25, 46, 56, 66, 73, 74, 75].includes(index)
                    ? "bg-[#9a9bc9]"
                    : [18, 38, 58].includes(index)
                      ? "bg-[#e89bb3]"
                      : [7, 8, 9, 17].includes(index)
                        ? "bg-[#b7d9e7]"
                        : "bg-[#d9edf3]"
                    }`}
                />
              ))}
            </div>

            <p className="mt-4 text-center text-xs text-[#927e96]">
              Every move brings you closer ♡
            </p>

            <span
              aria-hidden
              className="pointer-events-none absolute -right-2 -top-5 animate-bounce text-3xl text-[#d795b4] motion-reduce:animate-none sm:-right-5 sm:-top-7 sm:text-4xl"
            >
              ♡
            </span>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-5xl py-20 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b7789c]">What is Heartfleet?</p>
        <h2 className="mt-3 text-3xl font-bold text-[#765773] sm:text-4xl">A familiar game, with a softer side.</h2>
        <p className="mt-5 leading-8 text-[#766b7e]">Heartfleet keeps classic Battleship at its core: hidden ships, alternating attacks, hits, misses, and a race to sink the other fleet. Its twist is a gentle social layer. At special moments, Heartbeats invite you to answer thoughtful, playful questions together—without interrupting the competition.</p>
      </section>

      <section id="rules" className="pb-20">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b7789c]">The basics</p>
          <h2 className="mt-3 text-3xl font-bold text-[#765773]">
            How to Play Heartfleet
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{GAME_RULES.map(rule => <article key={rule.number} className="rounded-3xl border border-[#f1e3ec] bg-white p-7 shadow-sm"><span className="text-sm font-bold text-[#cf91b0]">{rule.number}</span><h3 className="mt-3 text-xl font-bold text-[#765773]">{rule.title}</h3><p className="mt-3 leading-7 text-[#766b7e]">{rule.text}</p></article>)}</div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] bg-[#f3eafa] px-5 py-7 sm:px-8 sm:py-9 lg:px-12 lg:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a77ca9]">
          The Heartfleet twist
        </p>

        <h2 className="mt-2 text-2xl font-bold text-[#765773] sm:text-3xl">
          Meet the Heartbeats ♡
        </h2>

        <div className="mt-5 grid gap-4 sm:gap-5 md:grid-cols-3 md:gap-6">
          <div className="min-w-0">
            <h3 className="font-bold text-[#765773]">
              Special moments
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#766b7e]">
              Heartbeats appear at meaningful points in the match, not after
              every turn.
            </p>
          </div>

          <div className="min-w-0">
            <h3 className="font-bold text-[#765773]">
              Opponent&apos;s choice
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#766b7e]">
              Your opponent chooses from curated questions or player-written
              prompts.
            </p>
          </div>

          <div className="min-w-0">
            <h3 className="font-bold text-[#765773]">
              No pressure
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#766b7e]">
              The default tone is gentle and wholesome. Heartbeats don&apos;t
              expire, and a moment without enough Hearts simply passes.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 text-center"><h2 className="text-3xl font-bold text-[#765773]">Ready to meet on the water?</h2><p className="mt-3 text-[#766b7e]">Bring a friend, a crush, or someone you'd like to know better.</p><Link href="/lobby" className="mt-7 inline-flex rounded-full bg-[#b97498] px-8 py-4 font-bold text-white transition hover:bg-[#a45e83]">Enter the lobby →</Link></section>

    </main>
  );
}
