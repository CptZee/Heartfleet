"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = { id: string; sender_id: string | null; kind: "message" | "system"; body: string; created_at: string };
type ChatResponse = { messages?: Message[]; viewerId?: string; conversationId?: string; nextCursor?: string | null; hasMore?: boolean; error?: string };

export default function FloatingRoomChat({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);
  const [availability, setAvailability] = useState<"loading" | "ready" | "waiting" | "unavailable">("loading");
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastSeen = useRef<string | null>(null);
  const currentConversation = useRef("");
  const openRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { openRef.current = open; if (open) { setUnread(0); lastSeen.current = messagesRef.current.at(-1)?.id ?? null; } }, [open]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/chat`, { cache: "no-store", signal });
      if (signal?.aborted) return;
      if (res.status === 409) { setAvailability("waiting"); setError(""); return; }
      if (res.status === 401 || res.status === 403 || res.status === 404) { setAvailability("unavailable"); return; }
      const data: ChatResponse = await res.json();
      if (!res.ok || !data.conversationId || !data.messages) throw new Error(data.error || "Unable to load chat.");
      const changed = currentConversation.current !== data.conversationId;
      if (changed) {
        currentConversation.current = data.conversationId;
        setMessages(data.messages);
        messagesRef.current = data.messages;
        setCursor(data.nextCursor ?? null);
        setHasMore(!!data.hasMore);
        setUnread(0);
        lastSeen.current = data.messages.at(-1)?.id ?? null;
        setDraft("");
      } else {
        const previous = new Set(messagesRef.current.map(m => m.id));
        const additions = data.messages.filter(m => !previous.has(m.id));
        if (additions.length) {
          const merged = [...messagesRef.current, ...additions].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
          messagesRef.current = merged;
          setMessages(merged);
          if (!openRef.current) setUnread(n => n + additions.filter(m => m.sender_id !== data.viewerId).length);
        }
      }
      setViewerId(data.viewerId ?? "");
      setAvailability("ready");
      setError("");
    } catch (e) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : "Unable to connect to chat.");
    }
  }, [roomId]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    // EventSource reconnects automatically; the endpoint checks session and
    // room membership throughout the stream. No browser Supabase key needed.
    const source = new EventSource(`/api/rooms/${encodeURIComponent(roomId)}/chat/events`);
    const onUpdate = () => { if (!document.hidden) void refresh(controller.signal); };
    const onEnded = () => { source.close(); void refresh(controller.signal); };
    source.addEventListener("chat-update", onUpdate);
    source.addEventListener("access-ended", onEnded);
    const onVisibility = () => { if (!document.hidden) void refresh(controller.signal); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      controller.abort();
      source.removeEventListener("chat-update", onUpdate);
      source.removeEventListener("access-ended", onEnded);
      source.close();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, roomId]);

  useEffect(() => {
    if (open && nearBottom.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const older = async () => {
    if (!cursor || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    const container = listRef.current;
    const height = container?.scrollHeight ?? 0;
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/chat?before=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      const data: ChatResponse = await res.json();
      if (!res.ok || data.conversationId !== currentConversation.current || !data.messages) throw new Error(data.error || "Unable to load earlier messages.");
      const existing = new Set(messagesRef.current.map(m => m.id));
      const merged = [...data.messages.filter(m => !existing.has(m.id)), ...messagesRef.current];
      messagesRef.current = merged;
      setMessages(merged);
      setCursor(data.nextCursor ?? null);
      setHasMore(!!data.hasMore);
      requestAnimationFrame(() => { if (container) container.scrollTop = container.scrollHeight - height + container.scrollTop; });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load earlier messages."); }
    finally { setLoadingOlder(false); }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || pending || availability !== "ready" || body.length > 500) return;
    setPending(true);
    setError("");
    const clientNonce = crypto.randomUUID();
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, clientNonce }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Message could not be sent.");
      setDraft(value => value === draft ? "" : value);
      nearBottom.current = true;
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Message could not be sent. Please retry."); }
    finally { setPending(false); }
  };

  return <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
    {!open ? <button type="button" onClick={() => setOpen(true)} aria-label={`Open room chat${unread ? `, ${unread} unread messages` : ""}`} className="relative rounded-full bg-[#b97498] px-5 py-3 font-semibold text-white shadow-xl hover:bg-[#a65d83] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b97498]">
      ♡ Chat {unread > 0 && <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-[#8c4a6c]">{unread > 9 ? "9+" : unread}</span>}
    </button> : <section role="dialog" aria-label="Room chat" className="flex h-[min(560px,calc(100dvh-2rem))] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-[#edd7e4] bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-[#f2e4ec] bg-[#fff7fb] px-4 py-3">
        <div><h2 className="font-semibold text-[#81516b]">♡ Room Chat</h2><p className="text-xs text-[#9b8091]">{availability === "ready" ? "Private conversation" : availability === "waiting" ? "Waiting for another Captain" : availability === "loading" ? "Connecting…" : "Unavailable"}</p></div>
        <button type="button" aria-label="Minimize chat" onClick={() => setOpen(false)} className="rounded-full px-3 py-1 text-xl text-[#81516b] hover:bg-[#f6e7ef]">−</button>
      </header>
      <div ref={listRef} onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90; if (nearBottom.current) setUnread(0); }} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fffafd] p-4" aria-live="polite" aria-relevant="additions">
        {hasMore && <button type="button" disabled={loadingOlder} onClick={older} className="w-full text-xs font-medium text-[#9b6280] underline">{loadingOlder ? "Loading…" : "Load earlier messages"}</button>}
        {availability === "waiting" && <p className="pt-12 text-center text-sm text-[#9b8091]">Chat starts when another Captain joins your voyage.</p>}
        {availability === "unavailable" && <p className="pt-12 text-center text-sm text-[#9b8091]">This room chat is no longer available.</p>}
        {messages.map(m => <div key={m.id} className={`flex ${m.sender_id === viewerId ? "justify-end" : "justify-start"}`}>
          {m.kind === "system" ? <p className="w-full text-center text-xs text-[#9b8091]">{m.body}</p> : <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === viewerId ? "bg-[#f6dce9] text-[#80516c]" : "border border-[#f1e4ed] bg-white text-[#604c5b]"}`}>
            <p className="mb-1 text-[10px] opacity-70">{m.sender_id === viewerId ? "You" : "Other Captain"} · {new Date(m.created_at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</p>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
          </div>}
        </div>)}
      </div>
      {error && <p role="alert" className="px-4 py-1 text-xs text-red-700">{error}</p>}
      <div className="border-t border-[#f2e4ec] p-3">
        <div className="flex items-end gap-2">
          <textarea ref={textareaRef} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } if (e.key === "Escape") setOpen(false); }} rows={2} maxLength={500} disabled={availability !== "ready" || pending} placeholder={availability === "ready" ? "Write a message…" : "Chat is unavailable"} aria-label="Chat message" className="min-h-12 flex-1 resize-none rounded-xl border border-[#ead6e2] p-2 text-sm text-[#604c5b] outline-[#b97498] disabled:bg-gray-50" />
          <button type="button" onClick={() => void send()} disabled={!draft.trim() || pending || availability !== "ready"} className="rounded-xl bg-[#b97498] px-3 py-3 text-sm font-semibold text-white disabled:opacity-40">Send</button>
        </div>
        <p className="mt-1 text-right text-[10px] text-[#9b8091]">{draft.length}/500</p>
      </div>
    </section>}
  </div>;
}
