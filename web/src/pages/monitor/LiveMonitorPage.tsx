import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
import { Skeleton } from "@/components/ui/skeleton";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";
import { sessionsApi } from "@/services/sessions";
import {
  COVERAGE_STATE_LABELS,
  COVERAGE_STATE_WIDTH,
  COVERAGE_STATE_COLOR,
} from "@/utils/constants";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Radio,
  Zap,
  Activity,
  MessageSquare,
  AlertCircle,
  StopCircle,
} from "lucide-react";
import type { TranscriptTurn } from "@/types";
import { cn } from "@/lib/utils";

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80">
      <Clock className="h-3.5 w-3.5 text-slate-500" />
      {mm}:{ss}
    </span>
  );
}

export default function LiveMonitorPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string>("");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const lastTurnRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { coverageMap, sessionEnded, sessionEndReason, isConnected } =
    useCoverageWebSocket(Number(sessionId));

  // On session_ended from WS — stop polling, update local state
  useEffect(() => {
    if (sessionEnded) {
      setSessionActive(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [sessionEnded]);

  // Initial load
  useEffect(() => {
    Promise.all([
      sessionsApi.get(Number(sessionId)),
      sessionsApi.getTranscript(Number(sessionId)),
    ])
      .then(([sRes, tRes]) => {
        const s = sRes.data.session as any;
        setStartedAt(s.started_at ?? null);
        setAssessmentName(s.assessment?.name ?? "");
        if (s.status !== "active") setSessionActive(false);

        const turns = tRes.data.turns;
        setTranscript(turns.slice(-10));
        if (turns.length > 0) {
          lastTurnRef.current = turns[turns.length - 1].turn_number;
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Poll transcript every 3s while session is active
  const fetchNewTurns = useCallback(async () => {
    try {
      const res = await sessionsApi.getTranscript(
        Number(sessionId),
        lastTurnRef.current + 1
      );
      if (res.data.turns.length > 0) {
        setTranscript((prev) => [...prev, ...res.data.turns].slice(-10));
        lastTurnRef.current = res.data.turns[res.data.turns.length - 1].turn_number;
      }
    } catch {
      // transient poll failure — silently skip, retry on next interval
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionActive || loading) return;
    pollTimerRef.current = setInterval(fetchNewTurns, 3000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [sessionActive, loading, fetchNewTurns]);

  const handleEndSession = async () => {
    setEnding(true);
    try {
      await sessionsApi.endSession(Number(sessionId));
      navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`);
    } catch {
      setEnding(false);
      setEndError(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link
          to={`/assessments/${id}/invite`}
          className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Sessions
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">Live Monitor #{sessionId}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Assessor Live Monitor</h1>
            <Badge variant="secondary" className="text-2xs bg-slate-100 text-slate-700">
              Session #{sessionId}
            </Badge>
          </div>
          {assessmentName && (
            <p className="text-xs text-slate-500 font-medium">{assessmentName}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {startedAt && sessionActive && <ElapsedTimer startedAt={startedAt} />}

          <div
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border",
              isConnected
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              )}
            />
            {isConnected ? "WebSocket Live" : "Reconnecting..."}
          </div>
        </div>
      </div>

      {/* Session ended banner */}
      {sessionEnded && (
        <div className="flex items-center gap-3 text-xs bg-emerald-50/80 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-950">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Interview session has concluded</p>
            {sessionEndReason && (
              <p className="text-emerald-800 capitalize mt-0.5">
                Reason: {sessionEndReason.replace(/_/g, " ")}
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-2xs"
          >
            View Portfolio →
          </Button>
        </div>
      )}

      {/* Real-time Coverage Map */}
      <Card className="border-slate-200/90 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-sky-600" />
              <CardTitle className="text-sm font-semibold text-slate-900">
                Competency Coverage Progress
              </CardTitle>
            </div>
            <span className="text-2xs text-slate-400">Real-time probe telemetry</span>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {configuredSkills.length === 0 && discoveredSkills.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              Waiting for interview probes to commence...
            </p>
          ) : (
            configuredSkills.map((skill) => (
              <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">{skill.skill_label}</span>
                  <div className="flex items-center gap-2 text-2xs text-slate-500">
                    {skill.probe_count > 0 && (
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                        {skill.probe_count} {skill.probe_count !== 1 ? "probes" : "probe"}
                      </span>
                    )}
                    <span className="capitalize font-medium text-slate-700">
                      {COVERAGE_STATE_LABELS[skill.state]}
                    </span>
                  </div>
                </div>
                <Progress
                  value={COVERAGE_STATE_WIDTH[skill.state]}
                  indicatorClassName={COVERAGE_STATE_COLOR[skill.state]}
                  className="h-2 bg-slate-100"
                />
                {skill.last_signal && (
                  <p className="text-2xs text-slate-500 truncate italic">
                    "{skill.last_signal}"
                  </p>
                )}
              </div>
            ))
          )}

          {/* Discovered skills */}
          {discoveredSkills.length > 0 && (
            <>
              {configuredSkills.length > 0 && <Separator className="my-3" />}
              <div className="space-y-3">
                <p className="text-2xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Discovered Competencies
                </p>
                {discoveredSkills.map((skill) => (
                  <div key={skill.id ?? skill.skill_label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-semibold text-slate-900">
                        <Zap className="h-3 w-3 text-amber-500" />
                        {skill.skill_label}
                      </span>
                      <div className="flex items-center gap-2 text-2xs text-slate-500">
                        {skill.probe_count > 0 && (
                          <span className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">
                            {skill.probe_count} {skill.probe_count !== 1 ? "probes" : "probe"}
                          </span>
                        )}
                        <span className="capitalize font-medium text-slate-700">
                          {COVERAGE_STATE_LABELS[skill.state]}
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={COVERAGE_STATE_WIDTH[skill.state]}
                      indicatorClassName="bg-amber-400"
                      className="h-2 bg-slate-100"
                    />
                    {skill.last_signal && (
                      <p className="text-2xs text-slate-500 truncate italic">
                        "{skill.last_signal}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Live transcript */}
      <Card className="border-slate-200/90 shadow-2xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-sky-600" />
              <CardTitle className="text-sm font-semibold text-slate-900">
                Recent Transcript Turns
              </CardTitle>
            </div>
            <span className="text-2xs text-slate-400">Streamed from candidate dialogue</span>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {transcript.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              Waiting for initial audio exchange...
            </p>
          ) : (
            <div className="space-y-2.5">
              {transcript.map((turn) => (
                <TranscriptBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {endError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>Failed to end session. Please retry or verify backend connection.</span>
        </div>
      )}

      {/* End Session Controls */}
      <div className="flex items-center justify-end pt-2">
        {sessionActive ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={ending}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs shadow-xs"
              >
                <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                {ending ? "Ending Session..." : "End Session Early"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End the interview session now?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will conclude the candidate's interview audio immediately and trigger automated background portfolio generation.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleEndSession}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Confirm End Session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/portfolio`)}
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs shadow-xs"
          >
            Go to Portfolio Results →
          </Button>
        )}
      </div>
    </div>
  );
}
