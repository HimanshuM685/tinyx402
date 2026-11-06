import { paidStream } from "@/lib/x402";
import { AgentBody } from "@/lib/schemas";
import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = paidStream(
  "agent",
  "Streaming goal-based browser automation (SSE)",
  AgentBody,
  (input, emit, signal) => runAgent(input, emit, signal),
);
