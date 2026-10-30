import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
// ONSU9WQILGxfdP7n
export default async function Header() {
    const user = await currentUser();

    return (
        <header className="border-b border-[#e9d5e3] bg-[#fff7fa]/80">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                <Link
                    href="/"
                    className="text-xl font-black text-[#815875]"
                >
                    Heartfleet<span className="text-[#e99eb8]">♡</span>
                </Link>

                <nav className="flex items-center gap-4">
                    {user ? (
                        <>
                            <Link href="/conversations" className="text-sm font-medium text-[#b97498] hover:underline">Conversations</Link>
                            <span className="text-sm text-[#815875]">
                                {user.username}
                            </span>

                            <form action="/api/auth/logout" method="POST">
                                <button
                                    type="submit"
                                    className="text-sm font-medium text-[#b97498]"
                                >
                                    Logout
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="text-sm text-[#815875]"
                            >
                                Login
                            </Link>

                            <Link
                                href="/register"
                                className="rounded-full bg-[#b97498] px-4 py-2 text-sm font-medium text-white"
                            >
                                Sign up
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}