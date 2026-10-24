import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { AlertCircle, ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!portfolio || !vacancyId || !Number.isFinite(Number(vacancyId))) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setPageError(null);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        // A poll may see 404 while the background job is still running. Trigger only
        // once; repeatedly enqueueing on every poll creates duplicate Sidekiq jobs.
        if (generating) return;
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
          setPageError(null);
        } catch {
          setGenerating(false);
          setPageError("Fit/gap report belum tersedia dan gagal dimulai. Coba lagi.");
        }
      } else {
        setGenerating(false);
        setPageError("Tidak dapat memuat fit/gap report. Periksa koneksi lalu coba lagi.");
      }
    }
  }, [portfolio, vacancyId, generating]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPageError(null);
    sessionsApi.getPortfolio(Number(sessionId))
      .then((res) => {
        if (!active) return;
        const data = res.data as { portfolio?: Portfolio; status?: string; error?: string };
        if (data.portfolio) {
          setPortfolio(data.portfolio);
          if (data.portfolio.generation_status === "failed") {
            setPageError("Portfolio gagal dibuat. Periksa status sesi sebelum membuat fit/gap report.");
          }
        } else if (data.status === "generating") {
          setPageError("Portfolio masih diproses. Tunggu sebentar lalu muat ulang halaman.");
        } else {
          setPageError("Data portfolio tidak ditemukan untuk sesi ini.");
        }
      })
      .catch(() => {
        if (active) setPageError("Gagal memuat portfolio. Periksa koneksi lalu coba lagi.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId]);

  useEffect(() => {
    if (portfolio && portfolio.generation_status === "complete") fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio || regenerating || generating) return;
    setRegenerating(true);
    setPageError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch {
      setPageError("Gagal meminta pembuatan ulang laporan. Coba lagi.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || exporting) return;
    setExporting(format);
    setPageError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob = format === "pdf"
        ? new Blob([res.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setPageError(`Gagal mengunduh laporan ${format.toUpperCase()}. Coba lagi.`);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return <div className="max-w-2xl mx-auto space-y-4 px-4" aria-live="polite"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`} className="text-muted-foreground hover:text-foreground" aria-label="Kembali ke portfolio">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
          </div>
          <p className="text-sm text-muted-foreground">Perbandingan kebutuhan role dengan bukti skill yang tersedia.</p>
        </div>
        {portfolio && <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />} Regenerate
          </Button>
          {report && <>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>{exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />} PDF</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>{exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />} JSON</Button>
          </>}
        </div>}
      </div>

      {pageError && <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
        <p>{pageError}</p>
        <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => window.location.reload()}>Coba lagi</Button>
      </div>}

      {generating && <div role="status" aria-live="polite" className="border rounded-lg p-12 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Generating fit/gap report...</p>
        <p className="text-xs text-muted-foreground">Skill yang belum dinilai akan ditampilkan sebagai “Not assessed”, bukan otomatis dianggap gap.</p>
      </div>}

      {report && <>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Skill Comparison</CardTitle></CardHeader><CardContent className="px-4 pb-4"><ComparisonTable comparisons={report.skill_comparisons} /></CardContent></Card>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium">Catatan interpretasi</p>
          <p className="mt-1 text-muted-foreground">“Not assessed” berarti belum ada penilaian yang cukup. Status ini bukan bukti kandidat tidak mampu. Gunakan perbandingan bersama evidence wawancara dan tinjauan assessor, bukan sebagai keputusan hiring otomatis.</p>
        </div>
        <Separator />
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle></CardHeader><CardContent className="px-4 pb-4 space-y-3">
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">{report.culture_narrative || "Narrative culture belum tersedia."}</p>
          {report.overall_narrative && <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">{report.overall_narrative}</p>}
        </CardContent></Card>
        {portfolio && portfolio.skills.some((skill) => skill.is_discovered) && <>
          <Separator />
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" />Discovered Skills (not in vacancy requirements)</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">{portfolio.skills.filter((skill) => skill.is_discovered).map((skill) => <div key={skill.id} className="text-sm flex flex-wrap items-center gap-2">
            <span className="font-medium">{skill.skill_label}</span><span className="text-muted-foreground">{skill.ai_level} ({skill.ai_confidence?.toLowerCase() === "low" ? "low confidence" : skill.ai_confidence})</span>
            <span className="text-xs text-muted-foreground">— Skill tambahan; bukan persyaratan role ini.</span>
          </div>)}</CardContent></Card>
        </>}
        <p className="text-xs text-muted-foreground">Dibuat: {report.generated_at ? new Date(report.generated_at).toLocaleString() : "Tidak tersedia"}</p>
      </>}

      {!generating && !report && !pageError && <div className="rounded-lg border p-8 text-center space-y-3">
        <p className="font-medium">Fit/gap report belum tersedia.</p><p className="text-sm text-muted-foreground">Coba buat ulang laporan atau periksa status portfolio.</p>
        <Button onClick={handleRegenerate} disabled={!portfolio || regenerating}>{regenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Coba generate ulang</Button>
      </div>}
    </div>
  );
}
