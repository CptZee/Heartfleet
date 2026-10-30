import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import ProfileDropdown from "@/components/layout/ProfileDropdown";

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
                        <ProfileDropdown username={user.username} />
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