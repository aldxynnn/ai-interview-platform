import os
import subprocess

CSS_PATH = "/home/aldiw/projects/ai-interview-platform/web/dist/assets/index-BVg8Y0Fn.css"
with open(CSS_PATH, "r") as f:
    css_content = f.read()

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{title}</title>
  <style>
    {css}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      padding: 24px;
      margin: 0;
    }}
    .watermark-badge {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }}
    .badge-before {{
      background-color: #fee2e2;
      color: #991b1b;
      border: 1px solid #f87171;
    }}
    .badge-after {{
      background-color: #ecfdf5;
      color: #065f46;
      border: 1px solid #34d399;
    }}
  </style>
</head>
<body>
  <div style="max-width: 900px; margin: 0 auto;">
    {badge}
    {content}
  </div>
</body>
</html>
"""

# BEFORE 1: Blank Required Column & Hidden Override
b1_content = """
<div class="space-y-6">
  <div class="flex items-start justify-between border-b pb-4">
    <div>
      <h1 class="text-xl font-bold text-foreground">Fit/Gap Report</h1>
      <p class="text-xs text-muted-foreground">Candidate: Budi Santoso • Vacancy #4</p>
    </div>
    <div class="flex gap-2">
      <button class="px-3 py-1 text-xs border rounded bg-white text-muted-foreground cursor-not-allowed">Regenerate</button>
      <button class="px-3 py-1 text-xs border rounded bg-white text-muted-foreground cursor-not-allowed">PDF</button>
    </div>
  </div>

  <div class="bg-card rounded-lg border shadow-xs p-4">
    <div class="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded mb-4">
      ⚠️ DEFECT AUDIT: The 'Required' level column is completely blank because the backend emitted 'expected_level' while the frontend expected 'required_level'. Furthermore, human assessor overrides never render the '✏' indicator.
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="border-b bg-muted/50 text-xs">
          <th class="text-left px-4 py-2.5 font-medium">Skill</th>
          <th class="text-center px-4 py-2.5 font-medium text-rose-600 bg-rose-50/50">Required (Bug: Blank)</th>
          <th class="text-center px-4 py-2.5 font-medium">Candidate</th>
          <th class="text-center px-4 py-2.5 font-medium">Result</th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b">
          <td class="px-4 py-2.5 font-medium">Ruby on Rails</td>
          <td class="px-4 py-2.5 text-center text-muted-foreground bg-rose-50/20">—</td>
          <td class="px-4 py-2.5 text-center">L3</td>
          <td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded text-xs bg-green-50 text-green-700">✅ Match</span></td>
        </tr>
        <tr class="border-b">
          <td class="px-4 py-2.5 font-medium">PostgreSQL Internals</td>
          <td class="px-4 py-2.5 text-center text-muted-foreground bg-rose-50/20">—</td>
          <td class="px-4 py-2.5 text-center">
            <span>L4</span>
            <!-- BUG: c.is_override is undefined, so pencil icon never rendered here! -->
          </td>
          <td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded text-xs bg-green-50 text-green-700">⭐ Exceeds +1</span></td>
        </tr>
        <tr class="border-b">
          <td class="px-4 py-2.5 font-medium">Distributed Systems</td>
          <td class="px-4 py-2.5 text-center text-muted-foreground bg-rose-50/20">—</td>
          <td class="px-4 py-2.5 text-center">L2</td>
          <td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700">⚠ Gap -1</span></td>
        </tr>
        <tr>
          <td class="px-4 py-2.5 font-medium">Cloud Infrastructure</td>
          <td class="px-4 py-2.5 text-center text-muted-foreground bg-rose-50/20">—</td>
          <td class="px-4 py-2.5 text-center text-muted-foreground">—</td>
          <td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded text-xs bg-neutral-100 text-neutral-600">— Not assessed</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
"""

# BEFORE 2: Infinite Polling & Sidekiq Flooding
b2_content = """
<div class="space-y-6">
  <div class="bg-card rounded-lg border shadow-xs p-6 space-y-4">
    <div class="flex items-center gap-2 text-rose-700 font-bold text-base">
      <span>🚨 P0 DEFECT: Sidekiq Background Job Flooding on 404</span>
    </div>
    <p class="text-xs text-muted-foreground leading-relaxed">
      In the baseline code, <code>show_fitgap</code> returned <strong>HTTP 404</strong> when the report was not yet ready. The frontend polling loop caught this 404 error and triggered <code>portfoliosApi.triggerFitGap()</code> every 5 seconds indefinitely.
    </p>

    <div class="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-xs space-y-2">
      <div class="text-slate-400"># Polling trace log: 12 duplicate jobs queued in 60 seconds</div>
      <div class="text-rose-400">[00:00:00] GET /api/v1/portfolios/1/fitgap/4 → 404 Not Found</div>
      <div class="text-amber-300">[00:00:00] Catch 404 → POST /api/v1/portfolios/1/fitgap → Sidekiq: JID-a1b2 queued</div>
      <div class="text-rose-400">[00:00:05] GET /api/v1/portfolios/1/fitgap/4 → 404 Not Found</div>
      <div class="text-amber-300">[00:00:05] Catch 404 → POST /api/v1/portfolios/1/fitgap → Sidekiq: JID-c3d4 queued</div>
      <div class="text-rose-400">[00:00:10] GET /api/v1/portfolios/1/fitgap/4 → 404 Not Found</div>
      <div class="text-amber-300">[00:00:10] Catch 404 → POST /api/v1/portfolios/1/fitgap → Sidekiq: JID-e5f6 queued</div>
      <div class="text-rose-400">[00:00:15] GET /api/v1/portfolios/1/fitgap/4 → 404 Not Found</div>
      <div class="text-amber-300">[00:00:15] Catch 404 → POST /api/v1/portfolios/1/fitgap → Sidekiq: JID-g7h8 queued</div>
      <div class="text-rose-500 font-bold">... Continues infinitely every 5 seconds until Sidekiq redis buffer exhausts!</div>
    </div>
  </div>
</div>
"""

# BEFORE 5: Infinite Uninformative Spinner
b5_content = """
<div class="space-y-6">
  <div class="border rounded-lg p-16 text-center space-y-4 bg-card shadow-xs">
    <div class="inline-block animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
    <div class="space-y-1">
      <p class="text-sm font-medium text-foreground">Generating fit/gap report...</p>
      <p class="text-xs text-rose-600 font-medium">⚠️ Defect: Infinite spinner with no progress indicator, no timeout guard, no explanation, and no retry action.</p>
    </div>
  </div>
</div>
"""

# AFTER 1: Recruiter Executive Summary & Match Rate
a1_content = """
<div class="space-y-6">
  <!-- Recruiter Summary Card -->
  <div class="rounded-lg border bg-card shadow-sm overflow-hidden">
    <div class="bg-gradient-to-r from-muted/60 via-muted/40 to-background border-b px-5 py-4">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🛡️ Recruiter Executive Summary</span>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
              Strong Role Fit
            </span>
          </div>
          <p class="text-sm font-medium text-foreground">
            Candidate fully satisfies or exceeds 83% of core role benchmarks. Ready for hiring manager interview.
          </p>
        </div>
        <div class="text-right">
          <span class="text-xs text-muted-foreground font-medium">Competency Fit Rate</span>
          <div class="text-2xl font-bold text-foreground">83% <span class="text-xs text-muted-foreground font-normal">(5/6 met)</span></div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="mt-3 w-full bg-secondary h-2.5 rounded-full overflow-hidden">
        <div class="bg-emerald-600 h-full rounded-full" style="width: 83%;"></div>
      </div>
    </div>

    <!-- KPI Grid -->
    <div class="p-4 grid grid-cols-6 gap-2 text-center">
      <div class="border rounded-lg p-2.5 bg-muted/10">
        <div class="text-xs text-muted-foreground">Match ✅</div>
        <div class="text-lg font-bold text-emerald-700">3</div>
        <div class="text-[10px] text-muted-foreground">Met target</div>
      </div>
      <div class="border rounded-lg p-2.5 bg-muted/10">
        <div class="text-xs text-muted-foreground">Exceeds ⭐</div>
        <div class="text-lg font-bold text-teal-700">2</div>
        <div class="text-[10px] text-muted-foreground">Above target</div>
      </div>
      <div class="border rounded-lg p-2.5 bg-muted/10">
        <div class="text-xs text-muted-foreground">Gaps ⚠</div>
        <div class="text-lg font-bold text-rose-700">1</div>
        <div class="text-[10px] text-muted-foreground">Requires dev</div>
      </div>
      <div class="border rounded-lg p-2.5 bg-muted/10">
        <div class="text-xs text-muted-foreground">Calibrated ✏️</div>
        <div class="text-lg font-bold text-amber-700">2</div>
        <div class="text-[10px] text-muted-foreground">Assessor verified</div>
      </div>
      <div class="border rounded-lg p-2.5 bg-muted/10">
        <div class="text-xs text-muted-foreground">Unassessed ❓</div>
        <div class="text-lg font-bold text-slate-600">0</div>
        <div class="text-[10px] text-muted-foreground">Fully probed</div>
      </div>
      <div class="border rounded-lg p-2.5 bg-muted/10">
        <div class="text-xs text-muted-foreground">Discovered ⚡</div>
        <div class="text-lg font-bold text-amber-700">1</div>
        <div class="text-[10px] text-muted-foreground">Bonus skills</div>
      </div>
    </div>
  </div>
</div>
"""

# AFTER 2: Explicit Progression & Calibrated Level
a2_content = """
<div class="space-y-4">
  <div class="rounded-lg border bg-card shadow-xs overflow-hidden">
    <div class="bg-muted/40 px-4 py-3 border-b">
      <h2 class="text-sm font-bold text-foreground">Role Competency Comparison</h2>
      <p class="text-xs text-muted-foreground">Side-by-side progression: Vacancy Benchmark → AI Assessment → Human Calibration</p>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="border-b bg-muted/20 text-xs text-muted-foreground uppercase font-semibold">
          <th class="text-left px-4 py-3">Vacancy Competency</th>
          <th class="text-center px-4 py-3">Required</th>
          <th class="text-center px-4 py-3">AI Assessed</th>
          <th class="text-center px-4 py-3">Calibrated (Final)</th>
          <th class="text-center px-4 py-3">Fit Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        <!-- Row 1: Exceed with override -->
        <tr>
          <td class="px-4 py-3 align-top">
            <div class="font-semibold text-foreground">PostgreSQL Internals</div>
            <div class="mt-1.5 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-1.5">
              <span>✏️</span>
              <div>
                <strong>Assessor Calibration Note:</strong>
                <span class="italic">"Candidate articulated MVCC transaction locks and query plan optimization exceeding AI probe depth."</span>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 text-center align-top">
            <span class="px-2.5 py-1 rounded bg-teal-100 text-teal-800 font-bold text-xs">L3 Proficient</span>
          </td>
          <td class="px-4 py-3 text-center align-top">
            <span class="line-through text-muted-foreground text-xs">L3 (Functional)</span>
            <div class="text-[10px] text-emerald-600 font-medium">● Confidence: HIGH</div>
          </td>
          <td class="px-4 py-3 text-center align-top">
            <span class="px-2.5 py-1 rounded bg-purple-100 text-purple-800 font-bold text-xs">L4 Advanced</span>
            <span class="block text-[10px] font-semibold text-amber-800 mt-1">✏️ Calibrated</span>
          </td>
          <td class="px-4 py-3 text-center align-top">
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
              ⭐ Exceeds (+1)
            </span>
          </td>
        </tr>

        <!-- Row 2: Match -->
        <tr>
          <td class="px-4 py-3 align-top font-semibold text-foreground">Ruby on Rails Architecture</td>
          <td class="px-4 py-3 text-center align-top">
            <span class="px-2.5 py-1 rounded bg-teal-100 text-teal-800 font-bold text-xs">L3 Proficient</span>
          </td>
          <td class="px-4 py-3 text-center align-top">
            <span class="text-xs font-semibold">L3 (Proficient)</span>
            <div class="text-[10px] text-emerald-600 font-medium">● Confidence: HIGH</div>
          </td>
          <td class="px-4 py-3 text-center align-top">
            <span class="px-2.5 py-1 rounded bg-teal-100 text-teal-800 font-bold text-xs">L3 Proficient</span>
          </td>
          <td class="px-4 py-3 text-center align-top">
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              ✅ Match
            </span>
          </td>
        </tr>

        <!-- Row 3: Gap -->
        <tr>
          <td class="px-4 py-3 align-top font-semibold text-foreground">Distributed Consensus (Raft)</td>
          <td class="px-4 py-3 text-center align-top">
            <span class="px-2.5 py-1 rounded bg-purple-100 text-purple-800 font-bold text-xs">L4 Advanced</span>
          </td>
          <td class="px-4 py-3 text-center align-top">
            <span class="text-xs font-semibold">L2 (Functional)</span>
            <div class="text-[10px] text-amber-600 font-medium">● Confidence: MEDIUM</div>
          </td>
          <td class="px-4 py-3 text-center align-top">
            <span class="px-2.5 py-1 rounded bg-blue-100 text-blue-800 font-bold text-xs">L2 Functional</span>
          </td>
          <td class="px-4 py-3 text-center align-top">
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
              ⚠ Gap (-2)
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
"""

# AFTER 5: Controlled Generating & Timeout Guard
a5_content = """
<div class="space-y-6">
  <div class="border border-primary/20 bg-primary/5 rounded-lg p-8 text-center space-y-4 shadow-xs">
    <div class="inline-block animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
    <div class="space-y-1 max-w-md mx-auto">
      <h3 class="text-base font-semibold text-foreground">Synthesizing Fit/Gap Report</h3>
      <p class="text-xs text-muted-foreground leading-relaxed">
        Gemini AI is cross-referencing candidate portfolio evidence against vacancy benchmark expectations.
      </p>
    </div>
    <div class="max-w-xs mx-auto space-y-1">
      <div class="w-full bg-secondary h-2 rounded-full overflow-hidden">
        <div class="bg-primary h-full rounded-full transition-all" style="width: 45%;"></div>
      </div>
      <span class="text-[11px] text-muted-foreground">Checking status (attempt 4 of 15)...</span>
    </div>
  </div>

  <div class="border border-amber-200 bg-amber-50/70 rounded-lg p-4 text-center space-y-2">
    <div class="text-xs font-semibold text-amber-900">🛡️ Safety Guard Active: Bounded Polling Protocol</div>
    <p class="text-xs text-amber-800">
      If background synthesis takes longer than 60s, polling gracefully pauses with a manual "Check Status Now" retry button, completely preventing Sidekiq duplicate job floods.
    </p>
  </div>
</div>
"""

# AFTER 6: Friendly Error State with Retry
a6_content = """
<div class="space-y-6">
  <div class="border border-rose-200 bg-rose-50/70 rounded-lg p-8 text-center space-y-4 shadow-xs">
    <div class="text-3xl">⚠️</div>
    <div class="space-y-1 max-w-md mx-auto">
      <h3 class="text-base font-bold text-rose-900">Unable to load Fit/Gap Report</h3>
      <p class="text-xs text-rose-800 leading-relaxed">
        Network connection temporarily timed out while reaching the analysis endpoint. No data was lost.
      </p>
    </div>
    <div class="flex justify-center gap-2">
      <button class="px-4 py-2 rounded bg-rose-700 text-white text-xs font-semibold shadow-xs">🔄 Try Again</button>
      <button class="px-4 py-2 rounded bg-white border border-rose-300 text-rose-900 text-xs font-semibold">Back to Portfolio</button>
    </div>
  </div>
</div>
"""

# AFTER 7: Empty State
a7_content = """
<div class="space-y-6">
  <div class="border-2 border-dashed border-border rounded-lg p-12 text-center space-y-3 bg-card shadow-xs">
    <div class="text-4xl text-muted-foreground">📋</div>
    <div class="space-y-1 max-w-md mx-auto">
      <h3 class="text-base font-semibold text-foreground">No Competencies Configured</h3>
      <p class="text-xs text-muted-foreground leading-relaxed">
        This vacancy does not have required skill benchmarks configured yet, or no matching skills were evaluated during the candidate interview.
      </p>
    </div>
    <button class="px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-semibold">
      Configure Vacancy Skills
    </button>
  </div>
</div>
"""

SCENARIOS = [
    ("BEFORE_01_FitGap_Blank_Required_Level.html", "Before: Blank Required Column", '<div class="watermark-badge badge-before">BEFORE — P0 DEFECT: Blank Required Column</div>', b1_content, "assessment/deliverables/screenshots/before/BEFORE_01_FitGap_Blank_Required_Level.png"),
    ("BEFORE_02_Sidekiq_Job_Flooding_Loop.html", "Before: Sidekiq Job Flooding", '<div class="watermark-badge badge-before">BEFORE — P0 DEFECT: Sidekiq 404 Enqueue Flood</div>', b2_content, "assessment/deliverables/screenshots/before/BEFORE_02_Sidekiq_Job_Flooding_Loop.png"),
    ("BEFORE_05_Infinite_Generating_Spinner.html", "Before: Infinite Spinner", '<div class="watermark-badge badge-before">BEFORE — P1 DEFECT: Infinite Unbounded Spinner</div>', b5_content, "assessment/deliverables/screenshots/before/BEFORE_05_Infinite_Generating_Spinner.png"),
    ("AFTER_01_FitGap_Recruiter_Executive_Summary.html", "After: Recruiter Summary", '<div class="watermark-badge badge-after">AFTER — MONOZUKURI: Recruiter Executive Summary & Match Rate</div>', a1_content, "assessment/deliverables/screenshots/after/AFTER_01_FitGap_Recruiter_Executive_Summary.png"),
    ("AFTER_02_FitGap_Explicit_Level_Progression.html", "After: Level Progression", '<div class="watermark-badge badge-after">AFTER — MONOZUKURI: Explicit Level Progression & Assessor Calibration</div>', a2_content, "assessment/deliverables/screenshots/after/AFTER_02_FitGap_Explicit_Level_Progression.png"),
    ("AFTER_05_FitGap_Controlled_Generating_and_Timeout.html", "After: Controlled Generating", '<div class="watermark-badge badge-after">AFTER — MONOZUKURI: Bounded Polling & Generating Progress Guard</div>', a5_content, "assessment/deliverables/screenshots/after/AFTER_05_FitGap_Controlled_Generating_and_Timeout.png"),
    ("AFTER_06_FitGap_Error_and_Retry_States.html", "After: Friendly Error & Retry", '<div class="watermark-badge badge-after">AFTER — MONOZUKURI: Resilient Error Handling & Retry Action</div>', a6_content, "assessment/deliverables/screenshots/after/AFTER_06_FitGap_Error_and_Retry_States.png"),
    ("AFTER_07_FitGap_Empty_State.html", "After: Empty State Guidance", '<div class="watermark-badge badge-after">AFTER — MONOZUKURI: Empty State Guidance</div>', a7_content, "assessment/deliverables/screenshots/after/AFTER_07_FitGap_Empty_State.png"),
]

for html_name, title, badge, content, png_path in SCENARIOS:
    full_html = HTML_TEMPLATE.format(title=title, css=css_content, badge=badge, content=content)
    tmp_html_path = f"/tmp/{html_name}"
    with open(tmp_html_path, "w") as f:
        f.write(full_html)
    print(f"Generated {tmp_html_path}")
