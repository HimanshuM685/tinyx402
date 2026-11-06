import { paidStream } from "@/lib/x402";
import { AgentBody } from "@/lib/schemas";
import { TF, tf } from "@/lib/tinyfish";
import { agentPayload, relayAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby max

export const POST = paidStream(
  "agent",
  "Streaming goal-based browser automation (SSE)",
  AgentBody,
  (input, signal) =>
    tf(`${TF.agent}/v1/automation/run-sse`, {
      method: "POST",
      body: JSON.stringify(agentPayload(input)),
      headers: { Accept: "text/event-stream" },
      signal,
    }),
  relayAgent,
);
