# Graph Report - tinyx402  (2026-11-12)

## Corpus Check
- 3 files · ~30,870 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 469 nodes · 978 edges · 19 communities (16 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Dashboard Views & UI
- Discovery & Legacy Routing
- App Layout & Navigation
- Tooling & Playground Setup
- Auth & Wallet Persistence
- Resource Detail & Streaming Endpoints
- Architecture & x402 Specs
- Production Dependencies
- Agent Execution Endpoints
- x402 Pricing & Chain Setup
- TypeScript Configuration
- Datasets & Research Endpoints
- x402 Facilitator Dispatch
- Dev Tooling Dependencies
- Browser Session API
- Fetch & Extraction API
- ESLint Configuration
- Python Payment Client
- Next.js Agent Guidelines

## God Nodes (most connected - your core abstractions)
1. `apiPath()` - 23 edges
2. `Playground()` - 16 edges
3. `CHAINS` - 16 edges
4. `compilerOptions` - 16 edges
5. `requireChain()` - 15 edges
6. `tf` - 15 edges
7. `Quick Start Guide` - 15 edges
8. `badRequest()` - 14 edges
9. `Network` - 13 edges
10. `isNetwork()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `POST` --calls--> `badRequest()`  [EXTRACTED]
  app/api/[chain]/v1/agent/run/route.ts → lib/x402.ts
- `POST` --calls--> `badRequest()`  [EXTRACTED]
  app/api/[chain]/v1/fetch/route.ts → lib/x402.ts
- `tinyx402 Project Overview` --conceptually_related_to--> `Quick Start Guide`  [INFERRED]
  README.md → app/docs/page.mdx
- `Dashboard()` --calls--> `useMounted()`  [EXTRACTED]
  app/dashboard/dashboard.tsx → components/header.tsx
- `Playground()` --calls--> `usePlatformWallet()`  [EXTRACTED]
  app/playground/playground.tsx → components/account.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Multi-Chain Settlement & Facilitator Architecture** — app_docs_networks_page_facilitators, app_docs_networks_page_arc_testnet, app_docs_networks_page_whitechain_sepolia, app_docs_authentication_page_single_use_authorization [EXTRACTED 1.00]
- **tinyx402 Web API Capabilities Suite** — app_docs_api_search_page_search_endpoint, app_docs_api_fetch_page_fetch_endpoint, app_docs_api_agent_page_agent_run_endpoint, app_docs_api_research_page_research_endpoint, app_docs_api_browser_page_browser_session_endpoint [EXTRACTED 1.00]
- **tinyx402 Web API Capabilities Suite** — app_docs_api_search_page_search_endpoint, app_docs_api_fetch_page_fetch_endpoint, app_docs_api_agent_page_agent_run_endpoint, app_docs_api_research_page_research_endpoint, app_docs_api_browser_page_browser_session_endpoint [EXTRACTED 1.00]
- **x402 Verification and Gasless Settlement Flow** — app_docs_how_x402_works_page_four_step_flow, app_docs_whitechain_page_whitechain_facilitator, app_docs_how_x402_works_page_gasless_payer_mechanism, app_docs_authentication_page_single_use_authorization [EXTRACTED 1.00]
- **Client Spend and Security Controls** — app_docs_authentication_page_spend_controls, app_docs_authentication_page_single_use_authorization, app_docs_page_settlement_on_success [INFERRED 0.95]
- **Client Spend and Security Controls** — app_docs_authentication_page_spend_controls, app_docs_authentication_page_single_use_authorization, app_docs_page_settlement_on_success [INFERRED 0.95]

## Communities (19 total, 3 thin omitted)

### Community 0 - "Dashboard Views & UI"
Cohesion: 0.07
Nodes (47): Dashboard(), Row, ServerRun, metadata, describe(), LogLine, newId(), now() (+39 more)

### Community 1 - "Discovery & Legacy Routing"
Cohesion: 0.07
Nodes (32): BODIES, dynamic, GET(), DELETE, GET, gone(), POST, runtime (+24 more)

### Community 2 - "App Layout & Navigation"
Cohesion: 0.07
Nodes (29): DocsSidebar(), metadata, mono, sans, AccountButton(), AccountChip(), GetStarted(), PlatformWallet (+21 more)

### Community 3 - "Tooling & Playground Setup"
Cohesion: 0.04
Nodes (41): metadata, nextConfig, withMDX, name, packageManager, private, scripts, bazaar:register (+33 more)

### Community 4 - "Auth & Wallet Persistence"
Cohesion: 0.07
Nodes (34): GET(), runtime, dynamic, GET(), runtime, POST(), runtime, auth (+26 more)

### Community 5 - "Resource Detail & Streaming Endpoints"
Cohesion: 0.13
Nodes (27): DELETE(), runtime, GET(), maxDuration, runtime, GET(), runtime, GET() (+19 more)

### Community 6 - "Architecture & x402 Specs"
Cohesion: 0.10
Nodes (35): Agent Run API (/api/v1/agent/run), Agent Safety and Isolation Sandbox, Agent Run SSE API (/api/v1/agent/run-sse), Browser Session API (/api/v1/browser), Datasets API (/api/v1/datasets), Per-Row Pricing Mechanism, TinySet Dataset Generation Engine, Fetch API (/api/v1/fetch) (+27 more)

### Community 7 - "Production Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, drizzle-orm, @mdx-js/loader, @mdx-js/react, @neon/auth, next, @next/mdx, next-themes (+19 more)

### Community 8 - "Agent Execution Endpoints"
Cohesion: 0.13
Nodes (15): maxDuration, POST, RunResult, runtime, maxDuration, POST, runtime, AgentEvent (+7 more)

### Community 9 - "x402 Pricing & Chain Setup"
Cohesion: 0.14
Nodes (8): DATASET_DEFAULT_ROWS, DATASET_MAX_ROWS, boolStr, purpose, ymd, config, @x402/evm, main()

### Community 10 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 11 - "Datasets & Research Endpoints"
Cohesion: 0.14
Nodes (15): Dataset, maxDuration, POST, runtime, maxDuration, POST, runtime, GET (+7 more)

### Community 12 - "x402 Facilitator Dispatch"
Cohesion: 0.16
Nodes (16): Product, quote(), DYNAMIC, facilitators, Handler, OUTPUTS, paid(), paidRoute() (+8 more)

### Community 13 - "Dev Tooling Dependencies"
Cohesion: 0.18
Nodes (11): devDependencies, drizzle-kit, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, tsx, @types/node (+3 more)

### Community 14 - "Browser Session API"
Cohesion: 0.33
Nodes (5): maxDuration, POST, runtime, Session, BrowserBody

### Community 15 - "Fetch & Extraction API"
Cohesion: 0.33
Nodes (5): FetchResult, maxDuration, POST, runtime, FetchBody

## Knowledge Gaps
- **177 isolated node(s):** `Row`, `ServerRun`, `LogLine`, `PaySigner`, `TypedData` (+172 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 223 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Production Dependencies` to `Tooling & Playground Setup`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `server-only` connect `Auth & Wallet Persistence` to `Agent Execution Endpoints`, `Tooling & Playground Setup`, `x402 Facilitator Dispatch`, `Resource Detail & Streaming Endpoints`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `react` connect `App Layout & Navigation` to `Dashboard Views & UI`, `Discovery & Legacy Routing`, `Tooling & Playground Setup`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `Row`, `ServerRun`, `LogLine` to the rest of the system?**
  _177 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard Views & UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06646825396825397 - nodes in this community are weakly interconnected._
- **Should `Discovery & Legacy Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.0700354609929078 - nodes in this community are weakly interconnected._
- **Should `App Layout & Navigation` be split into smaller, more focused modules?**
  _Cohesion score 0.06859903381642513 - nodes in this community are weakly interconnected._