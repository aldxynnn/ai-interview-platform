import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Users,
  Zap,
} from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

// Shape returned by show_fitgap when report is not yet ready
interface PendingStatus {
  status: "not_started" | "generating";
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pollTimeout, setPollTimeout] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // Track whether we have already triggered a generation POST to prevent
  // duplicate jobs from polling. Once triggered=true, polling only calls
  // GET show_fitgap and never calls POST fitgap again.
  const triggeredRef = useRef(false);
  // Polling attempts counter to guard against infinite spinner (timeout failure path)
  const pollCountRef = useRef(0);

  // Poll GET show_fitgap. Returns report when ready, or { status } when pending.
  const pollForReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      const body = res.data as { report?: FitGapReport } & PendingStatus;

      if (body.report) {
        setReport(body.report);
        setGenerating(false);
        setPollTimeout(false);
        pollCountRef.current = 0;
        triggeredRef.current = false; // allow future re-generate
        return;
      }

      // Check max polling attempts (15 polls * 5s = 75 seconds timeout)
      pollCountRef.current += 1;
      if (pollCountRef.current > 15) {
        setGenerating(false);
        setPollTimeout(true);
        triggeredRef.current = false;
        return;
      }

      // Backend returned { status: "not_started" | "generating" }
      if (body.status === "not_started" && !triggeredRef.current) {
        // First time we learn there is no report — trigger generation once.
        triggeredRef.current = true;
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
        } catch {
          // POST failed (portfolio not ready, etc.) — stop generating state
          setGenerating(false);
          triggeredRef.current = false;
          return;
        }
        setGenerating(true);
      } else if (body.status === "generating") {
        // Backend already has a job in flight (e.g. from a previous page visit).
        // Activate the spinner so the user sees progress feedback.
        setGenerating(true);
      }
    } catch (e: any) {
      // Unexpected error (network, 5xx, auth) — stop spinner, show nothing
      setGenerating(false);
    }
  }, [portfolio, vacancyId]);

  // Load portfolio on mount
  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        } else {
          setLoadError("Portfolio belum tersedia untuk sesi ini.");
        }
      })
      .catch(() => setLoadError("Gagal memuat data portfolio."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Fetch report once portfolio is loaded
  useEffect(() => {
    if (portfolio) pollForReport();
  }, [portfolio, pollForReport]);

  // Keep polling while generating
  usePolling(pollForReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setPollTimeout(false);
    pollCountRef.current = 0;
    triggeredRef.current = false;
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      triggeredRef.current = true;
      setGenerating(true);
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        Number(vacancyId)
      );
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], {
              type: "application/json",
            });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  // ── Skeleton loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // ── Portfolio load error ──────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Kembali ke portfolio"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">
              Laporan Fit/Gap
            </h1>
          </div>
          {report && (
            <p className="text-xs text-muted-foreground pl-6">
              Dibuat{" "}
              {new Date(report.generated_at).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>

        {portfolio && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
              aria-label="Regenerasi laporan"
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Regenerasi
            </Button>
            {report && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                  aria-label="Unduh PDF"
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                  aria-label="Unduh JSON"
                >
                  {exporting === "json" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Generating state ──────────────────────────────────────────────── */}
      {generating && (
        <div className="rounded-lg border bg-muted/30 p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium">Sedang menganalisis fit/gap…</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Model AI sedang membandingkan portfolio kandidat dengan kebutuhan
            jabatan. Proses ini memakan waktu 10–30 detik.
          </p>
        </div>
      )}

      {/* ── Polling timeout state ────────────────────────────────────────── */}
      {pollTimeout && !report && !generating && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-amber-600 mx-auto" />
          <p className="text-sm font-medium text-amber-900">
            Analisis memakan waktu lebih lama dari biasanya
          </p>
          <p className="text-xs text-amber-700 max-w-md mx-auto">
            Proses pembuatan laporan Fit/Gap belum selesai setelah 75 detik.
            Pekerjaan mungkin masih berjalan di antrean latar belakang atau mengalami kendala model AI.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            className="border-amber-300 text-amber-900 hover:bg-amber-100"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Coba Regenerasi Ulang
          </Button>
        </div>
      )}

      {/* ── Report ready ─────────────────────────────────────────────────── */}
      {report && !generating && (
        <>
          {/* Skill comparison table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Perbandingan Kompetensi</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Level AI dapat dikalibrasi oleh assessor. Skill dengan level
                yang dikalibrasi ditandai{" "}
                <span className="font-medium text-blue-600">✏ dikalibrasi</span>
                .
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {/* Culture narrative */}
          {report.culture_narrative && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-violet-500" />
                    Kesesuaian Budaya &amp; Kompetensi
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {report.culture_narrative}
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Overall / recruitment narrative */}
          {report.overall_narrative && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Rekomendasi Rekrutmen
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {report.overall_narrative}
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Fallback: show at least one narrative section */}
          {!report.culture_narrative && !report.overall_narrative && (
            <>
              <Separator />
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Narasi kesesuaian belum tersedia dalam laporan ini.
              </div>
            </>
          )}

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Skill Tambahan (di luar persyaratan jabatan)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Skill yang muncul organik dari wawancara, tidak dicantumkan
                    dalam vacancy.
                  </p>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="text-sm flex items-center gap-2 py-1"
                      >
                        <span className="font-medium min-w-0 truncate">
                          {s.skill_label}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-mono shrink-0 ${
                            s.ai_confidence?.toLowerCase() === "low"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          L{s.ai_level}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {s.ai_confidence?.toLowerCase() === "low"
                            ? "kepercayaan rendah"
                            : "terkonfirmasi"}
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* ── Empty state: no report and not generating ─────────────────────── */}
      {!report && !generating && !loading && !pollTimeout && (
        <div className="rounded-lg border bg-muted/20 p-12 text-center space-y-3">
          <p className="text-sm font-medium">Laporan belum tersedia</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Klik <span className="font-semibold">Regenerasi</span> untuk
            memulai analisis fit/gap antara portfolio kandidat dan persyaratan
            jabatan ini.
          </p>
        </div>
      )}
    </div>
  );
}
