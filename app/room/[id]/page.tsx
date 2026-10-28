
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import RoomClient from "@/components/room-client";

type Props = {
    params: Promise<{ id: string }>;
};

async function RoomContent({ params }: Props) {
    const user = await currentUser();

    if (!user) {
        redirect("/login");
    }

    const { id } = await params;

    return <RoomClient roomId={id} />;
}

export default function RoomPage({ params }: Props) {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-[60vh] items-center justify-center">
                    <p className="animate-pulse text-[#927e96]">
                        Finding your voyage...
                    </p>
                </main>
            }
        >
            <RoomContent params={params} />
        </Suspense>
    );
}
