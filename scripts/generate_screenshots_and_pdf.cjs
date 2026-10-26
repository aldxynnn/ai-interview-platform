const puppeteer = require('../web/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const distDir = path.resolve(__dirname, '../web/dist');
const screenshotDir = path.resolve(__dirname, '../assessment/screenshots');

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

// Simple static server for SPA dist
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  let filePath = path.join(distDir, url);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback
    const indexPath = path.join(distDir, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexPath).pipe(res);
  }
});

const PORT = 5174;

server.listen(PORT, async () => {
  console.log(`Preview server running at http://localhost:${PORT}`);

  try {
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
    });

    const page = await browser.newPage();

    // 1. Candidate Interview Page with UU PDP Consent Notice
    console.log('Capturing Candidate Interview & PDP Consent...');
    await page.goto(`http://localhost:${PORT}/interview/sample-invite-token`, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(screenshotDir, '01-candidate-pdp-consent.png'), fullPage: false });

    // Click details to show expanded PDP rights
    const toggleBtn = await page.$('button[aria-expanded="false"]');
    if (toggleBtn) {
      await toggleBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      await page.screenshot({ path: path.join(screenshotDir, '02-candidate-pdp-expanded.png'), fullPage: false });
    }

    // Set auth token in localStorage for assessor views
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJzY2hlbWUiOiJ0ZXN0LWNvcnAiLCJleHAiOjE3OTMyNTY5MjR9.9q57isfXj6-1fs-d4em8msJsE3fPsm6lDN8xpsoR1qg');
    });

    // 2. Assessment Hub
    console.log('Capturing Assessments Hub...');
    await page.goto(`http://localhost:${PORT}/assessments`, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(screenshotDir, '03-assessment-hub.png'), fullPage: false });

    // 3. Vacancies
    console.log('Capturing Vacancies Page...');
    await page.goto(`http://localhost:${PORT}/vacancies`, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(screenshotDir, '04-vacancies-list.png'), fullPage: false });

    // 4. Login Page
    console.log('Capturing Login Page...');
    await page.evaluate(() => {
      localStorage.removeItem('auth_token');
    });
    await page.goto(`http://localhost:${PORT}/login`, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(screenshotDir, '06-auth-login.png'), fullPage: false });

    // 5. Mobile responsive view for Candidate
    console.log('Capturing Mobile Responsive View...');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:${PORT}/interview/sample-invite-token`, { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(screenshotDir, '05-candidate-mobile.png'), fullPage: false });

    await browser.close();
    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
