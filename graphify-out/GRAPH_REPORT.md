# Graph Report - tinyx402  (2026-11-06)

## Corpus Check
- Corpus is ~16,156 words - fits in a single context window. You may not need a graph.

## Summary
- 363 nodes · 683 edges · 16 communities (13 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- API Route Handlers
- Agent Execution & Streaming
- Database & Run Persistence
- Dashboard UI & Views
- Docs & Discovery Endpoints
- App Layout & Navigation
- Production Dependencies
- Architecture & x402 Specs
- TypeScript Configuration
- Dev Tooling & Build Dependencies
- NPM Package Scripts
- Web Search Providers
- TypeScript Payment Client
- ESLint Configuration
- Python Payment Client
- Next.js Agent Guidelines

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `Quick Start Guide` - 15 edges
3. `issues()` - 13 edges
4. `badRequest()` - 13 edges
5. `failure()` - 12 edges
6. `assertPublicUrl()` - 11 edges
7. `paidRoute()` - 11 edges
8. `Playground()` - 10 edges
9. `runAgent()` - 10 edges
10. `formatUsdt()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `tinyx402 Project Overview` --conceptually_related_to--> `Quick Start Guide`  [INFERRED]
  README.md → app/docs/page.mdx
- `POST` --calls--> `runAgent()`  [EXTRACTED]
  app/api/v1/agent/run-sse/route.ts → lib/agent.ts
- `POST` --calls--> `runAgent()`  [EXTRACTED]
  app/api/v1/agent/run/route.ts → lib/agent.ts
- `POST` --calls--> `fetchRendered()`  [EXTRACTED]
  app/api/v1/fetch/route.ts → lib/extract.ts
- `POST` --calls--> `fetchStatic()`  [EXTRACTED]
  app/api/v1/fetch/route.ts → lib/extract.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **x402 Verification and Gasless Settlement Flow** — app_docs_how_x402_works_page_four_step_flow, app_docs_whitechain_page_whitechain_facilitator, app_docs_how_x402_works_page_gasless_payer_mechanism, app_docs_authentication_page_single_use_authorization [EXTRACTED 1.00]
- **tinyx402 Web API Capabilities Suite** — app_docs_api_search_page_search_endpoint, app_docs_api_fetch_page_fetch_endpoint, app_docs_api_agent_page_agent_run_endpoint, app_docs_api_research_page_research_endpoint, app_docs_api_browser_page_browser_session_endpoint [EXTRACTED 1.00]
- **Client Spend and Security Controls** — app_docs_authentication_page_spend_controls, app_docs_authentication_page_single_use_authorization, app_docs_page_settlement_on_success [INFERRED 0.95]

## Communities (16 total, 3 thin omitted)

### Community 0 - "API Route Handlers"
Cohesion: 0.09
Nodes (42): maxDuration, POST, runtime, maxDuration, POST, runtime, maxDuration, POST (+34 more)

### Community 1 - "Agent Execution & Streaming"
Cohesion: 0.08
Nodes (38): maxDuration, POST, runtime, AgentInput, AgentResult, el(), exec(), nobj() (+30 more)

### Community 2 - "Database & Run Persistence"
Cohesion: 0.05
Nodes (37): GET(), runtime, db, g, listRuns(), RunRecord, runs, nextConfig (+29 more)

### Community 3 - "Dashboard UI & Views"
Cohesion: 0.09
Nodes (28): Dashboard(), Row, ServerRun, metadata, Home(), metadata, buildRequest(), DEFAULTS (+20 more)

### Community 4 - "Docs & Discovery Endpoints"
Cohesion: 0.11
Nodes (15): BODIES, dynamic, dynamic, FLOW, Code(), CopyButton(), FACILITATOR_URL, NETWORK (+7 more)

### Community 5 - "App Layout & Navigation"
Cohesion: 0.10
Nodes (20): DocsSidebar(), metadata, mono, sans, Header(), NAV, noop(), ThemeToggle() (+12 more)

### Community 6 - "Production Dependencies"
Cohesion: 0.07
Nodes (30): dependencies, @anthropic-ai/sdk, drizzle-orm, linkedom, @mdx-js/loader, @mdx-js/react, @mozilla/readability, next (+22 more)

### Community 7 - "Architecture & x402 Specs"
Cohesion: 0.13
Nodes (28): Agent Run API (/api/v1/agent/run), Agent Safety and Isolation Sandbox, Agent Run SSE API (/api/v1/agent/run-sse), Browser Session API (/api/v1/browser), Fetch API (/api/v1/fetch), Research API (/api/v1/research), Search API (/api/v1/search), Payment as Credential Pattern (+20 more)

### Community 8 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 9 - "Dev Tooling & Build Dependencies"
Cohesion: 0.17
Nodes (12): devDependencies, drizzle-kit, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, tsx, @types/node (+4 more)

### Community 10 - "NPM Package Scripts"
Cohesion: 0.22
Nodes (9): scripts, build, db:push, dev, lint, pay, selftest, start (+1 more)

### Community 11 - "Web Search Providers"
Cohesion: 0.50
Nodes (7): brave(), ddg(), normalize(), parseDdg(), search(), tavily(), linkedom

### Community 12 - "TypeScript Payment Client"
Cohesion: 0.36
Nodes (7): @x402/fetch, account, [cmd, a, b], main(), paidFetch, post(), stream

## Knowledge Gaps
- **149 isolated node(s):** `dynamic`, `BODIES`, `runtime`, `runtime`, `maxDuration` (+144 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 177 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Production Dependencies` to `Database & Run Persistence`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `server-only` connect `Database & Run Persistence` to `API Route Handlers`, `Agent Execution & Streaming`, `Web Search Providers`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `react` connect `App Layout & Navigation` to `Database & Run Persistence`, `Dashboard UI & Views`, `Docs & Discovery Endpoints`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `dynamic`, `BODIES`, `runtime` to the rest of the system?**
  _149 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Route Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.08525506638714186 - nodes in this community are weakly interconnected._
- **Should `Agent Execution & Streaming` be split into smaller, more focused modules?**
  _Cohesion score 0.08383838383838384 - nodes in this community are weakly interconnected._
- **Should `Database & Run Persistence` be split into smaller, more focused modules?**
  _Cohesion score 0.053426248548199766 - nodes in this community are weakly interconnected._