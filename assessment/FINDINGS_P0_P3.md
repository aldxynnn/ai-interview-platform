# Comprehensive Findings Matrix (P0 to P3)
**AI Interview Platform Revamp**

This document decomposes all defects, missing specifications, data seam mismatches, and architectural debts discovered during our end-to-end product exploration.

---

## Severity Definitions
- **P0 (Critical / Blocker):** System crashes, irreversible data loss, or total feature failure preventing core user evaluation.
- **P1 (High):** Major workflow degradation, security/audit integrity violation, or unhandled failure states under common conditions.
- **P2 (Medium):** UI/UX neglect, missing empty/error/loading interaction states, or friction in recruiter/assessor workflows.
- **P3 (Low / Polish):** Code ergonomics, missing developer testing infrastructure, or documentation debt.

---

## Detailed Findings

### [P0] F-01: Silent Portfolio Generation Failure on LLM Markdown Fences
- **Service:** `api`
- **Location:** `api/app/services/portfolios/generator.rb` (`#save_skills`)
- **Classification:** Defective Implementation
- **Impact:** When Google Gemini Pro generates the portfolio JSON wrapped in standard markdown code fences (e.g. ` ```json ... ``` `) or adds conversational pleasantries, `JSON.parse` raises `JSON::ParserError`. The background worker crashes, setting `portfolio.generation_status = 'failed'`. The recruiter or assessor sees a permanent failure state with no automatic recovery.
- **Resolution:** Implemented `parse_response_data` using regex object boundary extraction (`/\{[\s\S]*\}/`) and stripping code fences before parsing. Added level clamping (1..5) and safe defaults.

---

### [P0] F-02: Data Seam Mismatch in Fit/Gap Skill Comparison
- **Service:** Cross-service (`api` & `web`)
- **Location:** `api/app/services/fit_gap/engine.rb` & `web/src/components/fitgap/ComparisonTable.tsx`
- **Classification:** Data Seam Mismatch
- **Impact:** Backend `FitGap::Engine` returned `expected_level` for vacancy skills, while the React component `ComparisonTable.tsx` accessed `c.required_level`. This resulted in `LEVEL_LABELS[undefined]`, displaying blank cells and broken delta values in the candidate evaluation table.
- **Resolution:** 
  1. Updated `FitGap::Engine` to emit both `expected_level` and `required_level` for backward compatibility.
  2. Updated `web/src/types/index.ts` to include `expected_level?`, `required_level?`, and `assessor_notes?`.
  3. Hardened `ComparisonTable.tsx` to safely fallback `c.required_level ?? c.expected_level ?? 1`.

---

### [P1] F-03: Session Re-activation Hazard on Disconnected Sockets
- **Service:** `api`
- **Location:** `api/app/services/sessions/start_handler.rb` & `api/app/channels/audio_websocket_middleware.rb`
- **Classification:** Missing Specification
- **Impact:** If a candidate whose interview had already ended (or failed) refreshed the browser or re-established a WebSocket connection, `Sessions::StartHandler` attempted to re-activate the session (`status = 'active'`), resetting timestamps and re-triggering Sidekiq background jobs.
- **Resolution:** Implemented strict state invariant guards in `Sessions::StartHandler`: if `@session.ended? || @session.status == 'failed'`, log warning and return early without mutating database records. Added socket rejection in `AudioWebSocketMiddleware` for ended sessions.

---

### [P1] F-04: Irreversible Human Assessor Overrides
- **Service:** Cross-service (`api` & `web`)
- **Location:** `api/app/controllers/api/v1/portfolio_skills_controller.rb` & `web/src/components/portfolio/OverridePanel.tsx`
- **Classification:** Missing Specification
- **Impact:** Assessors could override an AI rating, but had no way to remove or cancel an override if entered mistakenly. This locked the evaluation into the human override permanently without a rollback path to the AI baseline.
- **Resolution:**
  1. Added `DELETE /api/v1/portfolio_skills/:id/override` endpoint (`#destroy_override`).
  2. Added `deleteOverride` in `web/src/services/portfolios.ts`.
  3. Added "Revert to AI" action in `OverridePanel.tsx` and reactive state synchronization in `PortfolioPage.tsx`.

---

### [P1] F-05: Destructive Report Deletion During Fit/Gap Regeneration
- **Service:** `api`
- **Location:** `api/app/controllers/api/v1/portfolio_skills_controller.rb` (`#regenerate_stale_fitgap_reports`)
- **Classification:** Defective Implementation
- **Impact:** When an assessor updated an override, the controller destroyed all existing `FitGapReport` rows before enqueueing background regeneration. If Sidekiq encountered a network timeout or Gemini rate limit, previous hiring reports were permanently lost with no fallback.
- **Resolution:** Removed destructive `destroy_all`. The background engine recomputes and updates reports in place idempotently (`find_or_initialize_by`), keeping historical evaluations intact until new ones are ready.

---

### [P2] F-06: UI/UX State Neglect in Fit/Gap and Portfolio Screens
- **Service:** `web`
- **Location:** `web/src/components/fitgap/ComparisonTable.tsx` & `web/src/components/portfolio/SkillPortfolioCard.tsx`
- **Classification:** UI/UX Neglect
- **Impact:** 
  1. When comparisons were empty, `ComparisonTable` rendered a blank border with empty headers and no guidance.
  2. Overridden skills showed a pencil icon but omitted assessor rationale notes.
  3. Summary counts omitted not-assessed skills.
- **Resolution:** Added empty state callout, tooltip/inline display of assessor notes, visual indicator badges for human overrides, and full summary breakdown counts (Match, Gap, Exceeds, Not Assessed).

---

### [P3] F-07: Lack of Automated Testing Harness & CI
- **Service:** Fullstack repo
- **Location:** `api/spec/` & `web/src/` & `.github/workflows/`
- **Classification:** Missing Infrastructure
- **Impact:** The repository shipped with 0 RSpec tests, no frontend test runner, and no continuous integration. Developers could not verify whether changes introduced regressions or broke tenant isolation.
- **Resolution:** Configured RSpec 6.0 with FactoryBot and 30 specs; configured Vitest with Testing Library and 13 specs; configured GitHub Actions CI pipeline executing both suites on pull requests.
