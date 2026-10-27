# Test Harness & Monozukuri Engineering Proof
**AI Interview Platform Revamp**

---

## 1. Test Harness Overview (43 Automated Tests)

Before this revamp, the platform had **0 RSpec tests, no frontend test runner, and no continuous integration pipeline**. We built a complete end-to-end testing harness that exercises critical business logic, state machines, and user interface states:

```
Total Automated Tests: 43
├── Backend RSpec Suite: 30 passed, 0 failures (1.08s)
└── Frontend Vitest Suite: 13 passed, 0 failures (4.12s)
```

### 1.1 Backend RSpec Test Suite (30 Specs)

| Test File | Focus Area | Examples | Status |
|---|---|---|---|
| `spec/services/coverage/state_engine_spec.rb` | Forward monotonic transitions, probe count gates (&ge; 2 for partial/covered), multi-step skip resolution | 16 | **PASS** |
| `spec/services/fit_gap/engine_spec.rb` | Match, gap, exceed, not-assessed calculations, assessor override precedence, fenced JSON handling, fallback narrative generation | 4 | **PASS** |
| `spec/services/portfolios/generator_spec.rb` | Configured and discovered skills ingestion, confidence normalization (unknown &rarr; 'low'), markdown fence stripping, exception handling | 3 | **PASS** |
| `spec/services/sessions/start_handler_spec.rb` | Activation of pending sessions, initial coverage map population, idempotency, hard guards on ended/failed sessions | 4 | **PASS** |
| `spec/services/sessions/end_handler_spec.rb` | Duration calculation, portfolio enqueuing, reason normalization, error-to-clean upgrade | 3 | **PASS** |

### 1.2 Frontend Vitest Test Suite (13 Specs)

| Test File | Focus Area | Examples | Status |
|---|---|---|---|
| `src/utils/__tests__/constants.test.ts` | Level string/number parsing, labels L1-L5, badge classes, coverage bar widths | 7 | **PASS** |
| `src/components/fitgap/__tests__/ComparisonTable.test.tsx` | Empty state message, comparison rows with badge/delta, assessor notes, backward-compatibility fallback | 3 | **PASS** |
| `src/components/portfolio/__tests__/SkillPortfolioCard.test.tsx` | Evidence quotes, competency summary, discovered skill badge, low confidence warning | 3 | **PASS** |

---

## 2. Seeded Fault Test Proof

The case study explicitly requires proving that tests are real and not shallow:
> *"Prove your tests are real by breaking your logic on a scratch branch to show the test catch it, then reverting with history visible."*

### Execution of Seeded Fault Test:
1. **Target Logic:** `Coverage::StateEngine.valid_transition?`
   ```ruby
   # Original production code:
   if to == 'partial' || to == 'covered'
     return false if probe_count < 2
   end
   ```

2. **Injected Fault:** Intentionally weakened the probe count threshold:
   ```ruby
   # Seeded faulty code:
   if to == 'partial' || to == 'covered'
     return false if probe_count < 1 # FAULT: allows 1 probe to advance to partial
   end
   ```

3. **Test Suite Execution Result:**
   ```
   Failures:
     1) Coverage::StateEngine.valid_transition? when transitioning from initiated blocks transition to partial if probe_count is less than 2
        Failure/Error: expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
          expected false
               got true
        # ./spec/services/coverage/state_engine_spec.rb:29:in `block (4 levels) in <top (required)>'
   
   Finished in 0.14 seconds
   16 examples, 1 failure
   ```

4. **Reversion & Verification:**
   Reverted the faulty condition back to `< 2`. RSpec was re-run:
   ```
   Finished in 0.13 seconds
   16 examples, 0 failures
   ```
   **Proof:** The test assertion caught the exact flaw immediately and rejected the regression.

---

## 3. AI Verification Moment

The case study brief requires documenting:
> *"Document at least one instance where AI code generation was wrong or risky and how you verified/corrected it."*

### Incident Details:
- **Context:** Implementing atomic portfolio skill replacement in `Portfolios::Generator`.
- **AI-Generated Proposal:**
  An AI code suggestion proposed updating existing portfolio skills using:
  ```ruby
  PortfolioSkill.where(portfolio_id: @portfolio.id).update_all(
    ai_level: skill_data['level'],
    ai_confidence: skill_data['confidence']
  )
  ```
- **Why It Was Dangerous:**
  1. `update_all` generates direct SQL `UPDATE` statements that **bypass Active Record model validations**.
  2. If the LLM emitted a level value such as `0` or `99`, `update_all` would attempt to write this to PostgreSQL, triggering an uncaught `ActiveRecord::StatementInvalid` check constraint violation (`chk_portfolio_skills_ai_level`).
  3. `update_all` also bypasses the tenant scoping callbacks in `TenantScoped`, creating potential data contamination in multi-tenant environments.
- **Verification & Correction:**
  We rejected the AI suggestion and implemented safe model lifecycle management:
  ```ruby
  ActiveRecord::Base.transaction do
    portfolio.portfolio_skills.destroy_all
    (data['configured_skills'] || []).each do |skill_data|
      level = skill_data['level'].to_i
      level = 1 if level < 1 || level > 5
      conf = normalize_confidence(skill_data['confidence'])
      summary = skill_data['competency_summary'].presence || "Skill evaluated during session."

      portfolio.portfolio_skills.create!(
        skill_id:           skill_data['skill_id'],
        skill_label:        skill_data['skill_label'].presence || "Configured Skill",
        is_discovered:      false,
        ai_level:           level,
        ai_confidence:      conf,
        evidence:           Array(skill_data['evidence']).map(&:to_s).first(3),
        competency_summary: summary
      )
    end
  end
  ```
- **Outcome:** Total validation safety, sanitized level boundaries, and complete transactional rollback if any record fails.
