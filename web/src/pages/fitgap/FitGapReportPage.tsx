import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft, Download, Loader2, RefreshCw, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Clock3, Sparkles
} from "lucide-react";
import type { FitGapReport, Portfolio, FitGapGenerationStatus } from "@/types";

type ApiReportResponse = {
  status?: FitGapGenerationStatus;
  report?: FitGapReport;
  message?: string;
  error?: string;
};

function safeApiMessage(error: any, fallback: string) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return "Your session may have expired or you do not have permission to view this report. Please sign in again or contact your administrator.";
  if (status === 404) return "The portfolio, vacancy, or report could not be found for this workspace.";
  if (status === 503) return "Report generation is temporarily unavailable. You can retry without losing the assessment data.";
  if (status >= 500) return "The server could not complete this request. Please retry in a moment.";
  return fallback;
}

function StatusPanel({ status }: { status: FitGapGenerationStatus }) {
  const failed = status === "failed";
  const title = failed ? "Report generation failed" : status === "pending" ? "Waiting to generate report" : "Generating fit/gap report";
  const description = failed
    ? "The assessment data remains saved. Retry generation to rebuild this report."
    : status === "pending"
      ? "The report is queued. This page will update automatically when processing begins."
      : "Skill levels are calculated deterministically; the narrative is generated separately. This page will refresh automatically.";
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${failed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
        {failed ? <XCircle className="h-6 w-6" /> : status === "pending" ? <Clock3 className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const requestStarted = useRef(false);

  const applyReportResponse = useCallback((data: ApiReportResponse) => {
    const nextReport = data.report ?? null;
    if (nextReport) setReport(nextReport);
    const status = nextReport?.generation_status ?? data.status;
    if (status === "pending" || status === "generating") {
      setGenerating(true);
    } else if (status === "complete" || status === "failed") {
      setGenerating(false);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    if (!portfolio || !vacancyId) return;

    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      applyReportResponse(res.data as ApiReportResponse);
      setPageError(null);
      setActionError(null);
    } catch (error: any) {
      if (error?.response?.status === 404 && !requestStarted.current) {
        // Trigger only once per portfolio/vacancy pair. The backend is idempotent too.
        requestStarted.current = true;
        try {
          const response = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          applyReportResponse(response.data as ApiReportResponse);
          setPageError(null);
          setActionError(null);
        } catch (triggerError: any) {
          applyReportResponse(triggerError?.response?.data as ApiReportResponse ?? {});
          setGenerating(false);
          setActionError(safeApiMessage(triggerError, "Could not start fit/gap generation."));
        }
      } else {
        setPageError(safeApiMessage(error, "Could not load the fit/gap report."));
      }
    }
  }, [portfolio, vacancyId, applyReportResponse]);

  useEffect(() => {
    let cancelled = false;
    requestStarted.current = false;
    setLoading(true);
    setReport(null);
    setPortfolio(null);
    setPageError(null);
    setActionError(null);
    setGenerating(false);

    sessionsApi.getPortfolio(Number(sessionId))
      .then((response) => {
        if (cancelled) return;
        const data = response.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio as Portfolio);
          const status = data.portfolio.generation_status;
          setGenerating(status === "pending" || status === "generating");
        } else if (data.status === "pending" || data.status === "generating") {
          setGenerating(true);
        } else {
          setPageError("No completed portfolio was found for this session.");
        }
      })
      .catch((error) => {
        if (!cancelled) setPageError(safeApiMessage(error, "Could not load the candidate portfolio."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    if (portfolio && !loading) void fetchReport();
  }, [portfolio, loading, fetchReport]);

  usePolling(fetchReport, 4000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio || !vacancyId) return;
    setRegenerating(true);
    setActionError(null);
    requestStarted.current = true;
    try {
      const response = await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      applyReportResponse(response.data as ApiReportResponse);
      if ((response.data as ApiReportResponse).status === "pending" || (response.data as ApiReportResponse).status === "generating") {
        setGenerating(true);
      }
      setPageError(null);
    } catch (error: any) {
      setActionError(safeApiMessage(error, "Could not regenerate the report. Your existing assessment remains unchanged."));
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || !vacancyId) return;
    setExporting(format);
    setActionError(null);
    try {
      const response = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob = format === "pdf"
        ? new Blob([response.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error: any) {
      setActionError(safeApiMessage(error, `Could not export the report as ${format.toUpperCase()}.`));
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-1">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const comparisons = report?.skill_comparisons ?? [];
  const status = report?.generation_status;
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-1 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            aria-label="Back to portfolio"
            className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Candidate assessment</p>
            <h1 className="text-2xl font-semibold tracking-tight">Fit / Gap Report</h1>
            <p className="text-sm text-muted-foreground">Compare assessed skill levels against this role's requirements.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating || !portfolio || status === "pending"}>
            {regenerating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Retry / regenerate
          </Button>
          {report?.generation_status === "complete" && (
            <>
              <Button variant="outline" size="sm" onClick={() => void handleExport("pdf")} disabled={!!exporting}>
                {exporting === "pdf" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleExport("json")} disabled={!!exporting}>
                {exporting === "json" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {pageError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1"><p className="font-medium">Unable to show the report</p><p className="mt-1 text-muted-foreground">{pageError}</p></div>
          <Button size="sm" variant="outline" onClick={() => void fetchReport()}>Retry</Button>
        </div>
      )}
      {actionError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{actionError}</div>}

      {generating && <StatusPanel status={status === "pending" ? "pending" : "generating"} />}

      {status === "failed" && (
        <StatusPanel status="failed" />
      )}

      {report && status === "complete" && (
        <>
          <div className="rounded-2xl border bg-gradient-to-br from-primary/[0.06] to-transparent p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Report generated
                </div>
                <h2 className="mt-2 text-lg font-semibold">Skill requirements at a glance</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  This report supports structured review. It is not an automated hiring decision, and every gap or unassessed skill should be considered alongside the underlying evidence.
                </p>
              </div>
              {report.generated_at && <p className="shrink-0 text-xs text-muted-foreground">Updated {new Date(report.generated_at).toLocaleString()}</p>}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Matches", count: matchCount, icon: CheckCircle2, className: "text-emerald-700 bg-emerald-500/10" },
                { label: "Skill gaps", count: gapCount, icon: AlertTriangle, className: "text-amber-700 bg-amber-500/10" },
                { label: "Above required", count: exceedCount, icon: Sparkles, className: "text-blue-700 bg-blue-500/10" },
                { label: "Not assessed", count: notAssessedCount, icon: Clock3, className: "text-muted-foreground bg-muted" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border bg-background/80 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.className}`}><Icon className="h-4 w-4" /></span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">{item.count}</p>
                    <p className="text-xs text-muted-foreground">of {comparisons.length} required skills</p>
                  </div>
                );
              })}
            </div>
          </div>

          <Card className="overflow-hidden rounded-2xl">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-base">Skill-by-skill comparison</CardTitle>
              <p className="text-sm text-muted-foreground">Required level is taken from the vacancy. Assessed level reflects assessor overrides when available.</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6"><ComparisonTable comparisons={comparisons} /></CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Culture & competency context</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{report.culture_narrative || "No narrative was produced for the culture and competency expectations. Review the role context and underlying evidence manually."}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Overall review notes</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{report.overall_narrative || "No overall narrative was produced. Review individual skill comparisons and source evidence before reaching a conclusion."}</p>
              </CardContent>
            </Card>
          </div>

          {portfolio && portfolio.skills.some((skill) => skill.is_discovered) && (
            <Card className="rounded-2xl">
              <CardHeader className="pb-3"><CardTitle className="text-base">Additional skills detected</CardTitle><p className="text-sm text-muted-foreground">These skills were detected during the interview but are not part of this vacancy's configured requirements.</p></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {portfolio.skills.filter((skill) => skill.is_discovered).map((skill) => (
                  <div key={skill.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3"><p className="font-medium">{skill.skill_label}</p><span className="rounded-md bg-muted px-2 py-1 text-xs">{skill.ai_level}</span></div>
                    <p className="mt-2 text-xs text-muted-foreground">AI confidence: {skill.ai_confidence?.toLowerCase() || "not provided"}. This signal is additive context, not a substitute for vacancy requirements.</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <div className="flex items-start gap-3 rounded-xl border p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p><strong className="text-foreground">Human review required.</strong> A missing assessment is not a demonstrated skill gap. The report is a decision-support tool; verify the evidence, consider uncertainty and accessibility context, and avoid using one summary as the sole basis for a hiring decision.</p>
          </div>
        </>
      )}

      {!pageError && !generating && !report && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <h2 className="font-semibold">No report available yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">The report may not have been generated or could not be retrieved. Start generation again or return to the portfolio to check the assessment status.</p>
          <Button className="mt-4" onClick={() => void fetchReport()} disabled={!portfolio}>Try again</Button>
        </div>
      )}
    </div>
  );
}
