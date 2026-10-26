import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionsApi } from "@/services/sessions";
import {
  ArrowLeft,
  Download,
  Search,
  Bot,
  User,
  Copy,
  Check,
  MessageSquare,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { TranscriptTurn } from "@/types";

export default function TranscriptPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      sessionsApi.getTranscript(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([tRes, sRes]) => {
        setTurns(tRes.data.turns || []);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const filteredTurns = useMemo(() => {
    if (!searchQuery.trim()) return turns;
    const q = searchQuery.toLowerCase();
    return turns.filter((t) => t.text.toLowerCase().includes(q));
  }, [turns, searchQuery]);

  const stats = useMemo(() => {
    const aiTurns = turns.filter((t) => t.speaker === "ai").length;
    const candidateTurns = turns.filter((t) => t.speaker !== "ai").length;
    const totalWords = turns.reduce(
      (sum, t) => sum + (t.text ? t.text.split(/\s+/).filter(Boolean).length : 0),
      0
    );
    return { aiTurns, candidateTurns, totalWords };
  }, [turns]);

  const handleDownload = () => {
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI Interviewer" : candidateName || "Candidate";
      return `[${label} - Turn ${t.turn_number}]\n${t.text}`;
    });
    const header = `=== Rakamin AI Interview Transcript ===\nCandidate: ${
      candidateName || "Anonymous"
    }\nSession ID: ${sessionId}\nTotal Turns: ${turns.length}\nDate: ${new Date().toISOString()}\n\n`;
    const blob = new Blob([header + lines.join("\n\n---\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyTurnText = (turnId: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(turnId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Candidate Portfolio
          </Link>
          <div className="flex items-center gap-2 pt-0.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Interview Transcript</h1>
            <Badge variant="outline" className="text-2xs text-slate-600 bg-white border-slate-200">
              Session #{sessionId}
            </Badge>
          </div>
          {candidateName && (
            <p className="text-xs text-slate-500">
              Candidate: <span className="font-semibold text-slate-800">{candidateName}</span>
            </p>
          )}
        </div>

        {!loading && !error && turns.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="shrink-0 bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
            Download Text Transcript
          </Button>
        )}
      </div>

      {/* Stats Summary Strip */}
      {!loading && !error && turns.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center shadow-2xs">
            <p className="text-xs text-slate-400">Total Dialogue Turns</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{turns.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center shadow-2xs">
            <p className="text-xs text-slate-400">AI Probes / Qs</p>
            <p className="text-lg font-bold text-sky-600 mt-0.5">{stats.aiTurns}</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center shadow-2xs">
            <p className="text-xs text-slate-400">Candidate Answers</p>
            <p className="text-lg font-bold text-emerald-600 mt-0.5">{stats.candidateTurns}</p>
          </div>
        </div>
      )}

      {/* Search Input */}
      {!loading && !error && turns.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search dialogue text for keywords (e.g. skills, metrics, architecture)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-slate-200/90 shadow-2xs text-xs"
          />
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-6 text-center space-y-2">
          <AlertCircle className="h-7 w-7 text-rose-600 mx-auto" />
          <p className="text-sm font-semibold text-rose-900">Failed to load interview transcript</p>
          <p className="text-xs text-rose-700">Please check your network and try refreshing the page.</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && turns.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <MessageSquare className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-800">No transcript available</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            This interview session does not contain recorded turns yet or was ended before interaction began.
          </p>
        </div>
      )}

      {/* Search empty */}
      {!loading && !error && turns.length > 0 && filteredTurns.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No dialogue turns found containing "{searchQuery}".
        </div>
      )}

      {/* Turns Timeline */}
      {!loading && !error && filteredTurns.length > 0 && (
        <div className="space-y-3.5">
          {filteredTurns.map((turn) => {
            const isAI = turn.speaker === "ai";
            return (
              <div
                key={turn.id}
                className={`group relative rounded-xl border p-4 transition-all ${
                  isAI
                    ? "border-sky-200/80 bg-gradient-to-br from-sky-50/50 via-white to-sky-50/20 text-slate-900"
                    : "border-slate-200/90 bg-white text-slate-900 shadow-2xs hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
                        isAI ? "bg-sky-600 text-white" : "bg-emerald-600 text-white"
                      }`}
                    >
                      {isAI ? <Sparkles className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        isAI ? "text-sky-950" : "text-emerald-950"
                      }`}
                    >
                      {isAI ? "AI Interviewer" : candidateName || "Candidate"}
                    </span>
                    <span className="text-2xs text-slate-400 font-medium">
                      Turn #{turn.turn_number}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyTurnText(turn.id, turn.text)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    title="Copy dialogue snippet"
                  >
                    {copiedId === turn.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-700 pl-8">
                  {turn.text}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
