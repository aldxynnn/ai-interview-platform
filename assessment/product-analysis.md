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

## Findings at baseline

Severity describes potential impact inferred from the code path; it is not a claim that an exploit or production incident was reproduced.

| Severity | Type | Finding | User impact |
|---|---|---|---|
| P1 | Defective implementation | Several assessor endpoints used direct ID lookups for assessments, sessions, portfolios, vacancies, or portfolio skills rather than an explicit tenant-constrained lookup. | A cross-tenant identifier could expose or modify assessment material if other scoping layers fail to constrain the request. |
| P1 | Defective implementation | Portfolio regeneration deleted old skills before inserting the new AI result, without a transaction around replacement. | A malformed response or mid-write failure could leave partial results and delete linked assessor overrides. |
| P1 | Defective implementation | Fit/gap regeneration destroyed the prior report before the background job was queued. | Queue failure or job failure could remove the last useful report. |
| P2 | Defective implementation | The fit/gap engine subtracted an expected level without consistently handling a missing expected level. | Incomplete vacancy data could fail generation instead of clearly showing “not assessed.” |
| P2 | Defective implementation | Portfolio and fit/gap pages swallowed or under-surfaced some request failures. | Assessors could see a blank/stuck state without a clear recovery path. |
| P2 | Specification gap | The baseline did not define a lifecycle contract for report refreshes, stale jobs, and the availability of the last successful report. | UI and background processing could disagree about whether a report was ready or lost. |
| P2 | Specification gap | The brief expects automated regression and a seeded fault test, but the baseline tree did not include an established spec suite or frontend test runner. | Changes would be difficult to prove and future regressions could escape review. |

## Constraint signal to a Technical Lead

Tenant ownership is spread across request middleware, model default scopes, associations, controllers, and asynchronous jobs. A controller-only fix is fragile; the critical path needs explicit tenant checks at request boundaries and at the fit/gap service boundary. The local environment was not available in this run because GitHub clone access from the execution container failed at DNS resolution, so CI and source review are the available verification paths. A full manual walkthrough and real screenshots remain separate release gates.

## UU PDP considerations

The platform processes interview transcripts and candidate assessments. Treat transcript text, candidate identity, evidence quotes, and invite tokens as sensitive. Minimize the data sent to the narrative model, avoid copying raw provider exceptions into logs or persisted error messages, and keep a human assessor responsible for decisions. These controls reduce exposure risk but are not a legal compliance certification; retention, access policy, notices, lawful basis, and data-subject processes need organization-level review.
