# 04 — Revamp Strategy, Solution Options, & Recommended Solution

**Role**: Senior Product Engineer  
**Date**: October 2026  
**Decision Scope**: Fullstack Solution for 4-Day Implementation Deadline

---

## 1. Comparative Analysis of Solution Options

To resolve the core problems identified in the audit (broken Fit/Gap data contracts, Sidekiq job flooding on 404, multi-tenant IDOR security leaks, and lack of test coverage), three architectural approaches were evaluated:

| Evaluation Dimension | Option 1: Ad-hoc Frontend Patch | Option 2: Fullstack Revamp & Contract Hardening (Recommended) | Option 3: Event-Driven CQRS Redesign |
|---|---|---|---|
| **Core Concept** | Quick client-side transformation to map fields and suppress 404 polling errors. | High-impact fullstack vertical slice: harmonized API contract, resilient async lifecycle, tenant security, polished UI, and automated test suite. | Split reporting into an event-driven microservice with Redis Pub/Sub, Kafka, and full CQRS event sourcing. |
| **Product Impact** | **Low**. Restores table text visually, but leaves backend job flooding, security leaks, and export failures intact. | **Very High**. Transforms broken vacancy matching into a reliable, enterprise-ready feature; satisfies UU PDP compliance; restores recruiter trust. | **High**, but introduces disproportionate operational overhead and complexity for this stage of the product. |
| **Implementation Cost & Effort** | ~4 hours of frontend tweaks. | ~2–3 engineering days (comfortably fits the 4-day deadline). | ~2–3 weeks of distributed systems engineering. |
| **Long-Term Maintainability** | **Poor**. Increases technical debt and preserves hidden backend contract divergence. | **High**. Clean domain boundaries, explicit data contracts, and reusable RSpec test suite. | **Low**. High cognitive load, difficult local developer onboarding, and complex debugging. |
| **Reversibility** | Extremely high (single file revert). | High (standard Git commits, reversible changes, zero data corruption). | Low (deep architectural lock-in). |
| **Failure Modes & Stress** | Still breaks under Sidekiq delay; duplicate jobs still crash Redis; tenant data remains exposed. | Robustly handles Gemini rate limits (429), timeouts, model errors, partial writes, and duplicate polling. | Vulnerable to message queue consumer lag, split-brain states, and distributed tracing failures. |
| **Fit for 4-Day Deadline** | Completes fast, but fails Monozukuri craftsmanship rubric. | **Optimal**. Delivers deep, verified product transformation with high engineering rigor. | **Unrealistic**. Severe risk of incomplete delivery. |

---

## 2. Why Option 2 is the Recommended Solution

Option 2 directly targets the highest-leverage product value: **making candidate vacancy evaluation dependable, secure, and delightful for recruiters and hiring managers.**

It adheres strictly to the Monozukuri engineering ethos:
1. **End-to-End Rigor**: Touches both services (`api/` and `web/`), the underlying data model, background job orchestration, and the client presentation layer.
2. **Defensive by Design**: Solves duplicate job flooding, model timeouts, partial write vulnerabilities, and multi-tenant isolation breaches.
3. **Legal Compliance**: Meets Indonesian UU PDP requirements for human-in-the-loop oversight (Pasal 10) and personal data security (Pasal 35 & 39).
4. **Proven by Tests**: Accompanied by a reliable automated test harness (RSpec and frontend tests) verifying happy paths, edge cases, and failure modes.

---

## 3. High-Impact Fullstack Scope of Option 2

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Option 2 Architecture                         │
└────────────────────────────────────────────────────────────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
   [ Backend API & Data ]                          [ Frontend UX ]
   • Harmonize Fit/Gap Contract                    • Render Required & Overrides
   • Atomic Transactions                           • Idempotent Polling
   • Enforce Tenant Scoping                        • Discovered Skills Polish
   • Graceful Fallback Narratives                  • Loading & Error States
         │                                               │
         └───────────────────────┬───────────────────────┘
                                 ▼
                     [ Automated Test Harness ]
                     • Model & Tenant Specs
                     • Service & Contract Specs
                     • Seeded Fault Verification
```

### Module 1: Backend API & Data Modeling (`api/`)
1. **Contract Harmonization (`FitGap::Engine`)**:
   - Provide both `required_level` and `expected_level` in comparison JSON to eliminate client-server ambiguity.
   - Inject `is_override: true/false`, `assessor_notes`, `ai_level`, and `effective_level` into each skill comparison item.
   - Ensure `not_assessed` skills preserve `candidate_level: nil` and `delta: nil`.
2. **Resilient Asynchronous Lifecycle (`PortfoliosController#fitgap` & `show_fitgap`)**:
   - Return HTTP `202 Accepted` with `{ status: "generating" }` when a report is being generated, rather than returning HTTP 404.
   - Enforce job deduplication: check if report generation is already queued or active before enqueuing `FitGapGeneratorWorker`.
3. **Non-Destructive Overrides (`PortfolioSkillsController#override`)**:
   - Remove destructive `report.destroy` call. Overwrite existing reports atomically upon job completion instead of wiping them out.
4. **Data Transaction Safety (`Portfolios::Generator#save_skills`)**:
   - Wrap skill destruction and insertion within an explicit `ActiveRecord::Base.transaction` block to guarantee all-or-nothing writes.
5. **Tenant Scoping Enforcement (UU PDP Security)**:
   - Add tenant verification to `PortfoliosController` actions (`show`, `fitgap`, `regenerate_fitgap`, `show_fitgap`, `export`) by verifying that `portfolio.session.tenant_id == current_tenant_id`.
   - Add tenant verification to `PortfolioSkillsController#override`.

### Module 2: Frontend UX & Presentation (`web/`)
1. **Comparison Table Polish (`ComparisonTable.tsx`)**:
   - Render `{LEVEL_LABELS[c.required_level || c.expected_level]}` safely with fallback.
   - Display a distinct, elegant human override indicator (`✏ Overridden`) with tooltip details showing AI vs Assessor score.
   - Render `not_assessed` skills with clean neutral badge styling.
2. **Polished Interaction States (`FitGapReportPage.tsx`)**:
   - Cleanly handle `generating` state from HTTP 202 without triggering duplicate enqueue calls.
   - Stop polling automatically if maximum retries are reached or an explicit error is returned.
   - Provide an actionable "Retry Generation" UI on failure.
3. **Discovered Skills Display**:
   - Format discovered skill levels using standard `LevelBadge` (`L1`–`L5`).
   - Reflect effective overridden levels if the assessor calibrated a discovered skill.
4. **Responsive Layout**:
   - Ensure the comparison table, summary counters, and narratives render harmoniously on desktop, tablet, and mobile breakpoints.

### Module 3: Automated Test Harness & Verification
1. **RSpec Test Harness (`api/spec/`)**:
   - Configure RSpec, `factory_bot_rails`, and database transactions.
   - Model specs: test validations and check constraints.
   - Service specs: test `FitGap::Engine` with all comparison combinations (match, exceed, gap, unassessed, overrides) and model timeout fallbacks.
   - Request specs: test tenant isolation (Tenant A cannot access Tenant B's portfolios) and HTTP response codes (200, 202, 404).
2. **Seeded Fault Test**:
   - Introduce an intentional mutation (e.g. breaking override calculation or tenant check) on a scratch branch to verify the test suite catches it, then revert with clean history.

---

## 4. Planned Files to Modify

| Service | File Path | Nature of Change |
|---|---|---|
| **API** | `api/app/services/fit_gap/engine.rb` | Harmonize contract fields (`required_level`, `is_override`), ensure unassessed handling and fallback narratives. |
| **API** | `api/app/controllers/api/v1/portfolios_controller.rb` | Add tenant scoping check; return 202 `generating` instead of 404; deduplicate worker calls. |
| **API** | `api/app/controllers/api/v1/portfolio_skills_controller.rb` | Add tenant scoping check; replace destructive report deletion with safe asynchronous updates. |
| **API** | `api/app/services/portfolios/generator.rb` | Enclose `save_skills` within `ActiveRecord::Base.transaction` to prevent partial writes. |
| **API** | `api/app/services/exports/pdf_generator.rb` | Align PDF generator with harmonized contract fields and override badges. |
| **API** | `api/spec/` *(new)* | Setup RSpec harness and comprehensive test suite for models, services, and requests. |
| **Web** | `web/src/components/fitgap/ComparisonTable.tsx` | Fix required level rendering, format override indicator, polish badges. |
| **Web** | `web/src/pages/fitgap/FitGapReportPage.tsx` | Fix polling logic to eliminate duplicate job dispatches; polish discovered skills and error states. |
| **Web** | `web/src/types/index.ts` | Ensure TypeScript interface matches backend response payload. |
| **Web** | `web/src/services/portfolios.ts` | Clean up API client function names (`getOverride` → `submitOverride`). |

---

## 5. Risk Assessment & Mitigation Strategies

| Risk Description | Severity | Probability | Mitigation Strategy |
|---|---|---|---|
| **Gemini API Outage / Rate Limit** | High | Low–Medium | `FitGap::Engine` has a deterministic rule-based fallback narrative, ensuring report generation succeeds even when AI API is unavailable. |
| **Regression in PDF Export** | Medium | Low | Harmonized contract preserves existing keys (`expected_level`) alongside `required_level`, maintaining full backward compatibility. |
| **Database Lock Contention** | Medium | Low | All transactions are tightly scoped around single-record updates without long external HTTP calls inside transactions. |
| **Tenant Scoping Breaking Valid Requests** | High | Low | Scoping strictly follows `Current.tenant_id` from the existing authenticated JWT token, identical to `Assessment` and `Session`. |
