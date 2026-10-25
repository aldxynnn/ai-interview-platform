import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import VacancyPdfImportCard from "@/components/vacancies/VacancyPdfImportCard";
import { useNavigate } from "react-router-dom";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, Portfolio, Vacancy } from "@/types";

export default function FitGapReportPage() {
  const navigate = useNavigate();
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [importedVacancy, setImportedVacancy] = useState<Vacancy | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      const nextReport = res.data.report;
      setReport(nextReport);
      setGenerating(nextReport.generation_status === "generating" || nextReport.generation_status === "pending");
      setPageError(nextReport.generation_status === "failed" ? (nextReport.generation_error || "Report generation failed. You can retry.") : null);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
          setPageError(null);
        } catch {
          setGenerating(false);
          setPageError("We could not start report generation. Check your connection and retry.");
        }
      } else {
        setGenerating(false);
        setPageError("We could not load this report. Check your connection and retry.");
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
      })
      .catch(() => setPageError("Could not load the portfolio context. Check your connection and retry."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setPageError(null);
      setGenerating(true);
    } catch {
      setPageError("Regeneration could not be started. Your previous report is still available.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      setPageError(null);
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const ext = format;
      const blob = format === "pdf"
        ? new Blob([res.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setPageError("Export failed. Please retry.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
          </div>
        </div>

        {portfolio && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
            {report && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                  {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <VacancyPdfImportCard compact onImported={setImportedVacancy} />
      {importedVacancy && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Periksa hasil ekstraksi sebelum analisis</CardTitle>
            <p className="text-sm text-muted-foreground">AI membuat draf lowongan. Pastikan jabatan, skill, dan level sesuai dokumen sebelum menjalankan perbandingan.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold">{importedVacancy.role_title}</p>
              {importedVacancy.competency_expectations && <p className="text-sm text-muted-foreground mt-1">{importedVacancy.competency_expectations}</p>}
            </div>
            <div className="space-y-2">
              {(importedVacancy.skills || []).map((skill, index) => (
                <div key={skill.id ?? `${skill.skill_label}-${index}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <span>{skill.skill_label}</span><span className="text-muted-foreground shrink-0">Required L{skill.expected_level}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Draf tersimpan sebagai lowongan baru. Kamu bisa mengedit detailnya di menu Vacancies.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${importedVacancy.id}`)}>Gunakan untuk Fit/Gap</Button>
              <Button variant="outline" onClick={() => navigate(`/vacancies/${importedVacancy.id}/edit`)}>Edit lowongan</Button>
              <Button variant="ghost" onClick={() => setImportedVacancy(null)}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pageError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm text-destructive">{pageError}</p>
          <Button variant="outline" size="sm" onClick={() => { if (report) void handleRegenerate(); else { setPageError(null); void fetchReport(); } }} disabled={regenerating}>Retry</Button>
        </div>
      )}

      {/* Generating */}
      {generating && (
        <div className="border rounded-lg p-5 text-center space-y-2" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">{report?.generation_status === "generating" ? "Refreshing report. The previous result remains available." : "Generating fit/gap report..."}</p>
        </div>
      )}

      {/* Report ready */}
      {report && (
        <>
          {/* Skill comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          {/* Culture & competency */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {report.culture_narrative || report.overall_narrative}
              </p>
            </CardContent>
          </Card>

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills (not in vacancy requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div key={s.id} className="text-sm flex items-center gap-2">
                        <span className="font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                        </span>
                        <span className="text-xs text-muted-foreground">— Not required for this role, may be additive.</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
