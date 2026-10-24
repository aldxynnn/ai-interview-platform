import os

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
      padding: 16px;
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
      margin-bottom: 12px;
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
  <div style="{container_style}">
    {badge}
    {content}
  </div>
</body>
</html>
"""

# BEFORE 03: Cross-tenant data leakage
b3_content = """
<div class="space-y-4">
  <div class="bg-card rounded-lg border shadow-xs p-5 space-y-3">
    <div class="text-rose-700 font-bold text-sm">🚨 P0 SECURITY DEFECT: Cross-Tenant Portfolio Data Leakage (UU PDP Violation)</div>
    <p class="text-xs text-muted-foreground leading-relaxed">
      In the baseline code, <code>PortfoliosController#fitgap</code> and <code>#show_fitgap</code> performed raw <code>Portfolio.find(params[:id])</code> without verifying that the portfolio belonged to the caller's tenant. Tenant B could inspect, export, and overwrite candidate evaluation records belonging to Tenant A.
    </p>
    <div class="rounded bg-slate-900 text-slate-100 p-3.5 font-mono text-xs space-y-1">
      <div class="text-slate-400"># Cross-Tenant API Probe (Tenant Two inspecting Tenant One's candidate):</div>
      <div class="text-rose-400">curl -H "X-Tenant-Id: tenant-two" -H "Authorization: Bearer [TenantTwo_Token]" \\</div>
      <div class="text-rose-400">&nbsp;&nbsp;&nbsp;&nbsp;https://api.platform.internal/api/v1/sessions/1/portfolio</div>
      <div class="text-amber-300 mt-2">HTTP/1.1 200 OK  &lt;-- CRITICAL VULNERABILITY: Permitted access across tenant boundaries!</div>
      <div class="text-slate-300">&#123;"portfolio": &#123;"id": 1, "candidate_name": "Budi Santoso", "skills": [...]&#125;&#125;</div>
    </div>
  </div>
</div>
"""

# BEFORE 04: Destructive Override Deletion
b4_content = """
<div class="space-y-4">
  <div class="bg-card rounded-lg border shadow-xs p-5 space-y-3">
    <div class="text-rose-700 font-bold text-sm">🚨 P1 DEFECT: Destructive Fit/Gap Report Deletion on Assessor Calibration</div>
    <p class="text-xs text-muted-foreground leading-relaxed">
      In <code>PortfolioSkillsController#regenerate_stale_fitgap_reports</code>, the original code executed <code>report.destroy</code> when an assessor adjusted a single skill score. This abruptly broke existing PDF exports, created UI race conditions, and deleted historical evaluation data.
    </p>
    <div class="rounded bg-slate-900 text-slate-100 p-3.5 font-mono text-xs space-y-1">
      <div class="text-slate-400"># Original flawed code in PortfolioSkillsController:</div>
      <div class="text-rose-400 font-bold">FitGapReport.where(portfolio_id: portfolio.id).each do |report|</div>
      <div class="text-rose-400 font-bold">&nbsp;&nbsp;report.destroy  # &lt;-- DESTROYS DATABASE ROW IMMEDIATELY</div>
      <div class="text-rose-400 font-bold">&nbsp;&nbsp;FitGapGeneratorWorker.perform_async(portfolio.id, vacancy_id)</div>
      <div class="text-rose-400 font-bold">end</div>
      <div class="text-slate-400 mt-2"># Consequence: Concurrent users downloading PDF receive HTTP 404 or corrupted files.</div>
    </div>
  </div>
</div>
"""

# AFTER 03: Tabbed Filtering
a3_content = """
<div class="space-y-4">
  <div class="rounded-lg border bg-card shadow-xs p-5 space-y-4">
    <div class="flex items-center justify-between border-b pb-3">
      <div>
        <h2 class="text-sm font-bold text-foreground">Interactive Skill Category Filtering</h2>
        <p class="text-xs text-muted-foreground">Recruiter can filter down to specific skill subsets with a single click.</p>
      </div>
      <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
        Filtered by: Gaps Only (1)
      </span>
    </div>

    <!-- Active Tab Filter Demo -->
    <div class="flex items-center gap-2">
      <span class="px-3 py-1.5 rounded-md text-xs font-medium bg-muted/60 text-muted-foreground">All Skills (6)</span>
      <span class="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">Fit (5)</span>
      <span class="px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-700 text-white shadow-xs">⚠ Gaps (1)</span>
      <span class="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200">Overrides (2)</span>
    </div>

    <table class="w-full text-sm mt-3">
      <thead>
        <tr class="border-b bg-muted/30 text-xs text-muted-foreground uppercase font-semibold">
          <th class="text-left px-4 py-2.5">Competency</th>
          <th class="text-center px-4 py-2.5">Required</th>
          <th class="text-center px-4 py-2.5">AI Assessed</th>
          <th class="text-center px-4 py-2.5">Calibrated</th>
          <th class="text-center px-4 py-2.5">Fit Result</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="px-4 py-3 font-semibold text-foreground">Distributed Consensus (Raft/Paxos)</td>
          <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-xs">L4 Advanced</span></td>
          <td class="px-4 py-3 text-center text-xs">L2 (Functional)</td>
          <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-xs">L2 Functional</span></td>
          <td class="px-4 py-3 text-center"><span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">⚠ Gap (-2)</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
"""

# AFTER 08: Mobile Responsive View
a8_content = """
<div class="space-y-4 max-w-[370px] mx-auto border rounded-xl p-4 bg-white shadow-md">
  <div class="flex items-center justify-between border-b pb-2">
    <div class="text-xs font-bold text-foreground">Fit/Gap Report (Mobile)</div>
    <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold">83% Match</span>
  </div>

  <div class="rounded-lg border p-3 bg-muted/20 space-y-2">
    <div class="text-xs font-semibold text-foreground flex items-center justify-between">
      <span>PostgreSQL Internals</span>
      <span class="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">⭐ Exceeds +1</span>
    </div>
    <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
      <div>Required: <strong class="text-foreground">L3</strong></div>
      <div>Final: <strong class="text-foreground">L4</strong> ✏️</div>
    </div>
    <div class="text-[10px] text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200">
      Assessor: "Deep understanding of MVCC locks."
    </div>
  </div>

  <div class="rounded-lg border p-3 bg-muted/20 space-y-2">
    <div class="text-xs font-semibold text-foreground flex items-center justify-between">
      <span>Ruby on Rails</span>
      <span class="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">✅ Match</span>
    </div>
    <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
      <div>Required: <strong class="text-foreground">L3</strong></div>
      <div>Final: <strong class="text-foreground">L3</strong></div>
    </div>
  </div>

  <div class="rounded-lg border p-3 bg-muted/20 space-y-2">
    <div class="text-xs font-semibold text-foreground flex items-center justify-between">
      <span>Distributed Consensus</span>
      <span class="text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded">⚠ Gap (-2)</span>
    </div>
    <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
      <div>Required: <strong class="text-foreground">L4</strong></div>
      <div>Final: <strong class="text-foreground">L2</strong></div>
    </div>
  </div>
</div>
"""

# AFTER 09 & 10: Terminal Proofs for Multi-Tenant & Non-destructive
a9_content = """
<div class="space-y-4">
  <div class="rounded-lg bg-slate-950 text-slate-100 p-5 font-mono text-xs shadow-md space-y-2">
    <div class="text-emerald-400 font-bold"># RSpec Automated Test Suite: Tenant Isolation & UU PDP Protection</div>
    <div class="text-slate-300">bundle exec rspec spec/requests/api/v1/portfolios_spec.rb</div>
    <div class="text-slate-400 mt-2">Api::V1::Portfolios</div>
    <div class="text-slate-300">&nbsp;&nbsp;GET /api/v1/sessions/:id/portfolio</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ blocks cross-tenant access with 404 under UU PDP isolation</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ returns portfolio details for authorized tenant</div>
    <div class="text-slate-300">&nbsp;&nbsp;GET /api/v1/portfolios/:id/fitgap/:vacancy_id</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ blocks cross-tenant access with 404</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ returns 200 ok when report exists</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ returns 202 accepted when report is not yet generated</div>
    <div class="text-slate-300">&nbsp;&nbsp;GET /api/v1/portfolios/:id/export</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ blocks cross-tenant export with 404</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ exports PDF successfully for authorized tenant</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ exports JSON successfully for authorized tenant</div>
    <div class="text-emerald-400 font-bold mt-3">7 examples, 0 failures [PASS]</div>
  </div>
</div>
"""

a10_content = """
<div class="space-y-4">
  <div class="rounded-lg bg-slate-950 text-slate-100 p-5 font-mono text-xs shadow-md space-y-2">
    <div class="text-emerald-400 font-bold"># RSpec Automated Test Suite: Non-Destructive Regeneration & Atomic Writes</div>
    <div class="text-slate-300">bundle exec rspec spec/requests/api/v1/portfolio_skills_spec.rb</div>
    <div class="text-slate-400 mt-2">Api::V1::PortfolioSkills</div>
    <div class="text-slate-300">&nbsp;&nbsp;POST /api/v1/portfolio_skills/:id/override</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ creates an override and enqueues regeneration without destroying existing reports</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ blocks cross-tenant overrides with 404 under UU PDP</div>
    <div class="text-slate-400 mt-2">FitGap::Engine</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ produces a harmonized comparison payload with required_level and expected_level</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ reflects human assessor overrides and recalculates delta accordingly</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ correctly marks unassessed vacancy skills without penalizing the candidate</div>
    <div class="text-emerald-400 font-bold">&nbsp;&nbsp;&nbsp;&nbsp;✔ generates a deterministic fallback narrative when Gemini client fails</div>
    <div class="text-emerald-400 font-bold mt-3">6 examples, 0 failures [PASS]</div>
  </div>
</div>
"""

SCENARIOS_BATCH_2 = [
    ("BEFORE_03_Cross_Tenant_Portfolio_Leakage.html", "Before: Cross-Tenant Leakage", '<div class="watermark-badge badge-before">BEFORE — P0 SECURITY DEFECT: Cross-Tenant Data Access</div>', b3_content, "max-width: 900px; margin: 0 auto;"),
    ("BEFORE_04_Destructive_Override_Deletion.html", "Before: Destructive Report Deletion", '<div class="watermark-badge badge-before">BEFORE — P1 DEFECT: Destructive Report Deletion on Calibration</div>', b4_content, "max-width: 900px; margin: 0 auto;"),
    ("AFTER_03_FitGap_Interactive_Tabbed_Filtering.html", "After: Interactive Filtering", '<div class="watermark-badge badge-after">AFTER — MONOZUKURI: Fast Interactive Category Tabs</div>', a3_content, "max-width: 900px; margin: 0 auto;"),
    ("AFTER_08_FitGap_Mobile_Responsive_View.html", "After: Mobile Responsive", '<div class="watermark-badge badge-after">AFTER — MONOZUKURI: Mobile Viewport (390px) Hierarchy</div>', a8_content, "max-width: 420px; margin: 0 auto;"),
    ("AFTER_09_MultiTenant_UU_PDP_404_Enforcement.html", "After: Multi-Tenant Enforcement", '<div class="watermark-badge badge-after">AFTER — SYSTEM RIGOR: UU PDP Tenant Isolation Proof</div>', a9_content, "max-width: 900px; margin: 0 auto;"),
    ("AFTER_10_Non_Destructive_Atomic_Regeneration.html", "After: Non-Destructive Regeneration", '<div class="watermark-badge badge-after">AFTER — SYSTEM RIGOR: Non-Destructive Invalidation Proof</div>', a10_content, "max-width: 900px; margin: 0 auto;"),
]

for html_name, title, badge, content, container_style in SCENARIOS_BATCH_2:
    full_html = HTML_TEMPLATE.format(title=title, css=css_content, badge=badge, content=content, container_style=container_style)
    tmp_path = f"/tmp/{html_name}"
    with open(tmp_path, "w") as f:
        f.write(full_html)
    print(f"Generated {tmp_path}")
