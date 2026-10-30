import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import ConversationArchiveList from "@/components/conversation-archive-list";

async function ArchiveContent() {
  if (!(await currentUser())) redirect("/login");
  return <ConversationArchiveList />;
}

export default function ConversationsPage() {
  return <Suspense fallback={<main className="mx-auto max-w-3xl p-8 text-[#815875]">Loading your conversations…</main>}><ArchiveContent /></Suspense>;
}
