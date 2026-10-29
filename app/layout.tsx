import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { Suspense } from "react";
import Header from "@/components/layout/Header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),


  title: "Heartfleet — A Battle of Ships & Hearts",

  description:
    "A little strategy, a little chemistry. Challenge someone special to a game of Battleship where every hit brings you closer.",

  openGraph: {
    type: "website",
    siteName: "Heartfleet",
    title: "Heartfleet — A Battle of Ships & Hearts",
    description:
      "A little strategy, a little chemistry. Challenge someone special to a game of Battleship where every hit brings you closer.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Heartfleet — A Battle of Ships & Hearts",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Heartfleet — A Battle of Ships & Hearts",
    description:
      "A little strategy, a little chemistry. Challenge someone special to a game of Battleship where every hit brings you closer.",
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#fffafc] text-[#51475d] antialiased">
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-[#fffafc] via-[#fdf7fc] to-[#edf8fb]">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <span className="absolute left-[2%] top-40 text-5xl text-[#f2d2df] motion-safe:animate-pulse">♡</span>
            <span className="absolute right-[3%] top-[34%] text-6xl text-[#d4eaf3] motion-safe:animate-bounce">✧</span>
            <span className="absolute left-[4%] top-[65%] text-4xl text-[#e6d7f5] motion-safe:animate-pulse">✦</span>
            <span className="absolute right-[5%] bottom-40 text-5xl text-[#f1c9da] motion-safe:animate-pulse">♡</span>
          </div>
          <Suspense
            fallback={
              <header className="h-[72px] border-b border-[#e9d5e3] bg-[#fff7fa]/80" />
            }
          >
            <Header />
          </Suspense>
          <div className="relative z-10 flex flex-1 flex-col pt-8">{children}</div>
          <footer className="relative border-t border-[#e9d5e3] bg-[#fff7fa]/80 px-6 py-8 sm:px-12">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
              {/* Heartfleet Branding */}
              <div>
                <p className="text-lg font-black tracking-tight text-[#815875]">
                  Heartfleet<span className="text-[#e99eb8]">♡</span>
                </p>
                <p className="mt-1 text-xs text-[#927e96]">
                  A little battle. A lot of heart.
                </p>
              </div>

              {/* Creator Signature */}
              <div className="text-center sm:text-right">
                <p className="text-xs text-[#a58ca2]">
                  Made with a little code and a lot of heart by
                </p>

                <p
                  className="mt-1 font-serif text-lg italic tracking-wide text-[#a66c91]"
                >
                  Aaron James R. Mission
                  <span className="ml-1 text-[#e99eb8]">♡</span>
                </p>

                <p className="mt-1 text-[10px] tracking-widest text-[#b19bb0]">
                  © 2026 HEARTFLEET
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
