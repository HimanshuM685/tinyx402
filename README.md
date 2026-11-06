# tinyx402

[TinyFish](https://tinyfish.ai) web APIs (Search, Fetch, Agent, Research, Datasets and remote Browser sessions) resold **per request** for USDT on Whitechain through the [x402](https://x402.org) protocol. Callers need no API keys, accounts or billing, because the payment is the credential. The operator's single `TINYFISH_API_KEY` stays on the server.

- **API**: `/api/v1/*`. Every route is protected by x402 v2 and settled through the Whitechain facilitator `https://whitechain.007575.xyz`.
- **Playground** (`/playground`): connect a wallet, run any endpoint, and watch the 402, signature, retry and settlement as they happen.
- **Dashboard** (`/dashboard`): run and payment history, built from `PAYMENT-RESPONSE` receipts plus Postgres when configured.
- **Docs** (`/docs`): quick start, x402 explainer, API reference, and TypeScript, Python and curl examples. Also `/api/openapi` and `/llms.txt`.

| Endpoint | Method | Price (USDT) |
| --- | --- | --- |
| `/api/v1/search` | GET | 0.01 (`10000`) |
| `/api/v1/fetch` | POST | 0.015 (`15000`) |
| `/api/v1/agent/run` | POST | 0.05 (`50000`) |
| `/api/v1/agent/run-sse` | POST | 0.05 (`50000`) |
| `/api/v1/research` | POST | 0.20 (`200000`), or 0.50 for `mode: "max"` |
| `/api/v1/datasets` | POST | 0.02 (`20000`) × `target_rows` |
| `/api/v1/browser` | POST | 0.03 (`30000`) |

Requests that fail (any status of 400 or higher), including agent runs that end `FAILED`, are **never settled**. Research and Datasets run for 5–45 minutes, so their paid call settles when the job is accepted. They are followed on free endpoints (`/api/v1/research/{id}[/events]`, `/api/v1/datasets/{id}[/rows|/events]`).

## Stack

Next.js 16 (App Router) · `@x402/next` + `@x402/evm` (server) · `@x402/fetch` (client) · RainbowKit + wagmi + viem · TinyFish REST APIs (`lib/tinyfish.ts`) · Drizzle + Postgres (optional) · Tailwind v4 · MDX docs.

## Local setup

```bash
pnpm install
cp .env.example .env.local        # set PAY_TO_ADDRESS and TINYFISH_API_KEY
pnpm dev
```

Then open http://localhost:3000.

Minimum env for each feature:

| Feature | Needs |
| --- | --- |
| All paid routes | `PAY_TO_ADDRESS`, `TINYFISH_API_KEY` |
| WalletConnect (mobile) | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (MetaMask works without it) |
| Server-side history | `DATABASE_URL`, then `pnpm db:push` |

Research must be enabled on the TinyFish account, or TinyFish returns `403` and we return `503` (not charged).

Check that the server is gated:

```bash
curl -i "localhost:3000/api/v1/search?query=x402"     # 402 + PAYMENT-REQUIRED header
```

## Testnet funds (Whitechain Sepolia, chain 1874)

| | |
| --- | --- |
| RPC | `https://rpc.testnet.whitechain.io` |
| Explorer | https://explorer.testnet.whitechain.io |
| WBT faucet | https://faucet.testnet.whitechain.io (gas only; payers don't need it) |
| USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (6 decimals, EIP-712 `Tether USD` v1) |

Payers need **test USDT only**. Payments are EIP-3009 signatures, and the facilitator pays the gas. The test token's `mint` is owner-only, so ask the facilitator or token operator for an allocation, or have a holder transfer you some.

## Paying from code

```ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:1874", client: new ExactEvmScheme(account) }],
  spendControls: {
    allowedAssets: [{
      network: "eip155:1874",
      asset: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
      maxAmountPerPayment: "100000",
    }],
  },
});

const res = await paidFetch("https://your-domain.com/api/v1/search?query=example");
```

Ready-made clients in this repo:

```bash
PRIVATE_KEY=0x… TINYX402_URL=http://localhost:3000 pnpm pay search "x402"
PRIVATE_KEY=0x… pnpm pay agent https://news.ycombinator.com "top 3 titles" --stream
PRIVATE_KEY=0x… pnpm pay datasets "Coffee shops in Oakland with website" 10
PRIVATE_KEY=0x… python examples/python/pay.py "x402"    # pip install "x402[requests,evm]>=2.27"
```

## How payment is wired

- `lib/x402.ts` registers `ExactEvmScheme` for `eip155:1874` on an `x402ResourceServer` backed by `HTTPFacilitatorClient`. `paid(product)` builds each route config with the explicit price shape:

  ```ts
  price: {
    asset: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7", // Whitechain Sepolia USDT
    amount: "10000",
    extra: { name: "Tether USD", version: "1" },
  }
  ```

- `paidRoute()` wraps `withX402` from `@x402/next`, which settles only after a response with a status below 400. It adds rate limiting and the run log on top. Every route validates its input with zod, forwards it to TinyFish (`lib/tinyfish.ts`) with the operator key, and maps any upstream failure to a status of 400 or higher, so nothing is settled.
- Research and Datasets use a **dynamic x402 price** computed from the request body (`quote()` in `lib/pricing.ts`), for `mode` and `target_rows` respectively.
- `paidStream()` handles `/agent/run-sse`. `withX402` buffers the whole body before settling, so the server verifies first, opens the TinyFish stream, relays events, settles only on `COMPLETE`/`COMPLETED`, and sends the receipt as a final `payment` event.
- Prices live only in `lib/pricing.ts`. Network and asset constants live only in `lib/chains.ts`, which is the place to add mainnet (`eip155:1875`) later.

## Deploying to Vercel

1. Import the repo, set the env vars from `.env.example`, and set `NEXT_PUBLIC_SITE_URL` to your domain.
2. `agent/run`, `agent/run-sse` and the free `/events` streams set `maxDuration = 800` (Fluid compute). Agent runs are capped at 780 s through `agent_config.max_duration_seconds`.
3. Optional: add Postgres (Neon or Supabase), set `DATABASE_URL`, and run `pnpm db:push` once.

The app is plain Node with no browser binaries, so any host works (`pnpm build && pnpm start`).

## Operator economics

TinyFish bills the operator's wallet. Search (12,000/day) and Fetch (1,000 URLs/day) have free daily tiers. Research costs **$2 (deep) / $3 (max)** per completed run after 2 free runs a day, which is **above** the default x402 prices here. Datasets and Agent are metered. Adjust `lib/pricing.ts` before going to mainnet.

## Security notes

- Request bodies are parsed with zod objects that drop unknown keys, so account-scoped TinyFish options (vault credentials, browser profiles, `prior_run_id`/`session_id`) can never be used on the operator key.
- Free follow-up endpoints only accept `[A-Za-z0-9_-]` IDs. Run and dataset IDs are unguessable and returned only to the payer.
- Rate limiting is an in-memory per-IP window (`RATE_LIMIT_PER_MIN`), applied per instance. Use Redis or Upstash for multi-region deployments.
- `/api/runs` exposes only on-chain-equivalent data (endpoint, payer, amount, tx). Inputs and outputs are never returned.

## Scripts

| | |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `typecheck` | |
| `pnpm selftest` | asserts on prices and dynamic quotes, field stripping, SSE codec, agent relay |
| `pnpm pay <endpoint> …` | paid CLI client |
| `pnpm db:push` | create the `runs` table |

## License

MIT
