# Product Engineer Case Study: AI Interview Platform Revamp
**Author:** Candidate (Fullstack Product Engineer)  
**Branch:** `feature/interview-evaluation-revamp`  
**Repository Fork:** [github.com/aldxynnn/ai-interview-platform](https://github.com/aldxynnn/ai-interview-platform)  
**Target Pull Request:** Upstream `main` (`github.com/rakamindev/ai-interview-platform`)

---

## Executive Summary

The **Rakamin AI Interview Platform** conducts real-time conversational technical interviews using Google Gemini Live, dynamically tracks skill coverage, synthesizes candidate portfolios, and compares candidate competency profiles against job vacancies (Fit/Gap analysis). 

As a **Product Engineer**, our objective is not merely writing code to specification, but owning the product's ultimate outcome: **producing dependable, objective, fair, and legally compliant talent evaluations that empower Indonesian hiring teams while protecting candidate livelihoods under UU PDP (Undang-Undang Perlindungan Data Pribadi).**

This submission introduces a comprehensive revamp across the backend (`api/`) and frontend (`web/`), establishes the platform's first complete automated test harness (**43 automated tests: 30 RSpec backend tests + 13 Vitest frontend tests**), configures continuous integration (`.github/workflows/ci.yml`), and resolves critical P0-P3 flaws spanning model timeouts, JSON parsing brittleness, data loss during recomputation, and UI state omissions.

---

## 1. GitHub Pull Request Link & Submission Structure

- **Fork URL:** `https://github.com/aldxynnn/ai-interview-platform`
- **Feature Branch:** `feature/interview-evaluation-revamp`
- **Submission Type:** Option A — Single Comprehensive Pull Request with focused, logically sequenced commits:
  1. `build(infra): configure cors, timezone data, test harness dependencies, and CI workflow`
  2. `fix(api): harden fit_gap engine, portfolio generator, and session lifecycle guards`
  3. `feat(api): add override deletion endpoint and preserve existing reports on recomputation`
  4. `feat(web): enhance ComparisonTable and OverridePanel with human override rollback and empty states`
  5. `test(api): introduce 30 comprehensive RSpec unit and integration tests`
  6. `test(web): introduce 13 Vitest unit tests covering helpers, badges, and components`
  7. `docs(assessment): add Monozukuri engineering report, findings matrix, and trade-off analysis`

---

## 2. Deep Context & Domain Immersion (Step 2)

### 2.1 The Industry & Hiring in Indonesia
In Indonesia's rapidly digitizing tech and startup ecosystem, tech hiring suffers from two acute pain points:
1. **Resume Inflation & Screening Noise:** High volume of applicants leads to recruiter fatigue, often resulting in superficial keyword filtering rather than genuine capability assessment.
2. **High Cost of Senior Engineering Time:** Senior engineers and engineering leads spend 10–15 hours weekly conducting repetitive first-round screening interviews.

AI-conducted technical interviews present enormous leverage by standardizing the top of the funnel. However, if the AI output is hallucinatory, brittle, or opaque, recruiters lose trust and revert to manual interviews, destroying product value.

### 2.2 The Target Users
- **Recruiters & Talent Acquisition (TA):** Need fast, trustworthy candidate summaries that map directly to open vacancies. They care about clear match/gap indicators, easy vacancy comparisons, and exportable reports.
- **Assessors & Hiring Managers:** Need defensible evidence quotes from the interview. They demand full agency over the final decision, requiring the ability to review AI ratings, inject human judgment via **assessor overrides**, and revert overrides if needed.

### 2.3 The People Affected: Candidates & UU PDP (Law No. 27 of 2022)
Candidates do not choose this software; they are subjected to it. A false negative or a hallucinated skill gap can cost a candidate a life-changing career opportunity.
- **Indonesian PDP Law (UU PDP) Compliance:**
  - **Data Minimization (Article 16):** Only capture and persist interview audio and transcripts strictly relevant to job competencies. No sensitive personal data (religion, political views, private medical data) should be prompted, logged, or retained.
  - **Right to Rectification & Human Review (Article 37):** Fully automated hiring decisions without human oversight present severe compliance risks. Our system enforces the **Human-in-the-Loop** model: AI produces initial recommendations, but human assessors can override ratings with documented rationale.
  - **Secure Logging:** Transcripts and personal identifiable tokens must never be dumped to unprotected console logs or third-party observability platforms.

---

## 3. Problem & Gap Analysis to Ideal Condition (Step 3)

| ID | Sev | Component | Defect Type | Impact Statement |
|---|---|---|---|---|
| **F-01** | **P0** | `Portfolios::Generator` | Defective Implementation | **Silent Portfolio Generation Failure:** Gemini output containing markdown code fences (` ```json `) or conversational preamble threw unhandled `JSON::ParserError`, abandoning candidate portfolios in `failed` state with no recovery. |
| **F-02** | **P0** | `FitGap::Engine` / `ComparisonTable.tsx` | Data Seam Mismatch | **Frontend Render Crash / Broken Comparison:** API emitted `expected_level`, while frontend component expected `required_level`, leading to `undefined` badges and NaN deltas on candidate comparisons. |
| **F-03** | **P1** | `Sessions::StartHandler` | Missing Specification | **Ended Session Re-activation Vulnerability:** A disconnected candidate could hit the WebSocket middleware and re-activate an already `ended` or `failed` session, corrupting completed interviews and triggering duplicate Sidekiq workers. |
| **F-04** | **P1** | `PortfolioSkillsController` | Missing Specification | **Irreversible Assessor Overrides:** Assessors could override an AI rating, but had no way to remove an override or revert to the original AI score if an override was entered in error. |
| **F-05** | **P1** | `PortfolioSkillsController#regenerate_stale_fitgap_reports` | Defective Implementation | **Destructive Report Deletion:** Recomputing fit/gap reports called `destroy_all` before running the async worker; if the background worker failed or hit rate limits, previous hiring reports were permanently lost. |
| **F-06** | **P2** | `ComparisonTable.tsx` | UI/UX Neglect | **Omission of Interaction States:** Empty comparisons displayed a blank table with no helper text; human override indicators lacked assessor notes; summary row omitted not-assessed counts. |
| **F-07** | **P2** | `AudioWebSocketMiddleware` | Architecture Debt | **Dangling WebSocket Connections:** Reconnecting to an ended session left the socket open without sending a clean termination code, causing candidate browsers to spin endlessly. |
| **F-08** | **P3** | Test Suite Baseline | Missing Infrastructure | **Zero Automated Safety Net:** Repo had 0 RSpec tests, no frontend test runner, and no continuous integration pipeline to verify changes against regressions. |

### Technical Lead Constraint Signal
- **Redis Connection Exhaustion:** Creating fresh `Redis.new` instances inside high-frequency WebSocket turn processing can exhaust Redis connection pools under load. Standardized on `Sidekiq.redis { |conn| ... }` connection leasing.
- **LLM Non-Determinism:** Large Language Models (Gemini Pro/Flash) occasionally emit conversational pleasantries or wrap JSON in backticks despite system prompt instructions. Core parsers must be robustly defensive.

---

## 4. Revamp Strategy, Acceptance Criteria & Trade-offs (Step 4)

### 4.1 Self-Defined Acceptance Criteria
1. **Resilient JSON Ingestion:** The parser must successfully extract valid JSON even if Gemini surrounds it with markdown code fences (` ```json `), trailing comments, or conversational text.
2. **Graceful Fallback Degradation:** If Gemini experiences an outage or timeout, the Fit/Gap engine must generate a deterministic rule-based narrative rather than crashing the request.
3. **Atomic Multi-Record Persistence:** Portfolio skill saves must be wrapped in database transactions so that partial failures do not leave orphaned or truncated skills.
4. **Human Override Reversibility:** An assessor must be able to remove an existing override via `DELETE /api/v1/portfolio_skills/:id/override`, restoring the AI baseline score.
5. **Session Lifecycle Invariants:** A session in `ended` or `failed` state must reject all re-activation attempts.

### 4.2 Trade-off Analysis: Architectural Alternatives

#### Option A: Resilient In-Process Parser + Graceful Fallbacks + Transactional Safety *(Chosen)*
- **Impact vs Cost:** High immediate impact. Solves 100% of parser crashes, ensures idempotent reports, and preserves data integrity without introducing complex infrastructure.
- **Maintainability:** Standard Ruby/Rails and React conventions; single source of truth; low cognitive overhead for new team members.
- **Failure Modes:** If the LLM is completely down, reports still generate with quantitative delta tables and automated fallback narratives.

#### Option B: Dedicated JSON Schema Strict Enforcer Microservice
- **Trade-off:** High architectural complexity. Requires running an external validation proxy. Rejected due to latency overhead and operational cost.

#### Option C: Client-Side Gemini Ingestion
- **Trade-off:** Massive security risk. Exposing Gemini API keys and assessment prompts to candidate browsers violates UU PDP and invites assessment tampering.

---

## 5. Monozukuri Implementation Proof (Step 5)

### 5.1 Automated Test Harness
We built an automated testing suite from scratch across both services:
- **Backend (RSpec):** **30 examples, 0 failures**
  - `spec/services/coverage/state_engine_spec.rb` (16 tests): monotonic progression, probe count gates, multi-step resolution.
  - `spec/services/fit_gap/engine_spec.rb` (4 tests): match/gap/exceed/not-assessed computation, override precedence, markdown fence stripping, fallback narrative on LLM failure.
  - `spec/services/portfolios/generator_spec.rb` (3 tests): configured and discovered skills parsing, confidence normalization, timeout error handling.
  - `spec/services/sessions/start_handler_spec.rb` (4 tests): activation, coverage map generation, idempotency, ended/failed state re-activation guards.
  - `spec/services/sessions/end_handler_spec.rb` (3 tests): duration computation, portfolio enqueuing, reason normalization, error-to-clean upgrade.
- **Frontend (Vitest):** **13 tests, 0 failures**
  - `src/utils/__tests__/constants.test.ts` (7 tests): level parsing, label mappings, badge classes, coverage widths.
  - `src/components/fitgap/__tests__/ComparisonTable.test.tsx` (3 tests): empty state rendering, full comparison table, backward-compatibility fallback.
  - `src/components/portfolio/__tests__/SkillPortfolioCard.test.tsx` (3 tests): evidence quotes, competency summaries, discovered badges, low confidence warnings.

### 5.2 Seeded Fault Test Proof
To demonstrate that our test suite genuinely asserts behavior rather than executing shallow code, we ran a **Seeded Fault Test**:
1. **Fault Injected:** In `Coverage::StateEngine.valid_transition?`, we intentionally weakened the probe count gate from `probe_count < 2` to `probe_count < 1`.
2. **Result:** RSpec immediately caught the regression:
   `Coverage::StateEngine.valid_transition? when transitioning from initiated blocks transition to partial if probe_count is less than 2: Failure/Error: expect(...).to be false`
3. **Restoration:** Restored the strict `< 2` check; all tests returned to green.

### 5.3 AI Verification Moment
During implementation, an AI code assistant suggested using:
`PortfolioSkill.where(portfolio_id: @portfolio.id).update_all(ai_level: ...)`
**Risk & Why It Was Wrong:** `update_all` bypasses Active Record validations and tenant scoping defaults, leaving the database vulnerable to invalid level values (e.g., level 0 or level 9) that violate PostgreSQL check constraints (`chk_portfolio_skills_ai_level`).
**How Verified & Fixed:** We rejected `update_all` and implemented atomic, validated model persistence wrapped in an explicit database transaction with level clamping (`level = 1 if level < 1 || level > 5`).

---

## 6. Verification Commands & CI Status

```bash
# Backend test suite (30 specs)
cd api
bundle exec rspec

# Frontend test suite (13 specs)
cd web
npm test

# Frontend production build
cd web
npm run build
```

The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) runs both test suites on every pull request to guarantee zero regressions.
