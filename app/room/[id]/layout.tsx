import type { Metadata } from "next";
import { Suspense } from "react";
import FloatingRoomChat from "@/components/floating-room-chat";

export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

type RoomLayoutProps = {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
};

async function RoomChat({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    return <FloatingRoomChat roomId={id} />;
}

export default function RoomLayout({
    children,
    params,
}: RoomLayoutProps) {
    return (
        <>
            {children}

            <Suspense fallback={null}>
                <RoomChat params={params} />
            </Suspense>
        </>
    );
}