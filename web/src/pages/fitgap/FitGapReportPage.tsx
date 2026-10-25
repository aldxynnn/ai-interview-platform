import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import type { FitGapReport, Portfolio, Vacancy } from "@/types";

function messageForError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 403) return "You do not have permission to view this report.";
  if (status === 404) return "The report or vacancy could not be found.";
  if (status === 429) return "The service is busy. Please retry in a moment.";
  return "We could not load the report. Check your connection and retry.";
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [generating, setGenerating] = useState(false);
  const [portfolioPending, setPortfolioPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await sessionsApi.getPortfolio(Number(sessionId));
      const payload = response.data as { portfolio?: Portfolio; status?: string };
      if (payload.portfolio) {
        setPortfolio(payload.portfolio);
        const pending = payload.portfolio.generation_status === "pending" || payload.portfolio.generation_status === "generating";
        setPortfolioPending(pending);
        if (!pending) setPageError(null);
      } else {
        setPortfolioPending(payload.status === "generating");
        if (payload.status !== "generating") setPageError("Portfolio results are not available yet.");
      }
    } catch (error) {
      setPortfolioPending(false);
      setPageError(messageForError(error));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchReport = useCallback(async () => {
    if (!portfolio || !vacancyId || portfolioPending || portfolio.generation_status !== "complete") return;
    try {
      const response = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      const next = response.data.report;
      setReport(next);
      const running = next.generation_status === "queued" || next.generation_status === "generating" || next.generation_status === "stale";
      setGenerating(running);
      if (next.generation_status === "failed") {
        setPageError(null);
        setGenerating(false);
      } else {
        setPageError(null);
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        try {
          const response = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setReport(response.data.report);
          setGenerating(true);
          setPageError(null);
        } catch (triggerError) {
          setReport(null);
          setGenerating(false);
          setPageError(messageForError(triggerError));
        }
      } else {
        setReport(null);
        setGenerating(false);
        setPageError(messageForError(error));
      }
    }
  }, [portfolio, portfolioPending, vacancyId]);

  useEffect(() => {
    setLoading(true);
    setPageError(null);
    void fetchPortfolio();
    let cancelled = false;
    if (vacancyId) {
      vacanciesApi.get(Number(vacancyId))
        .then((response) => { if (!cancelled) setVacancy(response.data.vacancy); })
        .catch(() => { /* The report API remains authoritative for access control. */ });
    }
    return () => { cancelled = true; };
  }, [fetchPortfolio, vacancyId]);

  useEffect(() => {
    if (portfolio && !portfolioPending && portfolio.generation_status === "complete") void fetchReport();
  }, [portfolio, portfolioPending, fetchReport]);

  usePolling(fetchPortfolio, 5000, portfolioPending);
  usePolling(fetchReport, 5000, generating && !!portfolio && !portfolioPending);

  const handleRegenerate = async () => {
    if (!portfolio || !vacancyId) return;
    setRegenerating(true);
    setPageError(null);
    try {
      const response = await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(response.data.report);
      setGenerating(true);
    } catch (error) {
      setPageError(messageForError(error));
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || !vacancyId || report?.generation_status !== "complete") return;
    setExporting(format);
    setPageError(null);
    try {
      const response = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob = format === "pdf"
        ? new Blob([response.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "fitgap-" + sessionId + "-" + vacancyId + "." + format;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setPageError(messageForError(error));
    } finally {
      setExporting(null);
    }
  };

  const reportComplete = report?.generation_status === "complete";

  if (loading || portfolioPending) {
    return (
      <div className="mx-auto max-w-5xl space-y-4" aria-busy="true" aria-label="Loading fit/gap report">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <Link to={"/assessments/" + id + "/sessions/" + sessionId + "/portfolio"} className="inline-flex items-center gap-2 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to portfolio
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fit/gap analysis</h1>
            <p className="mt-1 text-sm text-muted-foreground">{vacancy?.role_title ? "Requirements for " + vacancy.role_title : "Candidate skills compared with role requirements"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {portfolio?.generation_status === "complete" && (
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="mr-1.5 h-4 w-4" />}
              Refresh analysis
            </Button>
          )}
          {reportComplete && (
            <>
              <Button variant="outline" size="sm" onClick={() => void handleExport("pdf")} disabled={!!exporting}>
                {exporting === "pdf" ? <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="mr-1.5 h-4 w-4" />}PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleExport("json")} disabled={!!exporting}>
                {exporting === "json" ? <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="mr-1.5 h-4 w-4" />}JSON
              </Button>
            </>
          )}
        </div>
      </header>

      {pageError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1"><p className="font-medium">{pageError}</p><p className="mt-1 text-muted-foreground">No new result is shown as complete until the API confirms it.</p></div>
          <Button variant="outline" size="sm" onClick={() => void fetchReport()}>Retry</Button>
        </div>
      )}

      {generating && (
        <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-lg border bg-muted/20 p-5">
          <Loader2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
          <div><p className="font-medium">Generating fit/gap report</p><p className="mt-1 text-sm text-muted-foreground">The previous report remains stored. This view updates when the new result is ready.</p></div>
        </div>
      )}

      {portfolio?.generation_status === "failed" && (
        <div role="alert" className="rounded-lg border border-destructive/40 p-5">
          <p className="font-medium">Portfolio generation failed</p>
          <p className="mt-1 text-sm text-muted-foreground">Fit/gap cannot run until a valid portfolio is available. Return to portfolio results to retry generation.</p>
          <Link className="mt-3 inline-flex text-sm font-medium underline underline-offset-4" to={"/assessments/" + id + "/sessions/" + sessionId + "/portfolio"}>Open portfolio results</Link>
        </div>
      )}

      {report?.generation_status === "failed" && (
        <div role="alert" className="rounded-lg border border-destructive/40 p-5">
          <p className="font-medium">Report generation failed</p>
          <p className="mt-1 text-sm text-muted-foreground">{report.generation_error || "The report could not be generated."} No hiring recommendation has been produced.</p>
          <Button className="mt-3" variant="outline" onClick={() => void handleRegenerate()} disabled={regenerating}><RefreshCw aria-hidden="true" className="mr-1.5 h-4 w-4" />Retry generation</Button>
        </div>
      )}

      {!report && !generating && !pageError && portfolio?.generation_status === "complete" && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No report available</p>
          <p className="mt-1 text-sm text-muted-foreground">Run the analysis to compare this candidate against the vacancy.</p>
          <Button className="mt-4" onClick={() => void fetchReport()}>Generate report</Button>
        </div>
      )}

      {report && !reportComplete && (report.skill_comparisons?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Previous results — not current</CardTitle>
            <p className="text-sm text-muted-foreground">
              This is the last saved comparison, retained while the current report is {report.generation_status}. Do not use it as a current assessment of the vacancy requirements.
            </p>
            {report.generated_at && <p className="text-xs text-muted-foreground">Last successful generation: {new Date(report.generated_at).toLocaleString()}</p>}
          </CardHeader>
          <CardContent><ComparisonTable comparisons={report.skill_comparisons} /></CardContent>
        </Card>
      )}

      {reportComplete && report && (
        <>
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p className="font-medium">Decision support, not an automated hiring decision</p>
            <p className="mt-1 text-muted-foreground">Review the evidence, confidence, and assessor overrides. Skills marked not assessed are unknown, not evidence of a skill gap.</p>
            {report.generated_at && <p className="mt-2 text-xs text-muted-foreground">Last generated: {new Date(report.generated_at).toLocaleString()}</p>}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Skill comparison</CardTitle><p className="text-sm text-muted-foreground">Each assessed level is compared with the stated vacancy requirement.</p></CardHeader>
            <CardContent><ComparisonTable comparisons={report.skill_comparisons ?? []} /></CardContent>
          </Card>
          {(report.culture_narrative || report.overall_narrative) && (
            <Card>
              <CardHeader><CardTitle className="text-base">AI-generated summaries</CardTitle><p className="text-sm text-muted-foreground">Summaries are based on the structured comparison and require human review.</p></CardHeader>
              <CardContent className="space-y-4">
                {report.culture_narrative && <section className="space-y-1.5"><h2 className="text-sm font-semibold">Culture and competency context</h2><p className="break-words whitespace-pre-wrap text-sm leading-6">{report.culture_narrative}</p></section>}
                {report.culture_narrative && report.overall_narrative && <Separator />}
                {report.overall_narrative && <section className="space-y-1.5"><h2 className="text-sm font-semibold">Overall evidence summary</h2><p className="break-words whitespace-pre-wrap text-sm leading-6">{report.overall_narrative}</p></section>}
              </CardContent>
            </Card>
          )}
          {portfolio?.skills?.some((skill) => skill.is_discovered) && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Zap aria-hidden="true" className="h-4 w-4 text-amber-600" />Additional skills discovered</CardTitle><p className="text-sm text-muted-foreground">These skills were not included in the selected vacancy requirements.</p></CardHeader>
              <CardContent className="divide-y">
                {portfolio.skills.filter((skill) => skill.is_discovered).map((skill) => (
                  <div key={skill.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{skill.skill_label}</p>
                      <p className="text-sm text-muted-foreground">{typeof skill.ai_level === "number" ? "L" + skill.ai_level : skill.ai_level} · {skill.ai_confidence} confidence</p>
                    </div>
                    {skill.competency_summary && <p className="mt-1 text-sm leading-6 text-muted-foreground">{skill.competency_summary}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
