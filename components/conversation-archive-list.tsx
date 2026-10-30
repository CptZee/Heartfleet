"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Archive = { id: string; archivedAt: string | null; createdAt: string; otherParticipant: { displayName: string } | null };

export default function ConversationArchiveList() {
  const [items, setItems] = useState<Archive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/chat/conversations", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load conversations.");
      setItems(data.conversations ?? []);
    } catch (e) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : "Unable to load conversations.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  return <main className="mx-auto w-full max-w-3xl px-5 py-10 text-[#51475d] sm:px-8">
    <Link href="/lobby" className="text-sm font-semibold text-[#b97498] hover:underline">← Back to lobby</Link>
    <h1 className="mt-5 text-3xl font-black text-[#815875]">Your Conversations ♡</h1>
    <p className="mt-2 text-sm leading-6 text-[#817187]">Private memories from your previous voyages. Archived conversations are read-only, even after a room closes.</p>
    {loading ? <p role="status" className="mt-8 text-sm">Loading conversations…</p> : error ? <div role="alert" className="mt-8 rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">{error} <button className="ml-2 underline" onClick={() => void load()}>Try again</button></div> : items.length === 0 ? <div className="mt-8 rounded-3xl border border-[#efdce8] bg-[#fff7fb] p-8 text-center"><p className="font-semibold text-[#815875]">No archived conversations yet</p><p className="mt-2 text-sm text-[#817187]">When a voyage ends, conversations you keep will appear here.</p></div> : <ul className="mt-8 space-y-3">{items.map(item => <li key={item.id}><Link href={`/conversations/${item.id}`} className="block rounded-2xl border border-[#efdce8] bg-[#fff9fc] p-5 transition hover:border-[#d9a8c2] hover:bg-[#fff0f7]"><div className="flex items-center justify-between gap-3"><span className="font-bold text-[#815875]">{item.otherParticipant?.displayName || "Former Captain"}</span><span className="text-xs text-[#927e96]">{new Date(item.archivedAt || item.createdAt).toLocaleDateString()}</span></div><p className="mt-2 text-xs text-[#927e96]">Archived · Read-only</p></Link></li>)}</ul>}
  </main>;
}
