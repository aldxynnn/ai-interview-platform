const fs = require('fs');
const path = require('path');
const { marked } = require('../web/node_modules/marked');
const puppeteer = require('../web/node_modules/puppeteer-core');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const reportMdPath = path.resolve(__dirname, '../assessment/report.md');
const screenshotsDir = path.resolve(__dirname, '../assessment/screenshots');
const outputHtmlPath = path.resolve(__dirname, '../assessment/report.html');
const outputPdfPath = path.resolve(__dirname, '../assessment/fullstack-product-engineer-submission.pdf');

async function buildPdf() {
  console.log('Reading report markdown...');
  let md = fs.readFileSync(reportMdPath, 'utf-8');

  // Relative file paths for HTML rendering
  const screenshots = {
    '01-candidate-pdp-consent.png': 'Candidate PDP Statutory Consent Gate',
    '02-candidate-pdp-expanded.png': 'Candidate Expanded Rights View',
    '03-assessment-hub.png': 'Assessor Hub Dashboard with Real-time Telemetry',
    '04-vacancies-list.png': 'Job Vacancies & Competency Modeling (L1-L5 Rubrics)',
    '05-candidate-mobile.png': 'Mobile Responsive Viewport (iPhone 390px)',
    '06-auth-login.png': 'Enterprise Authentication Screen with Compliance Badges',
  };

  let imageHtmlSection = '<div class="screenshot-gallery"><h2>📸 Embedded Visual Evidence & Screenshots</h2>';
  for (const [filename, label] of Object.entries(screenshots)) {
    const fullPath = path.join(screenshotsDir, filename);
    if (fs.existsSync(fullPath)) {
      imageHtmlSection += `
        <figure class="screenshot-card">
          <img src="screenshots/${filename}" alt="${label}" />
          <figcaption><strong>Figure:</strong> ${label} (<code>${filename}</code>)</figcaption>
        </figure>
      `;
    }
  }
  imageHtmlSection += '</div>';

  md = md.replace('## 9. Visual Artifacts & Screenshot Proof', '## 9. Visual Artifacts & Screenshot Proof\n\n' + imageHtmlSection);

  const parsedBody = marked.parse(md);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Rakamin AI Interview Platform - Monozukuri Submission</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 20px;
    }

    h1 {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2.5px solid #0284c7;
      padding-bottom: 6px;
      margin-top: 0;
      margin-bottom: 12px;
    }

    h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #0369a1;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 20px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    h3 {
      font-size: 11pt;
      font-weight: 600;
      color: #334155;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    p, ul, ol {
      margin-top: 4px;
      margin-bottom: 8px;
    }

    li {
      margin-bottom: 3px;
    }

    blockquote {
      margin: 10px 0;
      padding: 8px 14px;
      background-color: #f0f9ff;
      border-left: 4px solid #0284c7;
      color: #0369a1;
      font-style: italic;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    code {
      font-family: Consolas, Monaco, monospace;
      font-size: 8.5pt;
      background-color: #f1f5f9;
      padding: 2px 4px;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
    }

    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 10px 14px;
      border-radius: 6px;
      font-family: Consolas, Monaco, monospace;
      font-size: 8pt;
      overflow-x: auto;
      margin: 10px 0;
      page-break-inside: avoid;
      line-height: 1.4;
    }

    pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
      border: none;
    }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 16px 0;
    }

    a {
      color: #0284c7;
      text-decoration: none;
    }

    .screenshot-gallery {
      margin-top: 14px;
    }

    .screenshot-card {
      margin: 16px 0;
      padding: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      text-align: center;
      page-break-inside: avoid;
    }

    .screenshot-card img {
      max-width: 90%;
      height: auto;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
    }

    .screenshot-card figcaption {
      margin-top: 6px;
      font-size: 8.5pt;
      color: #475569;
    }
  </style>
</head>
<body>
  ${parsedBody}
</body>
</html>`;

  fs.writeFileSync(outputHtmlPath, fullHtml, 'utf-8');
  console.log('Saved HTML to:', outputHtmlPath);

  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const fileUrl = 'file:///' + outputHtmlPath.replace(/\\/g, '/');
  console.log('Navigating to:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'load' });

  console.log('Generating PDF to:', outputPdfPath);
  await page.pdf({
    path: outputPdfPath,
    format: 'A4',
    margin: {
      top: '15mm',
      right: '12mm',
      bottom: '15mm',
      left: '12mm',
    },
    printBackground: true,
  });

  await browser.close();
  console.log('PDF successfully generated!');
}

buildPdf().catch((err) => {
  console.error('Failed to generate PDF:', err);
  process.exit(1);
});
