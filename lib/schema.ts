import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpoint: text("endpoint").notNull(),
    payer: text("payer"),
    amount: text("amount").notNull(),
    txHash: text("tx_hash"),
    network: text("network").notNull(),
    status: integer("status").notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("runs_payer_idx").on(t.payer), index("runs_created_idx").on(t.createdAt)],
);
