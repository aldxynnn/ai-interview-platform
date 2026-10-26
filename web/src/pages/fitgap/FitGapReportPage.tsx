import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, CheckCircle2, Download, Loader2, RefreshCw,
  ShieldAlert, Sparkles, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import type { FitGapReport, Portfolio } from "@/types";

function isReportRunning(report: FitGapReport | null) {
  return report?.generation_status === "queued" ||
    report?.generation_status === "generating" ||
    report?.generation_status === "stale";
}

function getErrorMessage(error: unknown, fallback: string) {
  const candidate = error as { response?: { data?: { errors?: Array<{ message?: string }> } } };
  return candidate?.response?.data?.errors?.[0]?.message || fallback;
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);

  const portfolioReady = portfolio?.generation_status === "complete";
  const generating = isReportRunning(report);
  const hasSavedComparison = Boolean(report?.generated_at && report.skill_comparisons);

  useEffect(() => {
    let cancelled = false;
    async function loadPortfolio() {
      setLoading(true);
      setPageError(null);
      try {
        const response = await sessionsApi.getPortfolio(Number(sessionId));
        const data = response.data as { portfolio?: Portfolio; status?: string };
        if (!data.portfolio) {
          throw new Error(data.status === "generating"
            ? "The candidate portfolio is still being generated."
            : "The candidate portfolio is not available.");
        }
        if (!cancelled) setPortfolio(data.portfolio);
      } catch (error) {
        if (!cancelled) setPageError(getErrorMessage(error, "Could not load the candidate portfolio. Please retry."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPortfolio();
    return () => { cancelled = true; };
  }, [sessionId]);

  const requestReport = useCallback(async () => {
    if (!portfolio) return;
    setRequesting(true);
    setReportError(null);
    try {
      const response = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
      setReport(response.data.report);
      setPageError(null);
    } catch (error) {
      setReportError(getErrorMessage(error, "The fit/gap report could not be requested."));
    } finally {
      setRequesting(false);
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    if (!portfolioReady || !portfolio) return;
    let cancelled = false;

    async function loadOrCreateReport() {
      setRequesting(true);
      setReportError(null);
      try {
        const response = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
        if (!cancelled) setReport(response.data.report);
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          try {
            const response = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
            if (!cancelled) setReport(response.data.report);
          } catch (requestError) {
            if (!cancelled) setReportError(getErrorMessage(requestError, "The fit/gap report could not be generated."));
          }
        } else if (!cancelled) {
          setReportError(getErrorMessage(error, "Could not load the fit/gap report."));
        }
      } finally {
        if (!cancelled) setRequesting(false);
      }
    }

    loadOrCreateReport();
    return () => { cancelled = true; };
  }, [portfolioReady, portfolio, vacancyId]);

  const pollReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const response = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(response.data.report);
      setReportError(null);
    } catch (error) {
      setReportError(getErrorMessage(error, "The report status could not be refreshed. Retrying automatically."));
    }
  }, [portfolio, vacancyId]);

  usePolling(pollReport, 4000, generating && Boolean(portfolio));

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setReportError(null);
    try {
      const response = await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(response.data.report);
    } catch (error) {
      setReportError(getErrorMessage(error, "Regeneration could not be started. Your saved report has not been removed."));
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || report?.generation_status !== "complete") return;
    setExporting(format);
    setReportError(null);
    try {
      const response = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob = format === "pdf"
        ? new Blob([response.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setReportError(getErrorMessage(error, `The ${format.toUpperCase()} export failed. Please retry.`));
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (pageError || !portfolio) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to portfolio
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <h1 className="font-semibold">Portfolio unavailable</h1>
            <p className="max-w-md text-sm text-muted-foreground">{pageError || "The candidate portfolio could not be loaded."}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Retry loading</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!portfolioReady) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to portfolio
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            {portfolio.generation_status === "failed"
              ? <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
              : <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />}
            <h1 className="font-semibold">{portfolio.generation_status === "failed" ? "Portfolio generation failed" : "Portfolio is still generating"}</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              {portfolio.generation_status === "failed"
                ? "Fit/gap analysis needs a completed portfolio. Retry portfolio generation from the portfolio page."
                : "The comparison will be available when the candidate portfolio is complete."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to candidate portfolio
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Decision support</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Fit/gap analysis</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Compare the candidate's documented evidence with the requirements for this role.
              Review the source evidence before making a hiring decision.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating || requesting}>
            {regenerating || generating
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            Refresh analysis
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={report?.generation_status !== "complete" || Boolean(exporting)}>
            {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={report?.generation_status !== "complete" || Boolean(exporting)}>
            {exporting === "json" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            Export JSON
          </Button>
        </div>
      </div>

      {reportError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">There is a problem with the report</p>
            <p className="mt-1 text-muted-foreground">{reportError}</p>
          </div>
          {!report && <Button size="sm" variant="outline" onClick={requestReport} disabled={requesting}>Retry</Button>}
        </div>
      )}

      {requesting && !report && (
        <div role="status" className="flex items-center gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Requesting the first report...
        </div>
      )}

      {!report && !requesting && !reportError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Sparkles className="h-8 w-8 text-primary" aria-hidden="true" />
            <h2 className="font-semibold">No report yet</h2>
            <p className="max-w-md text-sm text-muted-foreground">Start an analysis to compare vacancy requirements with the evidence saved in this portfolio.</p>
            <Button onClick={requestReport} disabled={requesting}>{requesting ? "Requesting..." : "Generate fit/gap report"}</Button>
          </CardContent>
        </Card>
      )}

      {report && generating && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">{hasSavedComparison ? "Refreshing analysis" : "Generating fit/gap report"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasSavedComparison
                ? "The last saved comparison remains available while the newer version is prepared."
                : "Structured comparison is calculated from saved skill levels; the AI narrative is generated separately."}
            </p>
          </div>
        </div>
      )}

      {report?.generation_status === "failed" && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Latest refresh failed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.generation_error || "The saved report was not replaced. Retry to request a new version."}
                {hasSavedComparison ? " The previous saved comparison is still shown below." : ""}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={regenerating}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry generation
          </Button>
        </div>
      )}

      {report && report.generation_status === "complete" && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span>Report ready</span>
          {report.generated_at && <span>· Last generated {new Date(report.generated_at).toLocaleString()}</span>}
        </div>
      )}

      {report && report.skill_comparisons.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Skill comparison</CardTitle>
            <p className="text-sm text-muted-foreground">
              Each requirement is compared independently. “Not assessed” means the portfolio does not contain usable candidate evidence for that skill.
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-5 sm:px-6">
            <ComparisonTable comparisons={report.skill_comparisons} />
          </CardContent>
        </Card>
      )}

      {report && report.skill_comparisons.length === 0 && !generating && (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">No skill requirements are included in this report.</p>
            <p className="mt-1 text-sm text-muted-foreground">Review the vacancy skill configuration. You can refresh the analysis after correcting the requirements.</p>
          </CardContent>
        </Card>
      )}

      {report && (report.culture_narrative || report.overall_narrative) && (
        <>
          <Separator />
          <section aria-labelledby="culture-narrative-heading" className="space-y-3">
            <div>
              <h2 id="culture-narrative-heading" className="text-base font-semibold">Culture and competency context</h2>
              <p className="mt-1 text-sm text-muted-foreground">AI-generated context is supplementary and should be checked against the structured comparison.</p>
            </div>
            <Card>
              <CardContent className="space-y-3 p-5 sm:p-6">
                {report.culture_narrative && (
                  <div>
                    <h3 className="text-sm font-medium">Culture fit context</h3>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{report.culture_narrative}</p>
                  </div>
                )}
                {report.culture_narrative && report.overall_narrative && <Separator />}
                {report.overall_narrative && (
                  <div>
                    <h3 className="text-sm font-medium">Overall evidence summary</h3>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{report.overall_narrative}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {portfolio.skills.some((skill) => skill.is_discovered) && (
        <>
          <Separator />
          <section aria-labelledby="discovered-skills-heading" className="space-y-3">
            <div>
              <h2 id="discovered-skills-heading" className="flex items-center gap-2 text-base font-semibold">
                <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" /> Additional discovered skills
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">These skills were found during the interview and are not part of this vacancy's configured requirements.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {portfolio.skills.filter((skill) => skill.is_discovered).map((skill) => (
                <Card key={skill.id}>
                  <CardContent className="p-4">
                    <p className="break-words text-sm font-medium">{skill.skill_label}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{skill.ai_level}</span><span>·</span>
                      <span>{skill.ai_confidence} confidence</span>
                    </div>
                    <p className="mt-2 break-words text-sm text-muted-foreground">{skill.competency_summary}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="rounded-lg bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Decision support only. A skill gap or missing assessment evidence is not, by itself, a hiring decision. Review candidate-authored evidence and assessor overrides before drawing conclusions.</p>
        </div>
      </div>
    </div>
  );
}
