# Graph Report - tinyx402  (2026-11-06)

## Corpus Check
- 1 files · ~24,624 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 430 nodes · 858 edges · 15 communities (12 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Dashboard Views & UI
- Browser Session Endpoints
- Auth & Wallet Persistence
- Docs & Discovery Endpoints
- Interactive Playground UI
- Agent Execution & Streaming
- NPM Package Scripts & Config
- Architecture & x402 Specs
- Production Dependencies
- Rate Limiting & Execution Control
- TypeScript Configuration
- Dev Tooling Dependencies
- ESLint Configuration
- Python Payment Client
- Next.js Agent Guidelines

## God Nodes (most connected - your core abstractions)
1. `upstreamFailure()` - 19 edges
2. `tf` - 17 edges
3. `compilerOptions` - 16 edges
4. `issues()` - 15 edges
5. `Quick Start Guide` - 15 edges
6. `badRequest()` - 14 edges
7. `Playground()` - 14 edges
8. `safeId()` - 13 edges
9. `paidRoute()` - 13 edges
10. `formatUsdt()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `tinyx402 Project Overview` --conceptually_related_to--> `Quick Start Guide`  [INFERRED]
  README.md → app/docs/page.mdx
- `Playground()` --calls--> `quote()`  [EXTRACTED]
  app/playground/playground.tsx → lib/pricing.ts
- `POST` --calls--> `issues()`  [EXTRACTED]
  app/api/v1/agent/run/route.ts → lib/schemas.ts
- `POST` --calls--> `tf`  [EXTRACTED]
  app/api/v1/agent/run-sse/route.ts → lib/tinyfish.ts
- `POST` --calls--> `upstreamFailure()`  [EXTRACTED]
  app/api/v1/agent/run/route.ts → lib/tinyfish.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **tinyx402 Web API Capabilities Suite** — app_docs_api_search_page_search_endpoint, app_docs_api_fetch_page_fetch_endpoint, app_docs_api_agent_page_agent_run_endpoint, app_docs_api_research_page_research_endpoint, app_docs_api_browser_page_browser_session_endpoint [EXTRACTED 1.00]
- **x402 Verification and Gasless Settlement Flow** — app_docs_how_x402_works_page_four_step_flow, app_docs_whitechain_page_whitechain_facilitator, app_docs_how_x402_works_page_gasless_payer_mechanism, app_docs_authentication_page_single_use_authorization [EXTRACTED 1.00]
- **Client Spend and Security Controls** — app_docs_authentication_page_spend_controls, app_docs_authentication_page_single_use_authorization, app_docs_page_settlement_on_success [INFERRED 0.95]

## Communities (15 total, 3 thin omitted)

### Community 0 - "Dashboard Views & UI"
Cohesion: 0.05
Nodes (40): Dashboard(), Row, ServerRun, metadata, DocsSidebar(), metadata, mono, sans (+32 more)

### Community 1 - "Browser Session Endpoints"
Cohesion: 0.08
Nodes (45): DELETE(), runtime, maxDuration, POST, runtime, Session, GET(), maxDuration (+37 more)

### Community 2 - "Auth & Wallet Persistence"
Cohesion: 0.08
Nodes (29): GET(), runtime, dynamic, GET(), runtime, runtime, auth, currentUser() (+21 more)

### Community 3 - "Docs & Discovery Endpoints"
Cohesion: 0.08
Nodes (21): BODIES, dynamic, dynamic, FLOW, Home(), Code(), CopyButton(), FACILITATOR_URL (+13 more)

### Community 4 - "Interactive Playground UI"
Cohesion: 0.09
Nodes (29): metadata, describe(), LogLine, newId(), now(), Playground(), run(), NETWORK (+21 more)

### Community 5 - "Agent Execution & Streaming"
Cohesion: 0.09
Nodes (25): maxDuration, POST, RunResult, runtime, maxDuration, POST, runtime, AgentEvent (+17 more)

### Community 6 - "NPM Package Scripts & Config"
Cohesion: 0.05
Nodes (35): name, packageManager, private, scripts, bazaar:register, build, db:push, dev (+27 more)

### Community 7 - "Architecture & x402 Specs"
Cohesion: 0.12
Nodes (31): Agent Run API (/api/v1/agent/run), Agent Safety and Isolation Sandbox, Agent Run SSE API (/api/v1/agent/run-sse), Browser Session API (/api/v1/browser), Datasets API (/api/v1/datasets), Per-Row Pricing Mechanism, TinySet Dataset Generation Engine, Fetch API (/api/v1/fetch) (+23 more)

### Community 8 - "Production Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, drizzle-orm, @mdx-js/loader, @mdx-js/react, @neon/auth, next, @next/mdx, next-themes (+19 more)

### Community 9 - "Rate Limiting & Execution Control"
Cohesion: 0.13
Nodes (22): POST(), recordRun(), quote(), hits, LIMIT, rateLimit(), sseResponse(), discovery() (+14 more)

### Community 10 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 11 - "Dev Tooling Dependencies"
Cohesion: 0.18
Nodes (11): devDependencies, drizzle-kit, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, tsx, @types/node (+3 more)

## Knowledge Gaps
- **167 isolated node(s):** `RunResult`, `Session`, `Dataset`, `FetchResult`, `Handler` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 209 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Production Dependencies` to `NPM Package Scripts & Config`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `server-only` connect `Auth & Wallet Persistence` to `Browser Session Endpoints`, `Agent Execution & Streaming`, `Rate Limiting & Execution Control`, `NPM Package Scripts & Config`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `react` connect `Dashboard Views & UI` to `Docs & Discovery Endpoints`, `Interactive Playground UI`, `NPM Package Scripts & Config`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `RunResult`, `Session`, `Dataset` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard Views & UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05254237288135593 - nodes in this community are weakly interconnected._
- **Should `Browser Session Endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.08166969147005444 - nodes in this community are weakly interconnected._
- **Should `Auth & Wallet Persistence` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._