import "server-only";
import type { z } from "zod";
import type { AgentBody } from "./schemas";
import { readSse, type Emit } from "./sse";

// Our functions live at most ~800s, so cap the run below that.
export function agentPayload(input: z.infer<typeof AgentBody>) {
  return {
    ...input,
    api_integration: "tinyx402",
    agent_config: { ...input.agent_config, max_duration_seconds: Math.min(input.agent_config?.max_duration_seconds ?? 780, 780) },
  };
}

type AgentEvent = { type: string; status?: string; result?: unknown; error?: string; run_id?: string };

/** Relay TinyFish run-sse events; resolve with the result if COMPLETED, throw otherwise. */
export async function relayAgent(upstream: Response, emit: Emit) {
  for await (const { data } of readSse(upstream.body!)) {
    const ev = data as AgentEvent;
    if (!ev?.type || ev.type === "HEARTBEAT") continue;
    emit(ev.type.toLowerCase(), ev);
    if (ev.type === "COMPLETE") {
      if (ev.status === "COMPLETED") return ev;
      throw new Error(ev.error || `Run ${ev.status?.toLowerCase()}`);
    }
  }
  throw new Error("Upstream stream ended before the run completed");
}
