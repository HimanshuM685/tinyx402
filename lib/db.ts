import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { desc, eq } from "drizzle-orm";
import postgres from "postgres";
import { runs } from "./schema";

const url = process.env.DATABASE_URL;
const g = globalThis as unknown as { _db?: ReturnType<typeof drizzle> };
export const db = url ? (g._db ??= drizzle(postgres(url, { max: 5, prepare: false }))) : null;

export type RunRecord = {
  endpoint: string;
  amount: string;
  payer?: string;
  txHash?: string;
  network: string;
  status: number;
  input: unknown;
  output: unknown;
  durationMs: number;
};

const MAX_OUTPUT = 200_000;

export function recordRun(r: RunRecord) {
  if (!db) return;
  const out = JSON.stringify(r.output ?? null);
  db.insert(runs)
    .values({
      ...r,
      payer: r.payer?.toLowerCase(),
      output: out.length > MAX_OUTPUT ? { truncated: true } : r.output,
    })
    .catch((e) => console.error("recordRun failed:", e.message));
}

export async function listRuns(payer?: string, limit = 50) {
  if (!db) return null;
  const { id, endpoint, payer: p, amount, txHash, network, status, durationMs, createdAt } = runs;
  const q = db
    .select({ id, endpoint, payer: p, amount, txHash, network, status, durationMs, createdAt })
    .from(runs).orderBy(desc(runs.createdAt)).limit(limit);
  return payer ? q.where(eq(runs.payer, payer.toLowerCase())) : q;
}
