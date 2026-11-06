export type Emit = (event: string, data: unknown) => void;

export const encodeSse = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export function sseResponse(run: (emit: Emit, signal: AbortSignal) => Promise<void>) {
  const enc = new TextEncoder();
  const abort = new AbortController();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const emit: Emit = (event, data) => {
        if (open) controller.enqueue(enc.encode(encodeSse(event, data)));
      };
      const ping = setInterval(() => open && controller.enqueue(enc.encode(": ping\n\n")), 15000);
      try {
        await run(emit, abort.signal);
      } finally {
        open = false;
        clearInterval(ping);
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  }) as import("next/server").NextResponse;
}

/** Parse an SSE byte stream into events. Used by clients (playground, scripts). */
export async function* readSse(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed: unknown = data;
      try {
        parsed = JSON.parse(data);
      } catch {}
      yield { event, data: parsed };
    }
  }
}
