# 00 — Current State & System Audit

**Role**: Senior Product Engineer  
**Date**: October 2026  
**Repository**: `rakamindev/ai-interview-platform`  
**Git Branch**: `main` (commit `b836d02`)

---

## 1. Repository Status & Local Work Inspection

### 1.1 Git Status & History
- **Current Branch**: `main` (up to date with `origin/main`).
- **Working Tree**: Clean prior to this audit; no uncommitted local changes were discarded or overwritten.
- **Remote Branches**:
  - `origin/main`
  - `origin/doc/add-product-section`
- **Recent Commit**: `b836d02` — *"Revise product specification and case study reference (#5)"*.
- **Local Work Preservation**: Docker containers from earlier exploration (`rakamin-case-api`, `rakamin-case-db`, `rakamin-case-redis`, `fitgap-*`) exist in Docker daemon and were left completely intact without modification.

### 1.2 Documentation & PRD / Wiki Accessibility
- **Referenced PRD/Wiki**: The root `README.md` references `https://github.com/rakamindev/ai-interview-platform/wiki`.
- **Audit Observation**: The external GitHub wiki URL is not publicly accessible (returns HTTP resolution/access restrictions or is private/uninitialized). Per audit instructions, this constraint is explicitly documented rather than assumed.
- **Primary Source of Truth**: The case study brief PDF (`brief-fullstack.pdf`), existing seed definitions (`seeds.rb`), database schema (`schema.rb`), and the full source code across `api/` and `web/`.

---

## 2. Architecture & Service Structure

The platform is designed as a cohesive two-service monolithic repository:

```
ai-interview-platform/
├── api/                       # Ruby on Rails 7.0 API Backend
│   ├── app/
│   │   ├── auth/              # JWT token decoding & user authentication
│   │   ├── channels/          # Real-time WebSocket middlewares (Audio & Coverage)
│   │   ├── clients/gemini/    # Gemini Live (WebSockets) & Gemini REST (HTTP Client)
│   │   ├── controllers/       # REST API endpoints (V1)
│   │   ├── middlewares/       # Tenant resolution & auth token validation
│   │   ├── models/            # ActiveRecord models with PostgreSQL enums & constraints
│   │   ├── services/          # Core domain business logic (Assessments, Coverage, FitGap, Portfolios)
│   │   └── workers/           # Sidekiq background workers
│   ├── config/                # Rails config, routes, database, sidekiq
│   ├── db/                    # Migrations, schema.rb, seeds.rb
│   └── Dockerfile             # Multi-stage production container build
├── web/                       # React 18 Single-Page Application (SPA)
│   ├── src/
│   │   ├── components/        # Base UI primitives (Radix UI / Tailwind) & domain cards
│   │   ├── hooks/             # WebSocket, audio worklet, polling hooks
│   │   ├── pages/             # Routing views (Assessments, Monitor, Portfolio, FitGap, Vacancies)
│   │   ├── services/          # Axios API clients
│   │   ├── stores/            # Jotai state atoms (Auth, Tenant)
│   │   └── types/             # TypeScript contract definitions
│   └── package.json           # Dependencies and build scripts
└── assessment/                # Audit deliverables and engineering plans
```

---

## 3. Runtime, Dependencies, & Baseline Test Execution

### 3.1 Host & Environment Inspection
- **Operating System**: Linux (Ubuntu 24.04 LTS under WSL environment).
- **Runtimes on Host PATH**: Neither `ruby`, `bundle`, `node`, nor `npm` are installed globally on the WSL host `$PATH`.
- **Container Infrastructure**: Docker daemon is active and running. Available local images include:
  - `ruby:3.3.2`
  - `ai-interview-api:local` (built from `api/Dockerfile`)
  - `postgres:16` & `postgres:16-alpine`
  - `redis:alpine` & `redis:7-alpine`
  - `node:20-alpine` (verified via container execution)

### 3.2 Actual Test & Build Execution (Honest Baseline Report)
Per audit guidelines, no test success is fabricated:

1. **Frontend (`web/`) Test Command**:
   - Command: `cd web && npm test`
   - Actual Result: Failed (exit code 127, `npm: command not found` on host shell).
   - `web/package.json` inspection: Only scripts present are `"dev"`, `"build"`, and `"preview"`. **There is no test runner (Jest/Vitest) installed or configured.**
   - Dependencies: `node_modules` directory was not present; dependencies must be resolved inside a Node container or host environment.

2. **Backend (`api/`) Test Command**:
   - Command: `docker run --rm ai-interview-api:local bundle exec rspec`
   - Actual Result: Failed with exit code 127: `bundler: command not found: rspec`.
   - Reason: The existing Docker image was built using `bundle config set --local without 'development test'`, which intentionally excludes RSpec gems.
   - Codebase inspection: `api/spec/` **does not exist at all**. There are zero written unit, model, controller, or integration specs.

3. **Baseline Summary**:
   As confirmed by the brief (Step 1.3), the baseline repository has no continuous integration, no backend test suite, and no frontend test runner. Introducing a reproducible test harness is part of the engineering ownership.

---

## 4. End-to-End User Flow Traces

We traced the complete lifecycle across both services, database records, background jobs, and API payloads:

```
[ Assessor Setup ] ──> [ Candidate Interview ] ──> [ Portfolio Generation ] ──> [ Fit/Gap & Override ]
   (Assessment &         (Real-time Audio &           (Gemini Pro &               (Gemini Flash &
    Vacancy CRUD)         Coverage Probing)            Skill Extraction)           Vacancy Comparison)
```

### Trace A: Candidate Assessment Creation & Invitation
1. **Frontend**: Assessor visits `/assessments/new`, fills in title, time limit, and selects skills from the seeded B7 taxonomy or creates custom anchors.
2. **API Request**: `POST /api/v1/assessments` with nested `assessment_skills_attributes`.
3. **Controller & Model**: `Api::V1::AssessmentsController#create` validates attributes and commits to `assessments` and `assessment_skills` tables. Both model rows are scoped by `Current.tenant_id` (`TenantScoped`).
4. **Background Job**: `SystemPromptGeneratorWorker` is triggered asynchronously to compile the system prompt.
5. **Session Creation**: In `/assessments/:id/invite`, Assessor creates an invite session (`POST /api/v1/assessments/:id/sessions`), generating a unique 64-character `invite_token`.

### Trace B: Candidate Interview Session
1. **Frontend**: Candidate accesses public route `/interview/:token`.
2. **API Request**: `GET /api/v1/sessions/:token/candidate` retrieves session parameters without JWT requirement.
3. **Hardware Check & Connect**: Candidate verifies audio devices, then opens WebSockets:
   - Live Audio Stream: `ws://localhost:3001/cable` (via `AudioWebsocketMiddleware` streaming PCM audio to Gemini Live).
   - Live Coverage Monitor: `ws://localhost:3001/coverage` (`CoverageWebsocketMiddleware` broadcasting state transitions).
4. **Database State**: `Sessions::StartHandler` transitions session from `pending` to `active`, populating initial `coverage_maps` records with state `not_yet`.
5. **Interview Termination**: Candidate completes session or timer expires. `Sessions::EndHandler` sets session `status = 'ended'`, calculates `duration_seconds`, creates a `Portfolio` record with `generation_status = 'pending'`, and enqueues `PortfolioGeneratorWorker`.

### Trace C: AI Portfolio Generation & Assessor Calibration
1. **Background Job**: `PortfolioGeneratorWorker` runs `Portfolios::Generator`.
2. **AI Processing**: Formulates prompt containing taxonomy anchors, coverage map states, and transcript turns. Calls Gemini Pro (`gemini-2.0-pro-001`).
3. **Data Mutation**: Saves evaluated skills into `portfolio_skills` (setting `ai_level`, `ai_confidence`, `evidence`, `competency_summary`), updating `generation_status = 'complete'`.
4. **Assessor Calibration**: Assessor opens `/assessments/:id/sessions/:sessionId/portfolio`.
   - Assessor reviews evidence quotes and AI level.
   - Assessor clicks "Override rating" and submits a calibrated level with notes (`POST /api/v1/portfolio_skills/:id/override`).
   - `PortfolioSkillsController#override` records an `assessor_overrides` row.

### Trace D: Fit/Gap Analysis & Committee Export (The Core Value Seam)
1. **Frontend**: In `PortfolioPage`, assessor selects a Vacancy dropdown (e.g., "Fullstack Engineer") and clicks "Run Fit/Gap Analysis →", navigating to `/assessments/:id/sessions/:sessionId/fitgap/:vacancyId`.
2. **API Request**: `GET /api/v1/portfolios/:id/fitgap/:vacancyId`.
3. **Engine Execution**: If existing report is absent, `POST /api/v1/portfolios/:id/fitgap` queues `FitGapGeneratorWorker`, which calls `FitGap::Engine`.
   - Matches candidate `portfolio_skills` (including overrides) against `vacancy_skills`.
   - Calculates deltas: `match` (delta 0), `exceed` (delta > 0), `gap` (delta < 0), or `not_assessed`.
   - Generates culture and overall narratives via Gemini Flash.
   - Saves record into `fit_gap_reports`.
4. **Frontend Presentation**: `ComparisonTable.tsx` displays the comparison table and narrative summaries.
5. **Export**: Assessor clicks "PDF" or "JSON" (`GET /api/v1/portfolios/:id/export?format=pdf&vacancy_id=...`), triggering `Exports::PdfGenerator` to download the structured evaluation report.

---

## 5. Critical Observations from Current State

The platform has a sound architectural skeleton, but suffers from severe data contract mismatches, state synchronization bugs, and unprotected failure modes in the Fit/Gap and Assessor calibration workflows:
- The data contract between `FitGap::Engine` and `ComparisonTable.tsx` is completely broken (causing required levels to render blank and override indicators to vanish).
- Background generation of Fit/Gap reports lacks proper status tracking, resulting in rapid-fire job flooding and infinite polling loops upon error or delay.
- Overriding a skill destroys existing reports synchronously, breaking exports and causing race conditions.
- Multi-tenant data isolation is bypassed on all portfolio and override endpoints.

These issues directly impede hiring decisions and compromise candidate data safety under Indonesian legal frameworks. Full details are analyzed in `01-domain-context.md` and `02-problem-analysis.md`.
