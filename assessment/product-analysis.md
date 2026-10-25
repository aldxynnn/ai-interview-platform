# Product analysis — AI Interview Platform

## Scope and evidence boundary

This review is based on the assignment brief and source code in `api/` and `web/`. It is not a claim that the application was exercised end-to-end in a local browser or against production data. No real candidate data is used in this analysis.

## Product outcome

The product turns a structured interview into a skill portfolio with supporting evidence, then compares those skills with vacancy requirements. Its value is not the presence of an AI-generated score; it is whether assessors can make a better-informed, traceable human judgment with less manual synthesis.

## People and their needs

- **Assessor:** needs clear evidence, confidence/uncertainty, editable human judgment, and a reliable way to revisit or export results.
- **Recruiter / hiring manager:** needs a role-relevant comparison that distinguishes a real skill gap from a skill that was not assessed.
- **Candidate:** may not choose the tool but is affected by its output. The interface and data lifecycle should avoid presenting uncertain AI narrative as an objective verdict, protect interview material, and preserve human review.

## Ideal condition

1. Every read/write is confined to the active tenant.
2. A new AI result is validated before it replaces a prior result.
3. Manual assessor overrides are not silently discarded by regeneration.
4. Fit/gap status and errors are explicit; the previous successful report remains visible while a replacement is running.
5. Missing expected levels and unassessed skills are not treated as numeric gaps.
6. Narratives are advisory, bounded to the structured comparison, and do not recommend automatic acceptance/rejection.
7. Logs and persisted errors do not copy raw provider messages or candidate content.
8. A recruiter can upload a text-based vacancy PDF from the Fit/Gap flow, review the extracted role/skills/levels, then explicitly choose to run the comparison.

## Findings at baseline

Severity describes potential impact inferred from the code path; it is not a claim that an exploit or production incident was reproduced.

| Severity | Type | Finding | User impact |
|---|---|---|---|
| P1 | Defective implementation | Several assessor endpoints used direct ID lookups for assessments, sessions, portfolios, vacancies, or portfolio skills rather than an explicit tenant-constrained lookup. | A cross-tenant identifier could expose or modify assessment material if other scoping layers fail to constrain the request. |
| P1 | Defective implementation | Portfolio regeneration deleted old skills before inserting the new AI result, without a transaction around replacement. | A malformed response or mid-write failure could leave partial results and delete linked assessor overrides. |
| P1 | Defective implementation | Fit/gap regeneration destroyed the prior report before the background job was queued. | Queue failure or job failure could remove the last useful report. |
| P2 | Defective implementation | The fit/gap engine subtracted an expected level without consistently handling a missing expected level. | Incomplete vacancy data could fail generation instead of clearly showing “not assessed.” |
| P1 | Defective implementation | Gemini client configured `f.request :retry` without explicitly requiring `faraday/retry`, and the default model/endpoint targeted retired Gemini 2.0 identifiers. | Portfolio generation could fail before producing a result; assessors only saw a generic failed state. |
| P2 | Defective implementation | Portfolio and fit/gap pages swallowed or under-surfaced some request failures. | Assessors could see a blank/stuck state without a clear recovery path. |
| P2 | Specification gap | Fit/Gap did not offer an upload path to turn a vacancy PDF into structured, reviewable role requirements. | Recruiters had to manually transcribe job descriptions before comparing a candidate.
| P2 | Specification gap | The baseline did not define a lifecycle contract for report refreshes, stale jobs, and the availability of the last successful report. | UI and background processing could disagree about whether a report was ready or lost. |
| P2 | Specification gap | The brief expects automated regression and a seeded fault test, but the baseline tree did not include an established spec suite or frontend test runner. | Changes would be difficult to prove and future regressions could escape review. |
| P1 | Defective implementation | Gemini client configured Faraday retry middleware without explicitly requiring `faraday/retry`, and defaulted to retired Gemini 2.0 text model IDs. | Portfolio generation could fail before the provider request; the assessor saw only a generic failure. |
| P2 | Defective implementation | The fit/gap engine returned `expected_level`, while the comparison table rendered `required_level`. | Required-level labels could render as missing/undefined even when the report was generated. |
| P2 | Specification gap | Fit/Gap did not offer an upload path to turn a vacancy PDF into structured, reviewable role requirements. | Recruiters had to manually transcribe job descriptions before comparing a candidate. |

## Issues confirmed after the first implementation pass

- **Portfolio generation:** CI exposed that the Gemini client raised `Faraday::Error` while configuring retry middleware because `faraday/retry` was not required. The source also defaulted to retired Gemini 2.0 text model IDs. The implementation now requires the middleware, uses the `v1beta` GenerateContent endpoint, maps legacy model identifiers to `gemini-3.8-flash`, and keeps transient worker failures retryable instead of prematurely setting the portfolio to failed. See the failing pre-fix run and passing API job recorded in the verification plan.
- **Fit/gap presentation:** the API now returns both the internal `expected_level` and the UI contract `required_level`, and regression assertions cover the latter.
- **PDF workflow:** a text-based job-description PDF can be uploaded from the Fit/Gap page or vacancy creation flow. The extracted role and skill levels are shown for human review before the assessor chooses to run the comparison. The original PDF is not persisted.

## Constraint signal to a Technical Lead

Tenant ownership is spread across request middleware, model default scopes, associations, controllers, and asynchronous jobs. A controller-only fix is fragile; the critical path needs explicit tenant checks at request boundaries and at the fit/gap service boundary. The local environment was not available in this run because GitHub clone access from the execution container failed at DNS resolution, so CI and source review are the available verification paths. An initial attempt to boot the full Rails app for specs also failed with `NameError: uninitialized constant AudioWebsocketMiddleware`; the current suite avoids app boot and does not prove request-level integration. A full manual walkthrough and real screenshots remain separate release gates.

## UU PDP considerations

The platform processes interview transcripts and candidate assessments. Treat transcript text, candidate identity, evidence quotes, and invite tokens as sensitive. Minimize the data sent to the narrative model, avoid copying raw provider exceptions into logs or persisted error messages, and keep a human assessor responsible for decisions. These controls reduce exposure risk but are not a legal compliance certification; retention, access policy, notices, lawful basis, and data-subject processes need organization-level review.
