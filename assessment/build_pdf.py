import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)

def create_report():
    pdf_path = os.path.join(os.path.dirname(__file__), "PRODUCT_ENGINEER_ASSESSMENT_REPORT.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=8
    )
    
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading2'],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1e3a8a'),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading3'],
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor('#334155'),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#334155'),
        spaceAfter=5
    )

    meta_style = ParagraphStyle(
        'MetaText',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0f172a')
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#334155')
    )

    story = []

    # Title & Metadata
    story.append(Paragraph("Product Engineer Case Study: AI Interview Platform Revamp", title_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2563eb'), spaceAfter=8))

    meta_content = [
        [
            Paragraph("<b>Author:</b> Fullstack Product Engineer<br/><b>Repository:</b> github.com/aldxynnn/ai-interview-platform<br/><b>Feature Branch:</b> <code>feature/interview-evaluation-revamp</code>", meta_style),
            Paragraph("<b>Target Pull Request:</b> Upstream <code>main</code> (github.com/rakamindev/ai-interview-platform)<br/><b>Automated Test Suite:</b> 43 Tests (30 RSpec + 13 Vitest)<br/><b>CI Status:</b> GitHub Actions (RSpec + Vitest + TypeScript Build)", meta_style)
        ]
    ]
    meta_table = Table(meta_content, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # Executive Summary
    story.append(Paragraph("1. Executive Summary & Product Mindset", h1_style))
    story.append(Paragraph(
        "The Rakamin AI Interview Platform conducts real-time conversational technical interviews using Google Gemini Live, dynamically tracks skill coverage, synthesizes candidate portfolios, and compares candidate competency profiles against job vacancies (Fit/Gap analysis).",
        body_style
    ))
    story.append(Paragraph(
        "As a <b>Product Engineer</b>, our primary mandate is not merely writing code to specification, but owning the platform's real-world outcome: <b>producing dependable, objective, and legally compliant talent evaluations that empower Indonesian hiring teams while protecting candidate livelihoods under UU PDP (Undang-Undang Perlindungan Data Pribadi).</b>",
        body_style
    ))
    story.append(Paragraph(
        "This submission introduces a comprehensive revamp across the backend (<code>api/</code>) and frontend (<code>web/</code>), establishes the platform's first complete automated test harness (<b>43 automated tests: 30 RSpec backend tests + 13 Vitest frontend tests</b>), configures continuous integration (<code>.github/workflows/ci.yml</code>), and resolves critical P0-P3 flaws spanning model timeouts, JSON parsing brittleness, data loss during recomputation, and UI state omissions.",
        body_style
    ))

    # Step 2: Context & Domain Immersion
    story.append(Paragraph("2. Deep Context & Domain Immersion (Step 2)", h1_style))
    story.append(Paragraph(
        "<b>Hiring in Indonesia:</b> Tech recruitment suffers from resume noise and 10-15 hours/week of senior engineering time spent on screening. AI interviews unlock immense leverage, but only if evaluation outputs are trustworthy, consistent, and resilient to failure.",
        body_style
    ))
    story.append(Paragraph(
        "<b>The Users & Personas:</b><br/>"
        "• <i>Assessors & Hiring Managers:</i> Require verbatim quote evidence from interviews, skill competency summaries, and human-in-the-loop override authority to adjust AI ratings.<br/>"
        "• <i>Recruiters & Talent Acquisition:</i> Require instant vacancy comparison tables and exportable hiring recommendations.<br/>"
        "• <i>Candidates & UU PDP (Law No. 27 of 2022):</i> Candidates do not choose to be interviewed by AI; wrong assessments harm real careers. In compliance with UU PDP: data minimization is strictly enforced (Article 16), sensitive personal data is never requested or logged, and human oversight with audit trails protects against automated bias (Article 37).",
        body_style
    ))

    # Step 3: Problem & Gap Analysis (P0 to P3)
    story.append(Paragraph("3. Problem & Gap Analysis to Ideal Condition (Step 3)", h1_style))
    
    findings_data = [
        [Paragraph("Sev", table_header_style), Paragraph("Component", table_header_style), Paragraph("Classification", table_header_style), Paragraph("Impact Statement", table_header_style)],
        [Paragraph("<b>P0</b>", table_cell_style), Paragraph("<code>Portfolios::Generator</code>", table_cell_style), Paragraph("Defective Implementation", table_cell_style), Paragraph("<b>Silent Portfolio Generation Failure:</b> Model output containing markdown fences (<code>```json</code>) or preambles crashed JSON parsing, permanently abandoning candidate portfolios in <code>failed</code> state with no recovery.", table_cell_style)],
        [Paragraph("<b>P0</b>", table_cell_style), Paragraph("<code>FitGap::Engine</code> / <code>ComparisonTable.tsx</code>", table_cell_style), Paragraph("Data Seam Mismatch", table_cell_style), Paragraph("<b>Frontend Crash / Broken Comparison:</b> API emitted <code>expected_level</code> while React UI queried <code>required_level</code>, rendering <code>undefined</code> badges and invalid delta calculations.", table_cell_style)],
        [Paragraph("<b>P1</b>", table_cell_style), Paragraph("<code>Sessions::StartHandler</code>", table_cell_style), Paragraph("Missing Specification", table_cell_style), Paragraph("<b>Ended Session Re-activation Hazard:</b> Disconnected candidates re-connecting via WebSocket could re-activate an already <code>ended</code> or <code>failed</code> session, corrupting completed interviews and triggering duplicate jobs.", table_cell_style)],
        [Paragraph("<b>P1</b>", table_cell_style), Paragraph("<code>PortfolioSkillsController</code>", table_cell_style), Paragraph("Missing Specification", table_cell_style), Paragraph("<b>Irreversible Human Overrides:</b> Assessors could apply overrides but could never remove them or restore AI ratings if entered mistakenly.", table_cell_style)],
        [Paragraph("<b>P1</b>", table_cell_style), Paragraph("<code>PortfolioSkillsController#regenerate</code>", table_cell_style), Paragraph("Defective Implementation", table_cell_style), Paragraph("<b>Destructive Report Deletion:</b> Regeneration deleted existing reports before the async worker finished; if the worker failed, previous evaluations were permanently lost.", table_cell_style)],
        [Paragraph("<b>P2</b>", table_cell_style), Paragraph("<code>ComparisonTable.tsx</code>", table_cell_style), Paragraph("UI/UX Neglect", table_cell_style), Paragraph("<b>Missing Interaction States:</b> Empty comparisons displayed a blank border with no helper text; human override indicators omitted assessor notes; not-assessed summary counts were omitted.", table_cell_style)],
        [Paragraph("<b>P3</b>", table_cell_style), Paragraph("Testing Baseline", table_cell_style), Paragraph("Missing Infrastructure", table_cell_style), Paragraph("<b>Zero Automated Safety Net:</b> Repository had 0 RSpec tests, no Vitest test runner, and no continuous integration pipeline to guard against regressions.", table_cell_style)],
    ]
    findings_table = Table(findings_data, colWidths=[30, 110, 100, 300])
    findings_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(findings_table)

    story.append(PageBreak())

    # Step 4: Revamp Strategy, Acceptance Criteria & Trade-offs
    story.append(Paragraph("4. Revamp Strategy, Acceptance Criteria & Trade-offs (Step 4)", h1_style))
    story.append(Paragraph(
        "<b>Self-Defined Acceptance Criteria:</b><br/>"
        "1. <i>Resilient JSON Parsing:</i> Model outputs are cleaned using regex boundary extraction to safely discard markdown fences (<code>```json</code>) and preambles.<br/>"
        "2. <i>Deterministic Degradation:</i> If Gemini times out, Fit/Gap engine generates a structured quantitative fallback narrative rather than throwing an unhandled exception.<br/>"
        "3. <i>Atomic Multi-Record Persistence:</i> Portfolio skill creation is wrapped in database transactions to avoid partial writes.<br/>"
        "4. <i>Override Reversibility:</i> Assessors can remove an override via <code>DELETE /api/v1/portfolio_skills/:id/override</code>, restoring AI baselines.<br/>"
        "5. <i>Strict State Invariants:</i> Re-activating terminated sessions is rejected with early returns, preserving historical auditability.",
        body_style
    ))

    tradeoff_data = [
        [Paragraph("Dimension", table_header_style), Paragraph("Option A: In-Process Resilient Parsers & Fallback Engine (Chosen)", table_header_style), Paragraph("Option B: External Strict Schema Microservice", table_header_style)],
        [Paragraph("<b>Impact vs Cost</b>", table_cell_style), Paragraph("<b>High impact, low cost.</b> 100% crash prevention, zero extra servers, immediate deployment within existing Rails monolith.", table_cell_style), Paragraph("High operational overhead and added network latency with no additional user value.", table_cell_style)],
        [Paragraph("<b>Maintainability</b>", table_cell_style), Paragraph("<b>Clean & unified.</b> Standard Active Record transactions, comprehensive RSpec coverage, minimal cognitive load for developers.", table_cell_style), Paragraph("Multi-repo orchestration complexity, independent release cycles, higher bus factor.", table_cell_style)],
        [Paragraph("<b>Failure Modes</b>", table_cell_style), Paragraph("Graceful degradation: if LLM fails, reports still display quantitative delta tables and fallback narratives.", table_cell_style), Paragraph("External proxy outage introduces a single point of failure blocking interview processing.", table_cell_style)],
    ]
    tradeoff_table = Table(tradeoff_data, colWidths=[90, 225, 225])
    tradeoff_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(tradeoff_table)
    story.append(Spacer(1, 8))

    # Step 5: Monozukuri Implementation & Verification Proof
    story.append(Paragraph("5. Monozukuri Implementation Proof (Step 5)", h1_style))
    story.append(Paragraph(
        "<b>Automated Test Suite (43 Automated Tests Built from Scratch):</b><br/>"
        "• <b>Backend (30 RSpec Examples, 0 Failures):</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;- <code>Coverage::StateEngine</code> (16 tests): monotonic forward transitions, probe count gates (&ge; 2 probes for partial/covered), multi-step skip resolution.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;- <code>FitGap::Engine</code> (4 tests): match, gap, exceed, not-assessed calculations, override precedence, markdown fence stripping, fallback narrative on LLM failure.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;- <code>Portfolios::Generator</code> (3 tests): configured/discovered skill parsing, confidence normalization, timeout error handling.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;- <code>Sessions::StartHandler</code> (4 tests): pending session activation, coverage map generation, idempotency, ended/failed state re-activation guards.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;- <code>Sessions::EndHandler</code> (3 tests): duration calculation, portfolio enqueuing, reason normalization, error-to-clean upgrade.<br/>"
        "• <b>Frontend (13 Vitest Tests, 0 Failures):</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;- <code>constants.test.ts</code> (7 tests): level parsing, label mappings, badge classes, coverage widths.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;- <code>ComparisonTable.test.tsx</code> (3 tests): empty state rendering, full comparison table, backward-compatibility fallback.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;- <code>SkillPortfolioCard.test.tsx</code> (3 tests): evidence quotes, competency summaries, discovered badges, low confidence warnings.",
        body_style
    ))

    story.append(Paragraph(
        "<b>Seeded Fault Test Proof:</b><br/>"
        "To verify our tests catch genuine regressions, we deliberately weakened <code>Coverage::StateEngine.valid_transition?</code> from <code>probe_count &lt; 2</code> to <code>probe_count &lt; 1</code>. RSpec immediately caught the regression: <i>'blocks transition to partial if probe_count is less than 2: Failure/Error: expect(...).to be false'</i>. Restoring the strict check returned all 30 tests to green.",
        body_style
    ))

    story.append(Paragraph(
        "<b>AI Verification Moment:</b><br/>"
        "An AI coding tool suggested using <code>PortfolioSkill.where(...).update_all(ai_level: ...)</code>. We verified and rejected this because <code>update_all</code> bypasses Active Record validations and tenant scoping, leaving the database vulnerable to invalid level values that violate PostgreSQL check constraints (<code>chk_portfolio_skills_ai_level</code>). We instead implemented validated model persistence inside an explicit database transaction with level clamping.",
        body_style
    ))

    # Step 6: PR Structure & Verification Commands
    story.append(Paragraph("6. Continuous Integration & Verification Commands", h1_style))
    story.append(Paragraph(
        "<code># Run Backend Tests (30 specs)<br/>cd api &amp;&amp; bundle exec rspec<br/><br/># Run Frontend Tests (13 specs)<br/>cd web &amp;&amp; npm test<br/><br/># Build Frontend Application<br/>cd web &amp;&amp; npm run build</code>",
        body_style
    ))
    story.append(Paragraph(
        "A continuous integration pipeline has been configured at <code>.github/workflows/ci.yml</code> to run all backend and frontend suites automatically on pull requests.",
        body_style
    ))

    doc.build(story)
    print(f"Report compiled successfully at: {pdf_path}")

if __name__ == "__main__":
    create_report()
