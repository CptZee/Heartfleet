import { NextRequest } from "next/server";
import { GET as getChat } from "../route";

type Context = { params: Promise<{ id: string }> };

// Authenticated SSE bridge. It reuses the chat GET authorization on every poll,
// so no service-role key or unprotected Supabase channel reaches the browser.
export async function GET(request: NextRequest, context: Context) {
  const initial = await getChat(new NextRequest(new URL("../", request.url)), context);
  if (!initial.ok) return initial;

  const encoder = new TextEncoder();
  const signal = request.signal;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let previous = "";
      const send = (event: string, payload: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        // Keep each connection bounded; EventSource reconnects automatically.
        for (let i = 0; i < 15 && !signal.aborted; i++) {
          const response = i === 0 ? initial : await getChat(new NextRequest(new URL("../", request.url)), context);
          if (!response.ok) {
            send("access-ended", { status: response.status });
            break;
          }
          const body = await response.json();
          const signature = JSON.stringify([body.conversationId, body.messages]);
          if (signature !== previous) {
            send("chat-update", body);
            previous = signature;
          } else {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
          await new Promise<void>(resolve => {
            const timeout = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, 2000);
            const onAbort = () => { clearTimeout(timeout); resolve(); };
            signal.addEventListener("abort", onAbort, { once: true });
          });
        }
      } catch {
        // A disconnected browser or database failure ends this stream.
      } finally {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
