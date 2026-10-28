
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import FleetPlacement from "@/components/fleet-placement";

type Props = {
    params: Promise<{ id: string }>;
};

async function PlacementContent({ params }: Props) {
    const user = await currentUser();

    if (!user) redirect("/login");

    const { id } = await params;

    return (
        <FleetPlacement
            roomId={id}
            username={user.username}
        />
    );
}

export default function PlacementPage({ params }: Props) {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-[60vh] items-center justify-center text-[#927e96]">
                    Preparing your fleet...
                </main>
            }
        >
            <PlacementContent params={params} />
        </Suspense>
    );
}
