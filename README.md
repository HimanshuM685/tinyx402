# tinyx402

Web agent APIs (Search, Fetch, Browser Agent, Research, remote Browser sessions) paid **per request** with USDT on Whitechain through the [x402](https://x402.org) protocol. There are no API keys, accounts or billing. The payment is the credential.

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
| `/api/v1/research` | POST | 0.20 (`200000`) |
| `/api/v1/browser` | POST | 0.03 (`30000`) |

Requests that fail (any status of 400 or higher) are **never settled**.

## Stack

Next.js 16 (App Router) · `@x402/next` + `@x402/evm` (server) · `@x402/fetch` (client) · RainbowKit + wagmi + viem · Playwright (`playwright-core`) + Mozilla Readability · Claude (`@anthropic-ai/sdk`) for agent and research · Drizzle + Postgres (optional) · Tailwind v4 · MDX docs.

## Local setup

```bash
pnpm install
cp .env.example .env.local        # set PAY_TO_ADDRESS at minimum
pnpm exec playwright-core install chromium   # local browser for fetch(render) / agent
pnpm dev
```

Then open http://localhost:3000.

Minimum env for each feature:

| Feature | Needs |
| --- | --- |
| All paid routes | `PAY_TO_ADDRESS` |
| Search | nothing (DuckDuckGo fallback); `BRAVE_API_KEY` or `TAVILY_API_KEY` recommended |
| Fetch | nothing locally (`render: false` needs no browser at all) |
| Agent, Research | `ANTHROPIC_API_KEY` |
| Browser sessions | `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` |
| WalletConnect (mobile) | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (MetaMask works without it) |
| Server-side history | `DATABASE_URL`, then `pnpm db:push` |

Check that the server is gated:

```bash
curl -i "localhost:3000/api/v1/search?q=x402"     # 402 + PAYMENT-REQUIRED header
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

const res = await paidFetch("https://your-domain.com/api/v1/search?q=example");
```

Ready-made clients in this repo:

```bash
PRIVATE_KEY=0x… TINYX402_URL=http://localhost:3000 pnpm pay search "x402"
PRIVATE_KEY=0x… pnpm pay agent https://news.ycombinator.com "top 3 titles" --stream
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

- `paidRoute()` wraps `withX402` from `@x402/next`, which settles only after a response with a status below 400. It adds rate limiting and the run log on top.
- `paidStream()` handles the SSE routes. `withX402` buffers the whole body before settling, so for streams the server verifies first, streams events, settles after success, and sends the receipt as a final `payment` event.
- Prices live only in `lib/pricing.ts`. Network and asset constants live only in `lib/chains.ts`, which is the place to add mainnet (`eip155:1875`) later.

## Deploying to Vercel

1. Import the repo, set the env vars from `.env.example`, and set `NEXT_PUBLIC_SITE_URL` to your domain.
2. **Set `BROWSER_WS_ENDPOINT`** (Browserless, Steel and similar). Serverless functions can't launch Chromium.
3. Agent and research routes set `maxDuration = 300`, which needs Fluid compute or the Pro plan for runs longer than 60 s.
4. Optional: add Postgres (Neon or Supabase), set `DATABASE_URL`, and run `pnpm db:push` once.

For any Node host (Railway, Fly, Docker), use `pnpm build && pnpm start`. Local Chromium works there.

## Security notes

- SSRF guard: fetch, agent and browser navigation refuse private, loopback, link-local and metadata addresses, and re-check every redirect hop (`lib/safe-url.ts`).
- The agent treats page content as data, never enters credentials, and runs in a fresh browser context each time.
- Rate limiting is an in-memory per-IP window (`RATE_LIMIT_PER_MIN`), applied per instance. Use Redis or Upstash for multi-region deployments.
- `/api/runs` exposes only on-chain-equivalent data (endpoint, payer, amount, tx). Inputs and outputs are never returned.

## Scripts

| | |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `typecheck` | |
| `pnpm selftest` | asserts on price config, SSE codec, search parsing, SSRF guard |
| `pnpm pay <endpoint> …` | paid CLI client |
| `pnpm db:push` | create the `runs` table |

## License

MIT
