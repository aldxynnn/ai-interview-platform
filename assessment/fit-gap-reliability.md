# Fit/Gap Report Reliability — Case Study Notes

## Scope
Focused change to the fit/gap calculation and report screen, avoiding a broad refactor.

## Product context
This report supports assessors and hiring teams. Candidates are affected by the output. An unassessed skill must remain distinct from a demonstrated gap, and AI narrative must not make unsupported hiring claims.

## Findings and severity
- **P1 — Defective implementation:** candidate and expected levels are subtracted whenever a portfolio skill exists, without a defensive validity check; this can create a runtime error or misleading classification if values are malformed.
- **P1 — Defective implementation:** parsed Gemini JSON is accepted even when narrative fields are absent or blank; the fallback omits unassessed counts.
- **P1 — Defective implementation:** the report screen swallows some API failures, leaving users without a clear error or recovery action.
- **P2 — Defective implementation:** the table omits the count of unassessed skills and assumes all incoming result values have presentation mappings.
- **P2 — Missing specification:** the report UI does not clearly explain that “not assessed” is not evidence of low ability and the narrative is not a final hiring decision.
- **Constraint signal:** the repository has no existing api/spec directory and the web package has no test runner. Local runtime verification needs the dependencies and database described in the README.

## Acceptance criteria
1. Skill matching uses skill ID first and trimmed case-insensitive label fallback.
2. Missing or invalid candidate/expected levels are classified as not_assessed, not match/gap/exceed.
3. Assessor override remains the effective candidate level and is explicitly represented in report data.
4. Missing, blank, malformed, or failed Gemini narrative output results in deterministic fallback text.
5. Error logs include the exception class, not exception text that could contain prompt or candidate data.
6. UI has visible request errors, recovery action, loading/empty states, responsive controls, and interpretation guidance.
7. Stored JSON structure and result names remain compatible; no migration is needed.

## Options and trade-offs
- **A — Minimal engine hardening and report UI (chosen):** no schema changes, limited diff, backward-compatible report format, addresses correctness and trust. Testing infrastructure remains an explicit gap.
- **B — Fully deterministic narrative:** simpler to test and avoids model variance, but loses contextual narrative.
- **C — Versioned API/report state machine and new frontend test harness:** broader and more maintainable long term, but additional setup and migration risk are disproportionate for this focused change.

## AI verification moment
A plausible but risky AI-generated approach was to trust parsed JSON as soon as JSON parsing succeeded. Syntactically valid output can still contain blank or missing narrative fields. The implementation validates both fields and uses deterministic fallback output. This should be tested using blank fields, invalid JSON, thrown client errors, and invalid skill levels.

## Verification status
The source was reviewed remotely and changes were authored through GitHub. Automated tests, seeded fault test, local browser checks, screenshots, and a demo video have not been run or created in this environment and must not be presented as completed.
