import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, CheckCircle, Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import VoiceBars from "@/components/interview/VoiceBars";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

type CandidateInfoStatus = "loading" | "ready" | "not_found" | "error";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [candidateInfoStatus, setCandidateInfoStatus] = useState<CandidateInfoStatus>("loading");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setCandidateInfoStatus("not_found");
      return;
    }
    setCandidateInfoStatus("loading");
    sessionsApi.getCandidateInfo(token)
      .then((response) => {
        setCandidateInfo(response.data);
        setSessionId(response.data.session_id);
        setCandidateInfoStatus("ready");
        if (response.data.session_status === "ended") setInterviewState("complete");
      })
      .catch((error: unknown) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        setCandidateInfoStatus(status === 404 ? "not_found" : "error");
      });
  }, [token]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const { playChunk, stop: stopPlayback, scheduleAfterPlayback, waitForDrain, cancelDrain } = useAudioPlayback();
  const audioCompleteCalledRef = useRef(false);
  const audioCompleteSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callAudioComplete = useCallback(async () => {
    if (audioCompleteCalledRef.current || !token) return;
    audioCompleteCalledRef.current = true;
    cancelDrain();
    if (audioCompleteSafetyTimerRef.current) {
      clearTimeout(audioCompleteSafetyTimerRef.current);
      audioCompleteSafetyTimerRef.current = null;
    }
    const attempt = async (delay: number) => {
      try {
        await sessionsApi.audioComplete(token);
      } catch {
        setTimeout(() => attempt(Math.min(delay * 2, 8000)), delay);
      }
    };
    attempt(2000);
  }, [token, cancelDrain]);

  const handleStateChange = useCallback((state: InterviewState) => {
    setInterviewState(state);
    if (state === "draining_audio") {
      muteRef.current?.();
      audioCompleteCalledRef.current = false;
      audioCompleteSafetyTimerRef.current = setTimeout(() => callAudioComplete(), 10_000);
      waitForDrain(() => callAudioComplete());
      return;
    }
    if (state === "reconnecting") {
      muteRef.current?.();
      connectionLostTimerRef.current = setTimeout(() => setConnectionLostLong(true), 60_000);
    } else {
      if (connectionLostTimerRef.current) {
        clearTimeout(connectionLostTimerRef.current);
        connectionLostTimerRef.current = null;
      }
      setConnectionLostLong(false);
      if (state === "active" && !micMutedRef.current) unmuteRef.current?.();
    }
  }, [callAudioComplete, waitForDrain]);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((previous) => [...previous.slice(-9), turn]);
  }, []);

  const handleSpeakerChange = useCallback((newSpeaker: InterviewSpeaker) => {
    if (newSpeaker === "ai") {
      setSpeaker("ai");
      muteRef.current?.();
    } else if (newSpeaker === "candidate") {
      scheduleAfterPlayback(() => {
        setSpeaker("candidate");
        if (!micMutedRef.current) unmuteRef.current?.();
      });
    }
  }, [scheduleAfterPlayback]);

  const { connect, send, sendJson, disconnect, connectionState } = useAudioWebSocket({
    sessionId: sessionId ?? 0,
    token,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected,
  });

  const { start: startCapture, stop: stopCapture, mute, unmute } = useAudioCapture({ onFrame: send });
  muteRef.current = mute;
  unmuteRef.current = unmute;

  const toggleMic = useCallback(() => {
    if (micMutedRef.current) {
      micMutedRef.current = false;
      setMicMuted(false);
      unmute();
    } else {
      micMutedRef.current = true;
      setMicMuted(true);
      mute();
    }
  }, [mute, unmute]);

  const startInterview = useCallback(async () => {
    if (!sessionId) return;
    setInterviewState("connecting");
    connect();
    await startCapture();
    muteRef.current?.();
  }, [sessionId, connect, startCapture]);

  const endInterview = useCallback(async () => {
    setInterviewState("ending");
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    stopCapture();
    stopPlayback();
    sendJson({ type: "end_session" });
    disconnect();
    setInterviewState("complete");
  }, [stopCapture, stopPlayback, sendJson, disconnect]);

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
        ? "connected"
        : "reconnecting";

  if (candidateInfoStatus === "loading") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4">
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          Validating your interview invitation...
        </div>
      </div>
    );
  }

  if (candidateInfoStatus === "not_found" || candidateInfoStatus === "error") {
    const invalidInvite = candidateInfoStatus === "not_found";
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-8">
        <div role="alert" className="w-full space-y-3 rounded-xl border p-6 text-center">
          <AlertCircle aria-hidden="true" className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold">{invalidInvite ? "Invitation unavailable" : "Could not verify invitation"}</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {invalidInvite
              ? "This interview link is invalid or no longer available. Please contact your recruiter for a valid invitation."
              : "We could not connect to verify your interview link. Check your connection and reload this page, or contact your recruiter if the issue persists."}
          </p>
        </div>
      </div>
    );
  }

  if (interviewState === "idle") {
    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && <p className="text-sm text-muted-foreground">{candidateInfo.time_limit_min} minutes</p>}
        </div>
        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="space-y-1.5 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              <p>This is a voice interview. Please find a quiet place.</p>
              <p>The AI may ask follow-up questions based on your answers.</p>
              <p>The session can last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</p>
              <p>Your microphone is used during the interview. You can end the session at any time.</p>
            </div>
            <HardwareCheck onStart={() => { setHardwareCheckDone(true); void startInterview(); }} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
              <CheckCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>Hardware checks passed. You are ready to start.</span>
            </div>
            <Button className="w-full" size="lg" onClick={() => void startInterview()}>
              <Mic aria-hidden="true" className="mr-2 h-4 w-4" /> Start Interview
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (interviewState === "complete") {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center">
        <CheckCircle aria-hidden="true" className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="text-xl font-semibold">Interview session ended</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Thank you for participating. The hiring team can review the session information available to them. Contact your recruiter if you need help.
        </p>
      </div>
    );
  }

  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col px-4">
      <div className="sticky top-12 z-10 flex items-center justify-between border-b bg-white py-3">
        <span className="text-sm font-medium">AI Interview</span>
        {candidateInfo && (
          <InterviewTimer totalSeconds={candidateInfo.time_limit_min * 60} running={interviewState === "active"} onExpired={endInterview} />
        )}
      </div>

      {interviewState === "reconnecting" && (
        <div role="status" className={"mt-2 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm " + (connectionLostLong ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
          <span aria-hidden="true" className="animate-pulse">●</span>
          <span>{connectionLostLong ? "Connection is taking longer to restore. Please wait and contact your interviewer if this continues." : "Connection interrupted. Reconnecting; please wait a moment."}</span>
        </div>
      )}

      {reconnectedPrompt && (
        <div role="status" className="mt-2 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          <span>Reconnected. Please say "check" or continue your answer to resume.</span>
          <button type="button" aria-label="Dismiss reconnect message" className="ml-3 shrink-0 rounded px-2 py-1 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setReconnectedPrompt(false)}>Dismiss</button>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
        {interviewState === "connecting" ? (
          <div role="status" className="text-sm text-muted-foreground">Connecting to your interview...</div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active label="AI speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Wrapping up the last response...</p>
          </div>
        ) : (
          <>
            <VoiceBars active={aiSpeaking} label={aiSpeaking ? "AI speaking" : "Listening..."} variant="ai" />
            {candidateSpeaking && <VoiceBars active label="You're speaking" variant="candidate" />}
            {transcript.length > 0 && (
              <div aria-label="Recent interview transcript" className="max-h-[60vh] w-full space-y-2 overflow-y-auto">
                {transcript.map((turn, index) => <TranscriptBubble key={index} speaker={turn.speaker} text={turn.text} />)}
              </div>
            )}
          </>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t bg-white py-3">
        <ConnectionStatus state={wsConnectionStatus} />
        <div className="flex items-center gap-3">
          <Button variant={micMuted ? "destructive" : "outline"} size="sm" onClick={toggleMic}>
            {micMuted ? <><MicOff aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> Muted</> : <><Mic aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> Mic On</>}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm">End Interview</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End interview?</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to end this interview early?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continue interview</AlertDialogCancel>
                <AlertDialogAction onClick={() => void endInterview()}>End interview</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {import.meta.env.DEV && (
            <Button variant="outline" size="sm" className="text-xs opacity-70" onClick={() => sendJson({ type: "debug_force_reconnect" })}>
              Force reconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
