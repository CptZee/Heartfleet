
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import LiveMatch from "@/components/live-match";

type Props = {
    params: Promise<{ id: string }>;
};

async function MatchContent({ params }: Props) {
    const user = await currentUser();

    if (!user) redirect("/login");

    const { id } = await params;

    return (
        <LiveMatch roomId={id} username={user.username} />
    );
}

export default function MatchPage({ params }: Props) {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-[60vh] items-center justify-center text-[#927e96]">
                    Preparing the battlefield...
                </main>
            }
        >
            <MatchContent params={params} />
        </Suspense>
    );
}
