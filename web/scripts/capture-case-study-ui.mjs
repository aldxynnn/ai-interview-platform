import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const origin = process.env.EVIDENCE_BASE_URL ?? "http://127.0.0.1:4173";
const outputDir = path.resolve("evidence");
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

async function preparePage({ viewport, scenario }) {
  const context = await browser.newContext({
    viewport,
    permissions: ["microphone"],
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Deterministic candidate details; the screenshots document actual app rendering,
  // while backend/provider dependencies are controlled test doubles.
  await page.route(/\/api\/v1\/sessions\/[^/]+\/candidate$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          session_id: 1,
          role_title: "Product Engineer",
          time_limit_min: 30,
          session_status: "pending",
          session_end_reason: null,
        },
      }),
    })
  );

  // Prevent the hardware preflight from depending on external CDN/echo availability.
  await page.route("**/mock-ping", (route) =>
    route.fulfill({ status: 200, body: "ok" })
  );
  await page.route("**/mock-upload", (route) =>
    route.fulfill({ status: 204, body: "" })
  );
  await page.route(/https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain",
      headers: { "access-control-allow-origin": "*" },
      body: "x".repeat(200_000),
    })
  );

  await page.routeWebSocket("**/ws/sessions/**", (socket) => {
    socket.onMessage((raw) => {
      if (typeof raw !== "string") return;
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }

      if (message.type === "auth" && scenario === "complete") {
        socket.send(JSON.stringify({ type: "session_started", session_id: 1 }));
      } else if (message.type === "auth" && scenario === "failure") {
        socket.send(JSON.stringify({
          type: "error",
          code: "interview_start_failed",
          message: "We could not start the interview. Your answers have not been recorded. Please try again or contact the hiring team.",
          recoverable: true,
        }));
      } else if (message.type === "auth" && scenario === "fatal") {
        socket.send(JSON.stringify({
          type: "session_ended",
          reason: "error",
          message: "The interview connection failed. Please contact the hiring team to confirm your session status.",
        }));
      } else if (message.type === "end_session" && scenario === "complete") {
        socket.send(JSON.stringify({ type: "session_ended", reason: "manual_candidate" }));
      }
    });
  });

  return { page, context };
}

async function startViaPreflight(page) {
  await page.goto(`${origin}/interview/case-study-demo`, { waitUntil: "networkidle" });
  const startButton = page.getByRole("button", { name: /start interview/i });
  await startButton.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll("button")).find((item) =>
      item.textContent?.trim().toLowerCase() === "start interview"
    );
    return Boolean(button && !(button instanceof HTMLButtonElement && button.disabled));
  }, undefined, { timeout: 25_000 });
  await startButton.click();
}

try {
  // Retryable startup error at a desktop viewport.
  const desktop = await preparePage({
    viewport: { width: 1440, height: 960 },
    scenario: "failure",
  });
  await startViaPreflight(desktop.page);
  await desktop.page.getByRole("heading", { name: "Interview could not be completed" }).waitFor({ timeout: 15_000 });
  await desktop.page.getByRole("button", { name: /try again/i }).waitFor();
  await desktop.page.screenshot({ path: path.join(outputDir, "startup-failure-desktop.png"), fullPage: true });
  await desktop.context.close();

  // The same real app UI at a narrow/mobile viewport.
  const mobile = await preparePage({
    viewport: { width: 390, height: 844 },
    scenario: "failure",
  });
  await startViaPreflight(mobile.page);
  await mobile.page.getByRole("heading", { name: "Interview could not be completed" }).waitFor({ timeout: 15_000 });
  await mobile.page.screenshot({ path: path.join(outputDir, "startup-failure-mobile.png"), fullPage: true });
  await mobile.context.close();

  // Non-retryable failure: preserve the terminal status and point to human follow-up.
  const fatal = await preparePage({
    viewport: { width: 1440, height: 960 },
    scenario: "fatal",
  });
  await startViaPreflight(fatal.page);
  await fatal.page.getByRole("heading", { name: "Interview could not be completed" }).waitFor({ timeout: 15_000 });
  await fatal.page.getByText(/Please contact the hiring team to confirm your session status/).first().waitFor();
  if (await fatal.page.getByRole("button", { name: /try again/i }).count()) {
    throw new Error("Fatal session failures must not offer an unsafe retry.");
  }
  await fatal.page.screenshot({ path: path.join(outputDir, "startup-failure-fatal-desktop.png"), fullPage: true });
  await fatal.context.close();

  // Clean completion contract: only the explicit normal session-ended message shows success.
  const complete = await preparePage({
    viewport: { width: 1440, height: 960 },
    scenario: "complete",
  });
  await startViaPreflight(complete.page);
  await complete.page.getByRole("button", { name: /end interview/i }).first().click();
  await complete.page.getByRole("heading", { name: "End interview?" }).waitFor();
  await complete.page.getByRole("button", { name: "End interview" }).last().click();
  await complete.page.getByRole("heading", { name: "Interview Complete" }).waitFor({ timeout: 15_000 });
  await complete.page.screenshot({ path: path.join(outputDir, "interview-complete-desktop.png"), fullPage: true });
  await complete.context.close();

  console.log("Captured 4 real-app screenshots with deterministic API/WebSocket mocks.");
} finally {
  await browser.close();
}
