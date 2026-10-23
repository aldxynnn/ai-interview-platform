# Product Engineer Case Study - Candidate interview startup reliability

## 1. Executive summary

**Primary finding (P1): the candidate can be told that an interview was recorded when the application has not established a working AI session.** This is a defective implementation at the API/WebSocket/frontend seam. The current frontend maps fatal WebSocket errors, retry exhaustion, and candidate-info request failures to the same `complete` state as a successfully finished interview. The completion screen then states that the interview has been recorded. The audio-capture hook also catches startup errors without rethrowing, allowing the start flow to continue after microphone setup fails.

The proposed enhancement introduces a distinct `failed` outcome, structured and safe startup-error messages, retry-safe backend recovery before transcript evidence exists, and explicit regression tests. The intended product invariant is: **successful completion is shown only after the server confirms a non-error terminal outcome.**

## 2. Step 1 - Product and system exploration

The platform is a two-service application:
- `api/`: Ruby on Rails, PostgreSQL, Redis/Sidekiq, and Gemini Live over WebSocket.
- `web/`: React 18, TypeScript, Vite, Tailwind, and Radix UI.

The candidate flow explored for this case is assessment setup -> candidate invite -> hardware checks -> start voice interview -> AI connection -> transcript/assessment portfolio. Local exploration reported by the candidate included a healthy API response (`/api/v1/health` returned HTTP 200), assessment and candidate-invite creation, a hardware check that passed on a phone hotspot after a Wi-Fi connectivity failure, and the interview moving immediately to its completion screen after Start Interview. A missing or invalid Gemini credential was suspected but not proven in that local run.

Code inspection confirmed several paths that can produce the same false-success result:
- `web/src/hooks/useAudioWebSocket.ts`: fatal `error` frames and exhausted reconnects previously transitioned to `complete`.
- `web/src/pages/interview/InterviewPage.tsx`: failure to load candidate information previously transitioned to `complete`, and starting the WebSocket happened before microphone capture succeeded.
- `web/src/hooks/useAudioCapture.ts`: capture startup failures were logged and swallowed; partially created tracks/contexts were not reliably cleaned up.
- `api/app/channels/audio_websocket_middleware.rb`: a synchronous opening exception was logged and the socket closed without a structured client-facing error. Exhausted Gemini retries ended the session with reason `error` and could create a portfolio even when no interview transcript had been recorded.
- `api/app/controllers/api/v1/sessions_controller.rb`: candidate-info payload did not include the session end reason, so a reload could not distinguish a clean end from an error.

## 3. Step 2 - Five product-context pillars

### The Product
A voice-based AI interview and assessment platform. The outcome is not just a WebSocket connection: it is a trustworthy interview session and evidence that can be reviewed by a hiring team.

### The Industry
Hiring is a high-consequence workflow. Missing evidence and misleading status can lead to wasted candidate time, rework by recruiters, and hiring decisions based on incomplete material. Reliability and honest status communication matter as much as availability.

### What It Is For
The platform captures candidate answers, lets an AI interview adapt to configured skills, and creates assessment material for human review. A portfolio created without meaningful evidence should not be presented as a completed assessment.

### The Users
- **Candidates:** need clear readiness checks, a reliable start, and honest status if their attempt failed.
- **Recruiters:** coordinate invitations and must know whether an assessment can be reviewed.
- **Assessors / hiring managers:** need the ability to distinguish a completed interview from a failed or partial session.

### People Affected Who Never Chose It
Candidates may not have chosen the assessment platform or the AI vendor. Transcript, identity, and assessment results may be personal data. The implementation should avoid exposing secrets or raw provider failures to candidates, avoid unnecessary disclosure in logs/commits, and clearly communicate when an attempt must be retried or reviewed. Privacy considerations are aligned with the case brief's UU PDP requirement; this report is product/engineering analysis, not legal advice.

## 4. Step 3 - Findings and Constraint Signal

| ID | Severity | Type | Finding | Impact |
|---|---|---|---|---|
| F-01 | P1 | Defective implementation | Fatal WebSocket error/retry exhaustion becomes `complete`; success UI says the interview was recorded. | Candidate trust is damaged; hiring team may assume evidence exists when it does not. |
| F-02 | P1 | Defective implementation | Candidate-info request failure also becomes `complete`. | A network/API outage is misrepresented as success. |
| F-03 | P1 | Defective implementation | Microphone/AudioWorklet startup error is swallowed; WebSocket start proceeds before capture succeeds. | An unusable or empty attempt can be activated. |
| F-04 | P1 | Defective implementation | Synchronous AI connection failure closes the browser socket without a structured error. | Candidate sees the reconnect path rather than a trustworthy explanation. |
| F-05 | P2 | Missing specification / implementation gap | The candidate UI contract does not clearly separate clean completion, retryable startup failure, and fatal failure. | A new failure can regress to success unless the lifecycle contract is explicit and tested. |
| F-06 | P2 | Defective implementation | Gemini retry exhaustion uses the ordinary end handler, which creates/enqueues portfolio generation even when no transcript exists. | Empty assessment artifacts and rework can be produced. |
| F-07 | P2 | Defective implementation | Hardware-check Retry resets downstream progress but the mount-only OS/browser check does not rerun. | The Retry control does not actually repeat all checks. |

### Constraint Signal - escalate to the technical lead

The lifecycle crosses REST candidate info, a browser WebSocket, Rails middleware, Gemini's asynchronous setup handshake, microphone capture, and a portfolio job. These layers previously treated “socket closed” and “session ended” as equivalent to “interview completed.” The critical constraint is evidence preservation: recovery may reset a session only if no transcript evidence or portfolio exists. Once evidence exists, preserve it and mark the session as failed instead of silently reopening it.

## 5. Step 4 - Design choices and acceptance criteria

### Alternatives considered

1. **Keep current behavior and only improve copy.** Smallest implementation cost, but does not fix false completion or empty portfolio creation. Rejected.
2. **Add a new database status and startup-attempt table.** Gives detailed analytics and failure history, but requires a migration and additional lifecycle/compatibility work. Deferred because the existing `session_status` and `end_reason` enums already represent pending, ended, and error outcomes.
3. **Use explicit client failure states and a guarded server startup recovery path.** Chosen. It uses the existing schema, preserves transcript evidence, gives recoverable startup failures a safe retry path, and avoids generating a portfolio before any transcript has been saved.

### Acceptance criteria written before code

- **AC-01:** A fatal WebSocket or provider error is rendered as failure, never the success screen.
- **AC-02:** A clean `session_ended` reason still follows the success/completion path.
- **AC-03:** A startup failure before transcript/portfolio creation sends a generic structured message, resets the session to pending, and permits an explicit retry.
- **AC-04:** If transcript evidence or a portfolio already exists, startup recovery must not clear lifecycle fields or discard evidence; report a terminal error instead.
- **AC-05:** A microphone permission, AudioWorklet, or AudioContext startup failure must clean up the stream/context and must not open the interview WebSocket.
- **AC-06:** Exhausted WebSocket reconnects show a failure state. Reconnect count must not reset merely because a transport connection briefly opened.
- **AC-07:** A candidate-info request failure is an error state, not a success state.
- **AC-08:** Client-facing errors are generic and never include API keys, stack traces, or raw internal exception details.
- **AC-09:** Hardware-check Retry reruns OS/browser and subsequent checks.
- **AC-10:** The end-interview UI waits for server confirmation before presenting the success screen.
- **AC-11:** Automated tests fail if an `error` reason is ever mapped back to `complete`.
- **AC-12:** No migration is required; no existing transcript or candidate evidence is deleted by startup recovery.

## 6. Step 5 - Implementation summary

### API changes
- Added `Sessions::StartupFailureHandler` to reset lifecycle fields only while the session is pending/active and no transcript or portfolio exists.
- The WebSocket open exception now sends a structured, generic error. A no-evidence startup failure is retryable and stays pending; if evidence already exists, the flow marks it as an error instead of resetting it.
- Gemini retry exhaustion and browser disconnect grace-period handling distinguish startup failure from a session that has already generated evidence.
- The readiness signal is tracked separately from transport connection state.
- Candidate-info response includes `session_end_reason`, enabling the frontend to distinguish an error end after reload.
- Authentication exception payloads no longer return raw exception text to the browser.

### Web changes
- Added a typed `failed` interview state plus a small protocol-to-outcome mapper.
- Fatal WebSocket errors, exhausted reconnects, AI/provider failure, and candidate-info API failures now render a dedicated error experience, not the success screen.
- Manual completion waits for the server's `session_ended` message before showing success.
- Microphone capture starts before the WebSocket. On capture startup failure, tracks and the AudioContext are cleaned up and the error propagates to the page.
- The microphone remains muted while the AI is speaking, including the first startup greeting.
- Hardware-check Retry now reruns the OS/browser step and clears its timer on effect cleanup.

### Schema and migration safety
No migration was added: existing enums already contain `pending`, `ended`, `failed`, and `error`. This avoids a new schema rollout and keeps the patch reversible through code revert. Startup recovery intentionally does not update existing transcript/portfolio rows.

## 7. Automated verification

Tests introduced:
- `web/tests/interviewSessionOutcome.test.ts`: error outcome stays failed, normal completion stays complete, recoverability is preserved, missing messages use safe copy, and non-terminal messages are ignored.
- `web/tests/HardwareCheck.test.tsx`: a failed internet check followed by Retry reruns OS/browser and internet checks, then reaches the enabled Start Interview state.
- `api/spec/services/sessions/startup_failure_handler_spec.rb`: retry only with no transcript/portfolio, never reset when transcript evidence exists, never reset after portfolio creation, and never reopen a terminal session.
- `.github/workflows/case-study.yml`: runs web tests/build and API RSpec for changes to this branch and pull requests.

**Verified on commit `492016652e08ae9acb3e4a9e6441efaf30ecbf3e`.** [GitHub Actions run - all jobs passed](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40009424877). Evidence: Vitest **7 tests passed** (outcome contract: 5; hardware retry: 1; audio cleanup: 1), TypeScript + Vite production build passed (1,842 modules transformed), RSpec **4 examples, 0 failures**, and the Playwright screenshot job captured four real-app screenshots with deterministic API/WebSocket mocks: retryable startup failure, non-retryable failure, mobile failure, and clean completion UI. These screenshots validate the real React app rendering and protocol state mapping; they do not prove a live Gemini credential or persisted candidate transcript. The `npm install` step reported 5 moderate and 2 critical audit findings in this dependency graph. Dependency upgrades were not applied automatically because broad/force upgrades could change unrelated runtime behavior; dependency triage remains an explicit follow-up.

### Seeded Fault Test - completed
The fault was deliberately reintroduced in [commit `a4ca90b`](https://github.com/aldxynnn/ai-interview-platform/commit/a4ca90b1adb6ae3eefd798c1611ad830eefdce95), changing `session_ended` with reason `error` back to state `complete`. The [GitHub Actions run](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40008303401) failed exactly as intended: **1 failed, 5 passed** in the web tests. `tests/interviewSessionOutcome.test.ts` expected `state: "failed"` but received `state: "complete"`. This demonstrates the regression test detects the original defect, rather than only exercising the happy path.

The injected fault was then removed in [revert commit `2cab00b`](https://github.com/aldxynnn/ai-interview-platform/commit/2cab00bc6ac046416f0b92bb0934c3ee1a5db3c4). The final branch was verified green, including the revert and the UI evidence workflow, in [run `40008594309`](https://github.com/aldxynnn/ai-interview-platform/actions/runs/40008594309).

### AI Verification Moment
An unconditional “reset any failed active session to pending” is tempting but unsafe: it can erase the distinction between a no-evidence startup failure and an interview with saved transcript turns. The implemented guard checks both transcript existence and portfolio existence while holding the session lock. The unit tests explicitly cover transcript and portfolio boundaries. This is the important human verification decision: the assistant may propose a recovery path, but the existing schema, lifecycle handler, and tests determine whether the change is safe.

## 8. Demo evidence and submission checklist

- [x] Screenshot: retryable startup error, including Try again - `startup-failure-desktop.png`.
- [x] Screenshot: non-retryable failure state and contact-the-hiring-team guidance - `startup-failure-fatal-desktop.png`.
- [x] Screenshot: completion UI after a mocked normal session-ended event - `interview-complete-desktop.png`. This is a UI-state capture, not proof of persisted live candidate audio.
- [x] Screenshot: mobile/responsive error screen - `startup-failure-mobile.png`.
- [ ] 3-5 minute video recording, hosted at a shareable URL. Use `assessment/demo-video-script.md`; no hosted video URL has been supplied yet.
- [ ] Link to the draft pull request from `feat/case-study` to upstream `main`.
- [ ] Latest GitHub Actions test/build evidence.
- [ ] Seeded Fault Test failure and revert commit links.

Suggested video sequence: (1) explain the P1 false-completion problem, (2) show the original state-mapping defect, (3) demonstrate a retryable startup error using a missing/invalid Gemini key in a local development environment, (4) show clean completion remains successful, (5) show test results and the fault/revert evidence, (6) explain why reset is allowed only before transcript/portfolio evidence exists.

## 9. Open risks / known limitations

- Live Gemini failure injection was not run by the assistant. Use a local development environment and test credential handling safely; never commit a real API key.
- Candidate-flow screenshots and the demo recording still need to be captured from the running application; generated mock visuals should not be presented as real product evidence.
- The case-study PDF states a deadline of 19 August 2026 at 13:00 WIB, while the hiring portal was reported as showing 28 October 2026. Confirm the authoritative submission deadline in the portal/recruiter instructions.
