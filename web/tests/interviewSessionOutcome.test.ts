import { describe, expect, it } from "vitest";
import { resolveInterviewOutcome } from "../src/utils/interviewSessionOutcome";
import type { WsControlMessage } from "../src/types";

describe("resolveInterviewOutcome", () => {
  it("does not report a provider/session error as successful completion", () => {
    const message: WsControlMessage = {
      type: "session_ended",
      reason: "error",
      message: "The session could not be started.",
    };

    expect(resolveInterviewOutcome(message)).toEqual({
      state: "failed",
      terminal: true,
      failure: {
        code: "session_failed",
        message: "The session could not be started.",
        recoverable: false,
      },
    });
  });

  it("keeps normal session endings on the completion path", () => {
    expect(
      resolveInterviewOutcome({
        type: "session_ended",
        reason: "all_covered",
      })
    ).toEqual({ state: "complete", terminal: true });
  });

  it("preserves whether a startup failure can be retried", () => {
    expect(
      resolveInterviewOutcome({
        type: "error",
        code: "interview_start_failed",
        message: "Please try again.",
        recoverable: true,
      })?.failure?.recoverable
    ).toBe(true);
  });

  it("uses a safe fallback when an error has no user-facing message", () => {
    const result = resolveInterviewOutcome({ type: "error" });
    expect(result?.state).toBe("failed");
    expect(result?.failure?.message).toContain("could not complete");
  });

  it("ignores non-terminal protocol messages", () => {
    expect(
      resolveInterviewOutcome({ type: "session_started" })
    ).toBeNull();
  });
});
