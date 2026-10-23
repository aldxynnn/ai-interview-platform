# 3-5 Minute Case Study Demo - Recording Script

This is a presenter guide, not a pre-recorded demo or a hosted video. Record the application and your own narration, then replace the placeholder in the submission PDF with the public/reviewer-accessible video URL.

## Prepare before recording

- Use the `feat/case-study` branch and the same commit cited in the final PDF.
- Do not show a real Gemini API key or any real candidate data.
- For the startup-failure path, use a temporary invalid/missing local Gemini credential in a development environment only, or use the deterministic Playwright evidence if live failure injection is not practical.
- Have the GitHub Actions result and Seeded Fault Test commit/run open in separate tabs.
- Do not present mock WebSocket screenshots as evidence that a live Gemini recording was persisted; identify them as deterministic protocol/UI verification.

## Suggested run of show (about 4 minutes)

### 0:00-0:35 - Product problem
"An AI interview is a high-consequence hiring workflow. The P1 defect I found was that a candidate could be shown 'Interview Complete' even when the Gemini connection or candidate-info request failed. The success copy says the interview was recorded, which is a stronger claim than the system can prove."

### 0:35-1:10 - Show the failure UX
Show the desktop startup-failure screen and the mobile layout. Point out the explicit message that answers have not been recorded and the retry action. Then show the non-retryable terminal failure screen and explain why it does not offer an unsafe retry.

### 1:10-2:05 - Walk through the code
Show `web/src/utils/interviewSessionOutcome.ts` and `web/src/hooks/useAudioWebSocket.ts`: fatal errors map to `failed`; only a clean server end maps to `complete`. Show `api/app/services/sessions/startup_failure_handler.rb`: retry is allowed only if the session has neither transcript turns nor a portfolio, and stale Gemini resumption state is cleared. Mention the candidate-facing API now includes `session_end_reason`.

### 2:05-2:50 - Explain safety and tradeoffs
Show `web/src/hooks/useAudioCapture.ts`: partial microphone/AudioWorklet startup cleans up tracks and the AudioContext, and the failure propagates instead of opening a WebSocket anyway. The backend startup handler resets lifecycle data only under a row lock, and never clears evidence that has already been recorded. No migration was needed because the schema already contains the relevant statuses/end reasons.

### 2:50-3:30 - Tests and Seeded Fault Test
Show the GitHub Actions run: frontend tests and production build, API RSpec, and Playwright screenshots. Then show the deliberate fault commit `a4ca90b`: it mapped the `error` reason back to `complete`. The regression test failed with an assertion that expected `failed` but got `complete`; the code was then restored in `2cab00b`.

### 3:30-4:05 - Close with product impact and next step
"The invariant is simple: a successful completion screen requires a clean server-confirmed end. A no-evidence startup failure can retry; a failure after evidence exists remains an error so the hiring team can review it without losing the transcript. Live Gemini failure injection and credential behavior should still be verified in the assessment owner's local environment without ever committing the key."

## After recording

1. Upload the video to a service allowed by the hiring portal, with link access enabled for reviewers.
2. Open the link in a signed-out/private browser window to ensure the reviewer can view it.
3. Replace the video placeholder in the final PDF and keep the PR and final green CI link adjacent to it.
