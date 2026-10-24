# Step 4–5: Self-Derived Acceptance Criteria

The criteria below are intended to be observable and testable. "Must" means the implementation is expected to satisfy the condition before release.

## A. Access and data safety

1. A user who is authenticated as an assessor can read, generate, regenerate, and export only portfolio/vacancy data belonging to their current tenant.
2. A numeric ID owned by another tenant returns a non-revealing not-found response; the response must not reveal its candidate, vacancy title, status, or existence.
3. The skill-override endpoint scopes the skill through its parent portfolio's session tenant. A client-supplied tenant ID cannot replace trusted tenant context.
4. The worker/engine re-check that portfolio's session and vacancy are in the same tenant before generating output.
5. API errors shown to the user are generic and actionable. Logs contain event/resource IDs and error classes, not authorization tokens, candidate names, transcripts, raw prompts, or provider response bodies.

## B. Comparison logic and data contract

1. Every vacancy skill appears once in the comparison result, including when the candidate has no corresponding portfolio skill.
2. The API response, TypeScript interface, and React table use the same `expected_level` field for the level required by the vacancy.
3. Match logic is deterministic:
   - `candidate_level == expected_level` → `match`, delta `0`.
   - `candidate_level > expected_level` → `exceed`, positive delta.
   - `candidate_level < expected_level` → `gap`, negative delta.
   - no assessed value → `not_assessed`, candidate level and delta `null`.
4. The assessor override value, when present, is the effective level used to compute result and delta. The row clearly identifies that a human override was applied.
5. Stable skill IDs are preferred for matching. Label fallback is case-insensitive and only applies when ID matching did not succeed.
6. Candidate levels and expected levels remain in the defined L1–L5 range, enforced by existing data constraints/models. Missing confidence is rendered as unavailable rather than invented.
7. A vacancy with no skills can finish with an empty comparison array and a purposeful empty state; it must not be represented as a candidate skill gap.

## C. Generation, failures, and retry

1. Report state is always explicit: `pending`, `generating`, `complete`, or `failed`.
2. A first request reserves a report row before enqueue; repeated requests reuse the current report rather than queue a new job on every poll.
3. Duplicate worker deliveries for the same current version do not generate a second result.
4. A worker with an out-of-date generation version cannot persist data over newer assessor input.
5. A job that fails after a generation claim transitions the current generation to `failed` without persisting a partial completion.
6. If enqueue reports failure, the UI gets a safe failure response and offers retry; the candidate's saved assessment data remains intact.
7. A timeout, invalid JSON response, missing narrative fields, or AI API failure does not change deterministic skill comparisons into a failed or missing score. Instead, a neutral fallback narrative appears and human review remains required.
8. A retry increments the generation version and clears stale output so assessors can tell that a new report is being produced.
9. A report that is pending or generating can be polled without repeatedly initiating generation. Polling stops after complete/failed status.

## D. UI/UX and responsive states

1. Initial page load shows skeleton/loading feedback rather than a blank panel.
2. A pending/generating report explains what's happening and updates automatically.
3. A failed load or generation shows a safe explanation and a retry action.
4. A completed report shows required vs assessed level, confidence, result, delta, and override provenance.
5. `not_assessed` is visually and semantically distinct from `gap`; it is never counted as a demonstrated gap.
6. Summary counts are consistent with the table row results and include unassessed skills.
7. Long skill labels and wide tables remain legible; narrow viewports can scroll the table horizontally without hiding primary summary/context.
8. Empty comparisons render an explanation rather than an empty table.
9. Export buttons appear only for completed reports; export failures produce feedback and do not silently fail.
10. Copy explains the report is decision support, not an automated hiring decision. Candidate evidence and context still require human review.

## E. Migration and maintainability

1. Migration is reversible and gives existing report records a backward-compatible `complete` status by default.
2. The report's `generation_version` is monotonically increasing across regeneration.
3. Tests run without real Gemini credentials; narrative tests stub the model client.
4. CI runs frontend tests and production build plus Rails RSpec.
5. No test assertion is weakened merely to obtain a green build.
