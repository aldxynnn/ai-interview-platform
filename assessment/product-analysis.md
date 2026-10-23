# Step 2–3: Product Context and Gap Analysis

## 1. Product context

### What the product appears to do

Repository routes, model names, and UI screens describe an AI-assisted interview and assessment workflow:
- Assessors configure assessments and skill requirements.
- A candidate completes an interview session; transcript turns and coverage maps are recorded.
- A background process generates a portfolio of skills, levels, confidence, evidence, and competency summaries.
- An assessor can override an AI level.
- A Fit/Gap report compares a portfolio against a vacancy's required skill levels.
- Portfolio and report data can be exported.

This description is derived from repository inspection, not a live product walkthrough. The original brief requires the live workflow, database records, and API payloads to be checked locally; that runtime verification remains outstanding because a local clone could not be obtained in this environment.

### Users and their jobs

| User | Job to be done | Cost of an unreliable result |
|---|---|---|
| Assessor/interviewer | Interpret evidence, calibrate skill ratings, and explain adjustments | Rework, poor calibration, false confidence |
| Recruiter | Compare job requirements against consistent evidence and coordinate next steps | Slower hiring and misleading shortlists |
| Hiring manager | Understand strengths, gaps, uncertainty, and evidence before deciding | Poor hiring decision or missed talent |
| Candidate (affected person) | Be assessed consistently, have their evidence interpreted fairly, and not be harmed by missing/inaccurate data | A real opportunity can be lost because of a system flaw |

The candidate is a first-class stakeholder even though they are not the buyer and may not choose the assessment platform.

### Product outcome

The useful outcome is not merely to generate a score. It is to help a human make a more informed, explainable assessment from evidence, with uncertainty visible and the source data protected.

## 2. Domain and personal-data considerations

The brief calls out Indonesia's Personal Data Protection Law (UU PDP). Candidate identity, interview transcripts, AI-generated skill profiles, assessor notes, and assessment decisions are personal data or can be linked to an identifiable person. A cross-tenant read is therefore a product and privacy incident, not only a backend bug.

Design implications:
- Scope authenticated resources to the tenant derived from trusted request context, not an untrusted tenant ID supplied by the browser.
- Do not expose raw provider exceptions to users or log prompts/transcripts/credentials.
- Send only the minimum context needed to an external model; exclude candidate names, invite tokens, transcripts, and raw evidence from this Fit/Gap narrative prompt.
- Explain that model-generated narrative is advisory, not a decision. Preserve assessor override and human review.
- Treat `not_assessed` separately from `gap`; missing evidence must not be turned into a negative judgement.

**External legal source:** Indonesia, UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. Official regulatory database: https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022. This engineering assessment is not legal advice and does not establish that the entire application is legally compliant.

A further relevant external source is Ministry of Manpower Circular Letter M/6/HK.04/V/2025 on prohibition of discrimination in recruitment: https://jdih.kemnaker.go.id/peraturan/detail/2686/surat-edaran-menteri-nomor-6-tahun-2025. The design response is to avoid unsupported inferences, distinguish uncertainty, and retain human review; a broader fairness audit is outside this implementation slice.

## 3. Severity-ranked findings

Severity prioritises harm and exploitability, not the number of lines changed. Findings are based on static inspection of the repository's default-branch code before the feature work. Local reproduction remains pending.

### P0 — Tenant boundary not consistently enforced on portfolio resources
- **Class:** Defective implementation of access control.
- **Evidence in code:** `PortfoliosController` looked up portfolio by bare ID for Fit/Gap, regeneration, and export operations. `PortfolioSkillController` initially found skills through the portfolio ID without joining to the current tenant's session.
- **Impact:** An authenticated assessor who can guess or obtain another tenant's numeric resource ID could potentially view candidate reports, export data, regenerate results, or change ratings across tenant boundaries.
- **Desired condition:** Scope portfolio access through its owning session's tenant and scope vacancy lookups through the current tenant. Return a non-revealing 404 for IDs outside the caller's workspace. Enforce same-tenant ownership again in the worker/engine because background jobs cannot rely on request scoping.

### P1 — Required level contract mismatched between API and frontend
- **Class:** Defective implementation.
- **Evidence in code:** API serialisation and the Fit/Gap engine return `expected_level`; `web/src/types/index.ts` and the previous table expected `required_level`.
- **Impact:** The required level may display as a blank/undefined label, so assessors cannot reliably compare the candidate's level to the vacancy's actual requirement.
- **Desired condition:** Keep one explicit schema across calculation, JSON response, TypeScript types, and presentation. Test the expected level and result together.

### P1 — Report absence could enqueue duplicate generation jobs
- **Class:** Defective implementation; a full status/lifecycle contract was also missing.
- **Evidence in code:** The previous UI caught a 404 from report fetch and called the generation endpoint. During polling, repeated 404s could repeatedly submit the same request; the prior worker had retries but no report-level generation lease/version.
- **Impact:** Duplicate model calls, unnecessary cost/latency, race conditions, and stale output overwriting newer assessor input.
- **Desired condition:** Store explicit status, reserve generation atomically, use a version/fencing mechanism for stale jobs, and poll status without continuously triggering new work.

### P1 — AI narrative was not a strict dependency for report correctness
- **Class:** Defective implementation; missing failure-state specification.
- **Evidence in code:** The previous engine rescued model errors and provided only a partial fallback; its fallback response did not consistently communicate the status of the narrative.
- **Impact:** Structured comparisons could be correct while the explanatory narrative is blank or misleading, and the UI could fail to tell the assessor what happened.
- **Desired condition:** Compute skill comparisons deterministically. Validate model response shape; if the model fails, present a neutral, clearly-labelled fallback narrative. Never treat model output as an automatic hiring decision.

### P2 — Error details and generation states needed safer presentation
- **Class:** Defective implementation.
- **Evidence in code:** The previous API serializer returned the raw `generation_error`, and the UI handled initial fetch errors silently. The report model did not have an explicit generation-status lifecycle.
- **Impact:** Provider/internal details may leak and users can be left staring at an empty page without knowing whether the report is queued, failed, or missing.
- **Desired condition:** Keep internal logs to error classes and resource IDs; expose generic user-safe messages and explicit pending/generating/complete/failed states.

### P2 — Assessment uncertainty and override provenance not sufficiently visible in Fit/Gap
- **Class:** Defective presentation plus a missing product requirement.
- **Evidence in code:** Backend comparison payload had confidence and override fields, but the prior comparison table displayed neither confidence nor a clear per-row override label.
- **Impact:** An assessor could confuse a low-confidence AI estimate with a reliable rating, or overlook that a human changed it.
- **Desired condition:** Display confidence, assessor-adjusted provenance, and the distinct `not_assessed` outcome. Missing assessment is not a gap.

### P2 — Testing/CI harness absent at baseline
- **Class:** Missing engineering specification/infrastructure, not a claim that a particular functional test was broken.
- **Evidence in code:** Frontend package had no test script/test runner; repository brief itself states RSpec had no specs and no CI.
- **Impact:** Regressions in score computation, API contract, and failure UX could be shipped undetected.
- **Desired condition:** Add repeatable backend/frontend tests and CI that runs tests plus production build.

### P3 — Long names and compact viewport need an intentional table strategy
- **Class:** Product-quality gap.
- **Evidence in code:** Previous screen constrained the page to `max-w-2xl` and rendered a four-column table without a confidence column.
- **Impact:** Adding meaningful context to the report risks crowding the table on mobile.
- **Desired condition:** Responsive report summary cards; table can scroll horizontally on narrow viewports; labels wrap/clamp safely; empty state is explicit.

## 4. Constraint signal to escalate to a Tech Lead

1. The data model is multi-tenant and uses a shared Postgres database with a custom tenant scope. The team should audit *every* endpoint, export route, worker, nested association, and WebSocket path for tenant ownership, not just this Fit/Gap slice.
2. Fit/Gap data lives in a unique `(portfolio_id, vacancy_id)` row. An async queue and a database status change are not one distributed transaction. Production-grade delivery may need a transactional outbox, enqueue reconciliation, monitoring, and a documented stuck-job recovery policy.
3. The repo's test harness was empty at baseline and the application depends on Postgres, Redis/Sidekiq, and Gemini config. CI needs a predictable test database and mocked external-model tests; live API keys must never be required in test.
4. Live product-flow, seeded-fault, screenshot, and video proof must be obtained in a local or CI-capable runtime. A static source review is not sufficient evidence that the entire application runs.
