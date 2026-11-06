# tinyx402

[TinyFish](https://tinyfish.ai) web APIs (Search, Fetch, Agent, Research, Datasets and remote Browser sessions) resold **per request** for stablecoins on [two chains](#chains) through the [x402](https://x402.org) protocol. Callers need no API keys, accounts or billing, because the payment is the credential. The operator's single `TINYFISH_API_KEY` stays on the server.

- **API**: `/api/<chain>/v1/*` — endpoints are per chain (`arc`, `whitechain`). The prefix decides the asset, so each `402` quotes exactly one and a caller is never surprised by which chain it must pay on. Swap the prefix to switch chains; nothing else changes. The old `/api/v1/*` answers `410` with the replacements.
- **Playground** (`/playground`): connect a wallet, run any endpoint, and watch the 402, signature, retry and settlement as they happen.
- **Dashboard** (`/dashboard`): run and payment history, built from `PAYMENT-RESPONSE` receipts plus Postgres when configured.
- **Docs** (`/docs`): quick start, x402 explainer, API reference, and TypeScript, Python and curl examples. Also `/api/openapi` and `/llms.txt`.

| Endpoint | Method | Price |
| --- | --- | --- |
| `/api/<chain>/v1/search` | GET | 0.01 (`10000`) |
| `/api/<chain>/v1/fetch` | POST | 0.015 (`15000`) |
| `/api/<chain>/v1/agent/run` | POST | 0.05 (`50000`) |
| `/api/<chain>/v1/agent/run-sse` | POST | 0.05 (`50000`) |
| `/api/<chain>/v1/research` | POST | 0.20 (`200000`), or 0.50 for `mode: "max"` |
| `/api/<chain>/v1/datasets` | POST | 0.02 (`20000`) × `target_rows` |
| `/api/<chain>/v1/browser` | POST | 0.03 (`30000`) |

Requests that fail (any status of 400 or higher), including agent runs that end `FAILED`, are **never settled**. Research and Datasets run for 5–45 minutes, so their paid call settles when the job is accepted. They are followed on free endpoints (`/api/arc/v1/research/{id}[/events]`, `/api/arc/v1/datasets/{id}[/rows|/events]`).

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
| Server-side history | `DATABASE_URL`, then `pnpm db:push` |
| Google login + platform wallets (web app only) | Neon `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `WALLET_ENCRYPTION_KEY`, then `pnpm db:push` |

Research must be enabled on the TinyFish account, or TinyFish returns `403` and we return `503` (not charged).

Check that the server is gated:

```bash
curl -i "localhost:3000/api/arc/v1/search?query=x402"     # 402 + PAYMENT-REQUIRED header
```

## Chains

Each chain has its own URL prefix, its own asset and its own facilitator. Prices are the same number of base units on both, because both assets use 6 decimals.

| | Prefix | Example |
| --- | --- | --- |
| Arc Testnet | `arc` | `/api/<chain>/v1/search` |
| Whitechain Sepolia | `whitechain` | `/api/whitechain/v1/search` |

| | Arc Testnet | Whitechain Sepolia |
| --- | --- | --- |
| CAIP-2 | `eip155:5042002` | `eip155:1874` |
| Asset | USDC `0x3600000000000000000000000000000000000000` | USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |
| EIP-712 domain | `{ name: "USDC", version: "2" }` | `{ name: "Tether USD", version: "1" }` |
| RPC | `https://rpc.testnet.arc.io` | `https://rpc.testnet.whitechain.io` |
| Explorer | https://explorer.testnet.arc.io | https://explorer.testnet.whitechain.io |
| Facilitator | `https://arc.007575.xyz` | `https://whitechain.007575.xyz` |
| Test funds | https://faucet.circle.com | owner-only `mint`; ask the operator |

Payers need **the stablecoin only** — payments are EIP-3009 signatures and the facilitator pays the gas. On Arc that gas is USDC too, so there is no second token anywhere in the flow.

Note the EIP-712 `version` differs per chain. Take `extra` from the `accepts` entry you chose; a wrong domain recovers to a different address and fails verification with no transaction to inspect.

Arc mainnet (`eip155:5042`) is intentionally not advertised: that facilitator ships with mainnet settlement off, so `/settle` returns `503 mainnet_disabled`.

## Paying from code

```ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  // Register the chain you hold funds on.
  schemes: [{ network: "eip155:5042002", client: new ExactEvmScheme(account) }],
  spendControls: {
    allowedAssets: [{
      network: "eip155:5042002",
      asset: "0x3600000000000000000000000000000000000000", // Arc Testnet USDC
      maxAmountPerPayment: "100000",
    }],
  },
});

const res = await paidFetch("https://your-domain.com/api/arc/v1/search?query=example");
```

Ready-made clients in this repo:

```bash
PRIVATE_KEY=0x… TINYX402_URL=http://localhost:3000 pnpm pay search "x402"
PRIVATE_KEY=0x… pnpm pay agent https://news.ycombinator.com "top 3 titles" --stream
PRIVATE_KEY=0x… pnpm pay datasets "Coffee shops in Oakland with website" 10
PRIVATE_KEY=0x… python examples/python/pay.py "x402"    # pip install "x402[requests,evm]>=2.27"
```

## How payment is wired

Payments are standard x402 v2 with a facilitator, not direct transfers. The server never sends a transaction and the client only signs. `withX402` (the x402 middleware) gates each route, and the facilitator at `FACILITATOR_URL` verifies and settles. For a step-by-step map, see [How x402 payments work: where it lives in the code](/docs/how-x402-works#where-it-lives-in-the-code).

- `lib/x402.ts` registers `ExactEvmScheme` for **each** advertised network on one `x402ResourceServer`, backed by **one `HTTPFacilitatorClient` per chain**. The SDK reads `/supported` from each and routes verify/settle by the network inside the payment payload, so there is no dispatch code of our own. The chain comes from the URL (`app/api/[chain]/v1/*`, resolved by `resolveChain`), so `paid(product, description, network)` returns a single option:

  ```ts
  accepts: {
    scheme: "exact",
    network,                                   // from the URL prefix
    payTo,
    price: { asset: asset.address, amount: "10000", extra: asset.extra },
  }
  ```

  `extra` must come from the registry per chain. A shared literal is how one chain's signatures
  silently stop verifying. `paidRoute`/`paidStream` memoise per chain, not per module — one cached
  wrapper would otherwise serve every chain the first caller's quote.

- `paidRoute()` wraps `withX402` from `@x402/next`, which settles only after a response with a status below 400. It adds rate limiting and the run log on top. Every route validates its input with zod, forwards it to TinyFish (`lib/tinyfish.ts`) with the operator key, and maps any upstream failure to a status of 400 or higher, so nothing is settled.
- Research and Datasets use a **dynamic x402 price** computed from the request body (`quote()` in `lib/pricing.ts`), for `mode` and `target_rows` respectively.
- `paidStream()` handles `/agent/run-sse`. `withX402` buffers the whole body before settling, so the server verifies first, opens the TinyFish stream, relays events, settles only on `COMPLETE`/`COMPLETED`, and sends the receipt as a final `payment` event.
- Prices live only in `lib/pricing.ts`, where `path` is the chain-less suffix (`/v1/search`); `apiPath(network, path)` is the only place a public URL is spelled out. Every chain, asset, slug and facilitator lives only in `lib/chains.ts` (`CHAINS`), which is where a new chain is added — nothing else names one. `X402_NETWORKS` narrows which are advertised; unset means all. `X402_NETWORK` (singular, pre-multi-chain) is ignored with a warning.

## Deploying to Vercel

1. Import the repo, set the env vars from `.env.example`, and set `NEXT_PUBLIC_SITE_URL` to your domain.
2. Works on the **Hobby** plan. No function runs longer than 300 s: agent runs are capped at 280 s (`agent_config.max_duration_seconds`), and the free `/events` streams close after 5 minutes. The playground and `pnpm pay` reconnect automatically. Research and Datasets keep running on TinyFish regardless.
3. Optional: add Postgres (Neon or Supabase), set `DATABASE_URL`, and run `pnpm db:push` once.

The app is plain Node with no browser binaries, so any host works (`pnpm build && pnpm start`).

## Operator economics

TinyFish bills the operator's wallet. Search (12,000/day) and Fetch (1,000 URLs/day) have free daily tiers. Research costs **$2 (deep) / $3 (max)** per completed run after 2 free runs a day, which is **above** the default x402 prices here. Datasets and Agent are metered. Adjust `lib/pricing.ts` before going to mainnet.

## Google login and platform wallets

Google sign-in uses [Neon's managed Better Auth](https://neon.com/docs/auth/overview) (`@neon/auth`) and only exists for the web app. `/api/arc/v1/*` never reads a session: anyone can call it with an x402 payment.

- `lib/auth/server.ts` and `app/api/auth/[...path]`: Neon Auth. It's disabled cleanly when `NEON_AUTH_BASE_URL` isn't set.
- `proxy.ts`: required. Google returns to `?neon_auth_session_verifier=…`, and only the middleware exchanges that verifier for the session cookie. Every page is public, so it skips `auth.middleware()` (route protection) and calls `processAuthMiddleware` directly: exchange, refresh, never redirect. Nothing to keep in sync when you add a page. `/api/*` is outside the matcher, which `pnpm selftest` asserts.
- `GET /api/wallet` creates the user's wallet on first sign-in (`lib/wallet.ts`). The private key is generated server-side and stored in `wallets`, encrypted with AES-256-GCM under `WALLET_ENCRYPTION_KEY`, with the user id as AAD.
- `POST /api/wallet/sign` signs one EIP-3009 authorization. The request names only the CAIP-2 `network`; the server rebuilds every EIP-712 domain field from `CHAINS`, so a caller can pick an allowlisted chain but can never make us sign one chain's payment under another chain's token. `checkAuthorization()` rejects an unknown network and only allows payments `to` our `PAY_TO_ADDRESS`, up to `PLATFORM_WALLET_MAX_PER_PAYMENT`, valid for at most 1 h. The playground uses it as an ordinary x402 signer (`platformSigner` in `lib/pay-client.ts`).
- Google OAuth works in development with Neon's shared credentials. For production, add your own Google client in Neon Console → Auth, and add your site to trusted domains.

## Security notes

- Request bodies are parsed with zod objects that drop unknown keys, so account-scoped TinyFish options (vault credentials, browser profiles, `prior_run_id`/`session_id`) can never be used on the operator key.
- Free follow-up endpoints only accept `[A-Za-z0-9_-]` IDs. Run and dataset IDs are unguessable and returned only to the payer.
- Rate limiting is an in-memory per-IP window (`RATE_LIMIT_PER_MIN`), applied per instance. Use Redis or Upstash for multi-region deployments.
- `/api/runs` exposes only on-chain-equivalent data (endpoint, payer, amount, tx). Inputs and outputs are never returned.
- Platform wallets are custodial: whoever holds `WALLET_ENCRYPTION_KEY` and the database can sign for them. They are scoped to testnet payments to this deployment, but keep the key in your secret store and don't rotate it without re-encrypting (losing it loses every wallet).

## Scripts

| | |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `typecheck` | |
| `pnpm selftest` | asserts on prices and dynamic quotes, per-chain `accepts`/assets/domains, 6-decimal and Arc-minimum guards, per-chain custodial signatures, field stripping, SSE codec, agent relay, Bazaar docs. `X402_CHECK_URL=…` adds a live 402 and per-chain facilitator check |
| `NETWORK=… pnpm pay <endpoint> …` | paid CLI client; `NETWORK` picks the chain and the URL prefix |
| `pnpm bazaar:register` | list all endpoints in every advertised chain's Bazaar (run after each deploy; needs public `NEXT_PUBLIC_SITE_URL` and `PAY_TO_ADDRESS`) |
| `pnpm db:push` | create the `runs` and `wallets` tables |

## License

MIT
