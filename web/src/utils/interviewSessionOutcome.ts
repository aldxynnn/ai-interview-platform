import type { InterviewState, WsControlMessage } from "@/types";

export interface InterviewFailure {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface InterviewOutcome {
  state: Extract<InterviewState, "complete" | "failed">;
  terminal: true;
  failure?: InterviewFailure;
}

const GENERIC_FAILURE_MESSAGE =
  "We could not complete the interview. Your session status needs to be reviewed by the hiring team.";

const STARTUP_FAILURE_MESSAGE =
  "We could not start the interview. Your answers have not been recorded. Please try again or contact the hiring team.";

/**
 * Translate server protocol messages into truthful UI outcomes.
 * A fatal error is never rendered as successful completion.
 */
export function resolveInterviewOutcome(
  message: WsControlMessage
): InterviewOutcome | null {
  if (message.type === "session_ended") {
    if (message.reason === "error") {
      return {
        state: "failed",
        terminal: true,
        failure: {
          code: message.code ?? "session_failed",
          message: message.message ?? GENERIC_FAILURE_MESSAGE,
          recoverable: false,
        },
      };
    }

    return { state: "complete", terminal: true };
  }

  if (message.type === "error") {
    const recoverable = message.recoverable === true;
    return {
      state: "failed",
      terminal: true,
      failure: {
        code: message.code ?? "interview_failed",
        message:
          message.message ??
          (recoverable ? STARTUP_FAILURE_MESSAGE : GENERIC_FAILURE_MESSAGE),
        recoverable,
      },
    };
  }

  return null;
}
