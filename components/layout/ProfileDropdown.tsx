"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type Props = {
    username: string;
};

export default function ProfileDropdown({ username }: Props) {
    const pathname = usePathname();
    const detailsRef = useRef<HTMLDetailsElement>(null);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (
                detailsRef.current &&
                !detailsRef.current.contains(event.target as Node)
            ) {
                detailsRef.current.open = false;
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && detailsRef.current) {
                detailsRef.current.open = false;
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (detailsRef.current) {
            detailsRef.current.open = false;
        }
    }, [pathname]);

    return (
        <details ref={detailsRef} className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-[#e9d5e3] bg-white px-3 py-2 text-sm font-medium text-[#815875] transition hover:bg-[#fff0f5] [&::-webkit-details-marker]:hidden">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f9e2ec] font-bold text-[#b97498]">
                    {username.charAt(0).toUpperCase()}
                </span>

                <span className="max-w-32 truncate">{username}</span>

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                >
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </summary>

            <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-[#e9d5e3] bg-white p-2 shadow-xl shadow-[#815875]/10">
                <div className="border-b border-[#f3e5ee] px-3 py-3">
                    <p className="text-xs text-[#b97498]">Signed in as</p>
                    <p className="truncate text-sm font-bold text-[#815875]">
                        {username}
                    </p>
                </div>

                <div className="py-2">
                    <Link
                        href="/rooms"
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#815875] transition hover:bg-[#fff0f5]"
                    >
                        <span aria-hidden="true">♡</span>
                        My Rooms
                    </Link>

                    <Link
                        href="/conversations"
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#815875] transition hover:bg-[#fff0f5]"
                    >
                        <span aria-hidden="true">✉</span>
                        Chat Archives
                    </Link>
                </div>

                <div className="border-t border-[#f3e5ee] pt-2">
                    <form action="/api/auth/logout" method="POST">
                        <button
                            type="submit"
                            className="w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-[#b97498] transition hover:bg-[#fff0f5]"
                        >
                            Logout
                        </button>
                    </form>
                </div>
            </div>
        </details>
    );
}