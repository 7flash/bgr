/** GET /api/events — shared-cache Server-Sent Events process stream. */
import { getProcessSnapshots } from "../../../lib/process-store";

const INTERVAL_MS = 5_000;
const KEEPALIVE_MS = 15_000;

export async function GET(_req: Request) {
  const encoder = new TextEncoder();
  let closed = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (value: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(value));
        } catch {
          closed = true;
        }
      };

      const sendProcesses = async () => {
        if (closed) return;
        try {
          const data = await getProcessSnapshots();
          enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Keep the stream alive across transient OS/DB sampling failures.
        }
      };

      await sendProcesses();
      interval = setInterval(() => void sendProcesses(), INTERVAL_MS);
      keepaliveInterval = setInterval(
        () => enqueue(": keepalive\n\n"),
        KEEPALIVE_MS,
      );
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
      if (keepaliveInterval) clearInterval(keepaliveInterval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
