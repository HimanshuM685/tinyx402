import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export const anthropic = new Anthropic();

type Params = Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, "model" | "betas" | "fallbacks">;

/** One Messages call with server-side refusal fallback enabled. */
export async function claude(params: Params) {
  const res = await anthropic.beta.messages.create({
    model: MODEL,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    ...params,
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined this request");
  return res;
}

export const textOf = (m: Anthropic.Beta.BetaMessage) =>
  m.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();

