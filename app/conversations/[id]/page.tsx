import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import ArchivedConversation from "@/components/archived-conversation";

type Props = { params: Promise<{ id: string }> };
async function ArchiveContent({ params }: Props) {
  const [user, { id }] = await Promise.all([currentUser(), params]);
  if (!user) redirect("/login");
  return <ArchivedConversation id={id} userId={user.id} />;
}
export default function ArchivePage({ params }: Props) {
  return <Suspense fallback={<main className="mx-auto max-w-3xl p-8 text-[#815875]">Loading conversation…</main>}><ArchiveContent params={params} /></Suspense>;
}
