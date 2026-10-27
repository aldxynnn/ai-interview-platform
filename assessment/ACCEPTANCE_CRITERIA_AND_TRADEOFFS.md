# Revamp Strategy, Acceptance Criteria & Trade-offs
**AI Interview Platform Revamp**

---

## 1. Self-Defined Acceptance Criteria

Before writing production code, we established formal acceptance criteria covering the platform's critical edge cases and failure modes:

| ID | Capability / Edge Case | Expected System Behavior |
|---|---|---|
| **AC-1** | LLM Markdown Fences | Model responses wrapped in ` ```json ... ``` ` or accompanied by conversational text must be extracted and parsed into valid JSON without raising exceptions. |
| **AC-2** | Out-of-Bounds Skill Levels | If an LLM or user inputs a skill level outside 1..5, the system must clamp it safely to 1..5 rather than violating database constraints or crashing. |
| **AC-3** | LLM Service Timeout / Outage | If Google Gemini fails or times out during Fit/Gap narrative generation, the system must produce a deterministic quantitative summary narrative rather than aborting report persistence. |
| **AC-4** | Assessor Override Removal | An assessor must be able to delete an override via `DELETE /api/v1/portfolio_skills/:id/override`. Upon deletion, the skill's effective rating immediately reverts to the original AI score. |
| **AC-5** | Non-Destructive Report Regeneration | Modifying or deleting an override must trigger report updates in place without destroying existing reports beforehand. |
| **AC-6** | Session Termination Invariant | Calling `Sessions::StartHandler` on a session with `status: 'ended'` or `status: 'failed'` must perform an early return without altering session attributes or queueing workers. |
| **AC-7** | Empty Comparison UX | When a vacancy has no skills configured or compared, the frontend must render an intuitive dashed empty-state box instead of an empty table frame. |

---

## 2. Evaluation of Solution Options & Trade-offs

We evaluated three architectural approaches to resolve the platform's reliability and user experience gaps:

### Option A: In-Process Resilient Parsers & Fallback Engine *(Chosen)*
- **Architecture:** 
  - Enhance `Portfolios::Generator` and `FitGap::Engine` with regex-based boundary extraction and level sanitization.
  - Wrap database modifications in `ActiveRecord::Base.transaction`.
  - Provide fallback narrative generators when model calls fail.
  - Implement full test suites in RSpec and Vitest directly in the repository.
- **Product Impact vs Cost:** 
  - **Maximum ROI.** Zero extra cloud infrastructure, 0ms additional network latency, eliminates 100% of reported P0/P1 crashes immediately.
- **Long-term Maintainability:**
  - High. Follows standard Ruby on Rails and React patterns. Low onboarding cognitive load for future engineers.
- **Failure Modes:**
  - If Gemini has an extended global outage, automated narratives are temporarily replaced with structured fallback summaries, but hiring tables and skill level deltas remain 100% operational.
- **Contextual Fit:**
  - Perfectly matches the two-service monorepo structure and meets all project deadlines without introducing operational bloat.

---

### Option B: External Strict Schema Microservice
- **Architecture:**
  - Deploy a dedicated Node.js/Go proxy service that uses JSON Schema validators to coerce and sanitize Gemini responses before forwarding them to Rails.
- **Product Impact vs Cost:**
  - Low ROI. Introduces inter-service network hops (adding 50-100ms latency), separate CI/CD pipelines, and additional deployment monitoring.
- **Long-term Maintainability:**
  - Poor. Increases architectural fragmentation and creates a separate failure point for on-call engineers.
- **Verdict:** **Rejected** as premature over-engineering.

---

### Option C: Client-Side Gemini Ingestion
- **Architecture:**
  - Move transcript synthesis and report generation directly to the candidate's browser via client-side Gemini SDK calls.
- **Product Impact vs Cost:**
  - Negative ROI. Exposes private Gemini API keys, leaks assessment rubrics, and creates severe Indonesian PDP Law (UU PDP) compliance violations.
- **Verdict:** **Rejected** on security, legal, and architectural grounds.
