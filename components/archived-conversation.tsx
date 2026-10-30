"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Message = { id: string; sender_id: string | null; kind: string; body: string | null; created_at: string; hidden?: boolean };
type Page = { messages: Message[]; hasMore: boolean; nextCursor: string | null };

export default function ArchivedConversation({ id, userId }: { id: string; userId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const [undo, setUndo] = useState<{ messageId: string; until: number } | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!undo) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [undo]);

  useEffect(() => {
    if (undo && now >= undo.until) setUndo(null);
  }, [now, undo]);

  const hideUrl = (messageId: string) =>
    `/api/chat/conversations/${id}/messages/${messageId}/hide`;

  async function hideMessage(messageId: string) {
    if (hidingId) return;
    setHidingId(messageId); setError("");
    try {
      const response = await fetch(hideUrl(messageId), { method: "POST", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to hide message.");
      setMessages(old => old.map(m => m.id === messageId ? { ...m, body: null, hidden: true } : m));
      const until = Date.parse(result.undoUntil);
      setNow(Date.now());
      setUndo(Number.isFinite(until) && until > Date.now() ? { messageId, until } : null);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to hide message."); }
    finally { setHidingId(null); }
  }

  async function undoHide() {
    if (!undo || undoing || Date.now() >= undo.until) return;
    setUndoing(true); setError("");
    try {
      const response = await fetch(hideUrl(undo.messageId), { method: "DELETE", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Undo window expired.");
      // Re-fetch through the authorized API; never keep a local copy of hidden text.
      const messageId = undo.messageId;
      const responsePage = await fetch(`/api/chat/conversations/${id}`, { cache: "no-store" });
      if (responsePage.ok) {
        const page: Page = await responsePage.json();
        const restored = page.messages.find(m => m.id === messageId);
        if (restored) setMessages(old => old.map(m => m.id === messageId ? restored : m));
      }
      setUndo(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to undo hide."); setUndo(null); }
    finally { setUndoing(false); }
  }

  const load = useCallback(async (before?: string, signal?: AbortSignal) => {
    const response = await fetch(`/api/chat/conversations/${id}${before ? `?before=${encodeURIComponent(before)}` : ""}`, { cache: "no-store", signal });
    const result: Page & { error?: string } = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load conversation.");
    setMessages(old => before ? [...result.messages, ...old.filter(m => !result.messages.some(n => n.id === m.id))] : result.messages);
    setCursor(result.nextCursor);
    setHasMore(result.hasMore);
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setMessages([]); setError("");
    void load(undefined, controller.signal).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load conversation."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);

  async function loadOlder() {
    if (!cursor || busyRef.current) return;
    busyRef.current = true; setOlderLoading(true);
    try { await load(cursor); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load older messages."); }
    finally { setOlderLoading(false); busyRef.current = false; }
  }

  async function remove() {
    if (removing) return;
    setRemoving(true); setError("");
    try {
      const response = await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to remove conversation.");
      router.replace("/conversations"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to remove conversation."); setRemoving(false); }
  }

  return <main className="mx-auto w-full max-w-3xl px-5 py-10 text-[#51475d] sm:px-8">
    <Link href="/conversations" className="text-sm font-semibold text-[#b97498] hover:underline">← All conversations</Link>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black text-[#815875]">Previous Conversation ♡</h1><p className="mt-1 text-xs text-[#927e96]">Archived · Read-only · Private</p></div><button type="button" onClick={() => setConfirm(true)} className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Remove from my archive</button></div>
    {error && <div role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <section aria-label="Archived messages" className="mt-6 rounded-3xl border border-[#efdce8] bg-[#fff9fc] p-4 sm:p-6">
      {loading ? <p role="status" className="text-sm text-[#927e96]">Loading messages…</p> : <>
        {hasMore && <div className="mb-5 text-center"><button disabled={olderLoading} onClick={() => void loadOlder()} className="rounded-full border border-[#e4bfd4] px-4 py-2 text-xs font-semibold text-[#815875] disabled:opacity-50">{olderLoading ? "Loading…" : "Load older messages"}</button></div>}
        {messages.length === 0 && <p className="py-10 text-center text-sm text-[#927e96]">No messages in this conversation.</p>}
        <div className="space-y-3">{messages.map(m => <div key={m.id} className={`flex ${m.sender_id === userId ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.sender_id === userId ? "bg-[#f6dce9] text-[#80516c]" : "bg-white text-[#51475d]"}`}><p className="mb-1 text-[11px] opacity-70">{m.kind === "system" ? "Room notice" : m.sender_id === userId ? "You" : "Other Captain"} · {new Date(m.created_at).toLocaleString()}</p><p className={`whitespace-pre-wrap break-words ${m.hidden ? "italic opacity-60" : ""}`}>{m.hidden ? "Message hidden for you" : m.body || ""}</p>{!m.hidden && m.kind === "message" && <button type="button" disabled={hidingId !== null} onClick={() => void hideMessage(m.id)} className="mt-2 text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100 disabled:opacity-30" aria-label="Hide this message from my archive">{hidingId === m.id ? "Hiding…" : "Hide for me"}</button>}</div></div>)}</div>
      </>}
    </section>
    {undo && <div role="status" className="sticky bottom-4 z-20 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#e4bfd4] bg-white p-4 shadow-lg"><span className="text-sm text-[#815875]">Message hidden · {Math.max(0, Math.ceil((undo.until - now) / 1000))}s to undo</span><button type="button" onClick={() => void undoHide()} disabled={undoing || now >= undo.until} className="rounded-full bg-[#b97498] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{undoing ? "Undoing…" : "Undo"}</button></div>}
    <p className="mt-4 text-center text-xs text-[#927e96]">This conversation is read-only. Removing it cannot be undone, and does not affect the other participant's archive.</p>
    {confirm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !removing) setConfirm(false); }}><div role="alertdialog" aria-modal="true" aria-labelledby="archive-remove-title" aria-describedby="archive-remove-desc" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"><h2 id="archive-remove-title" className="text-lg font-bold text-[#815875]">Remove this conversation?</h2><p id="archive-remove-desc" className="mt-3 text-sm leading-6 text-[#817187]">You will permanently lose access to this conversation. The other participant keeps their archive if they have not removed it. If neither participant retains it, the conversation is permanently deleted.</p><div className="mt-6 flex justify-end gap-3"><button disabled={removing} onClick={() => setConfirm(false)} className="rounded-full border px-4 py-2 text-sm">Cancel</button><button disabled={removing} onClick={() => void remove()} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{removing ? "Removing…" : "Remove permanently"}</button></div></div></div>}
  </main>;
}
