/**
 * List every paid endpoint in the facilitator's Bazaar (re-run on each deploy to re-verify).
 *   PAY_TO_ADDRESS=0x... NEXT_PUBLIC_SITE_URL=https://your.app pnpm bazaar:register
 * The facilitator calls each URL itself; its live 402 must pay PAY_TO_ADDRESS.
 */
import { ENDPOINTS } from "../lib/pricing";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const payTo = process.env.PAY_TO_ADDRESS ?? "";
const facilitator = process.env.FACILITATOR_URL || "https://whitechain.007575.xyz";
if (!site.startsWith("https://")) throw new Error("NEXT_PUBLIC_SITE_URL must be a public https:// URL");
if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) throw new Error("PAY_TO_ADDRESS is not a valid EVM address");

async function main() {
  const res = await fetch(`${facilitator}/discovery/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      payTo,
      name: "tinyx402",
      website: site,
      endpoints: ENDPOINTS.map((e) => ({ url: `${site}${e.path}`, method: e.method })),
    }),
  });
  const out = await res.json().catch(() => null);
  console.log(JSON.stringify(out, null, 2));
  if (!res.ok || !out?.listed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
