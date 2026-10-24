import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import RecruiterSummary from "@/components/fitgap/RecruiterSummary";
import LevelBadge from "@/components/portfolio/LevelBadge";
import ConfidenceIndicator from "@/components/portfolio/ConfidenceIndicator";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  Sparkles,
  AlertCircle,
  Clock,
  FileQuestion,
  Building2,
  User,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { parseLevel, LEVEL_LABELS } from "@/utils/constants";
import type { FitGapReport, Portfolio, Vacancy } from "@/types";

const MAX_POLLS = 15; // 15 polls * 4s = 60s max to prevent unbounded polling loops

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      if (res.status === 202 || (res.data as any)?.status === "generating") {
        setGenerating(true);
        setPollCount((prev) => {
          if (prev >= MAX_POLLS) {
            setGenerating(false); // Stop unbounded polling
            return prev;
          }
          return prev + 1;
        });
        return;
      }

      if (res.data?.report) {
        setReport(res.data.report);
        setGenerating(false);
        setError(null);
        setPollCount(0);
      }
    } catch (e: any) {
      setGenerating(false);
      if (e?.response?.status === 404) {
        setError("Report or portfolio not found for this vacancy.");
      } else {
        setError(e?.response?.data?.error || "Failed to load Fit/Gap report. Please try again.");
      }
    }
  }, [portfolio, vacancyId]);

  // Initial load: portfolio, session/candidate details, and vacancy info
  useEffect(() => {
    let mounted = true;

    Promise.all([
      sessionsApi.getPortfolio(Number(sessionId)),
      sessionsApi.get(Number(sessionId)).catch(() => null),
      vacanciesApi.get(Number(vacancyId)).catch(() => null),
    ])
      .then(([portfolioRes, sessionRes, vacancyRes]) => {
        if (!mounted) return;
        const pData = portfolioRes.data as any;
        if (pData.portfolio) {
          setPortfolio(pData.portfolio);
        }

        if (sessionRes?.data) {
          setCandidateName(sessionRes.data.session?.candidate_name ?? null);
          setAssessmentName(sessionRes.data.assessment?.name ?? null);
        }

        if (vacancyRes?.data?.vacancy) {
          setVacancy(vacancyRes.data.vacancy);
        }
      })
      .catch((err) => {
        if (mounted) setError(err?.response?.data?.error || "Failed to initialize assessment session.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [sessionId, vacancyId]);

  // Fetch report when portfolio is available
  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  // Controlled polling: stops automatically when not generating or when timeout reached
  usePolling(fetchReport, 4000, generating && !!portfolio && pollCount < MAX_POLLS);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setError(null);
    setPollCount(0);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to enqueue regeneration.");
      setGenerating(false);
    } finally {
      setRegenerating(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setPollCount(0);
    setGenerating(true);
    fetchReport();
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const ext = format;
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${candidateName ? candidateName.replace(/\s+/g, "_") : sessionId}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Export failed: " + (e?.response?.data?.error || e.message));
    } finally {
      setExporting(null);
    }
  };

  // Discovered skills from portfolio
  const discoveredSkills = portfolio?.skills?.filter((s) => s.is_discovered) || [];

  // Loading skeleton state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-72" />
        </div>
        <Skeleton className="h-36 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 px-4 sm:px-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b pb-4">
        <div className="space-y-1.5">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Candidate Portfolio
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Fit/Gap Assessment Report
            </h1>
            {vacancy && (
              <Badge variant="secondary" className="font-semibold text-xs bg-primary/10 text-primary border-primary/20">
                <Building2 className="h-3 w-3 mr-1" />
                {vacancy.role_title}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Candidate: <strong className="text-foreground">{candidateName || `Session #${sessionId}`}</strong>
            </span>
            {assessmentName && (
              <span>• Assessment: <span className="text-foreground">{assessmentName}</span></span>
            )}
            {report?.generated_at && (
              <span className="flex items-center gap-1">
                • <Calendar className="h-3 w-3" />
                Generated: {new Date(report.generated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        {portfolio && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
              className="h-8 text-xs font-medium shadow-2xs"
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              Regenerate
            </Button>

            {report && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={Boolean(exporting)}
                  className="h-8 text-xs font-medium shadow-2xs"
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={Boolean(exporting)}
                  className="h-8 text-xs font-medium shadow-2xs"
                >
                  {exporting === "json" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* State 1: Error State */}
      {error && !generating && (
        <Card className="border-rose-200 bg-rose-50/60 p-6 text-center space-y-3 shadow-xs">
          <AlertCircle className="h-8 w-8 text-rose-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-rose-900">Unable to load Fit/Gap Report</h3>
            <p className="text-xs text-rose-800 max-w-md mx-auto">{error}</p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleRetry} className="h-8 text-xs font-medium bg-white">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try Again
            </Button>
            <Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`}>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                Back to Portfolio
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* State 2: Generating State with Progress Guard */}
      {generating && (
        <Card className="border-primary/20 bg-primary/5 p-8 text-center space-y-4 shadow-xs">
          <div className="flex justify-center">
            <div className="relative">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <Sparkles className="h-4 w-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-foreground">Synthesizing Fit/Gap Report</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Gemini AI is cross-referencing candidate portfolio evidence against vacancy benchmark expectations. This synthesis typically takes 5–15 seconds.
            </p>
          </div>
          <div className="max-w-xs mx-auto space-y-1.5">
            <Progress value={Math.min(((pollCount + 1) / MAX_POLLS) * 100, 95)} className="h-1.5" />
            <span className="text-[11px] text-muted-foreground block">
              Checking status (attempt {pollCount + 1} of {MAX_POLLS})...
            </span>
          </div>
        </Card>
      )}

      {/* State 3: Generation Timeout Guard State */}
      {!generating && !report && !error && pollCount >= MAX_POLLS && (
        <Card className="border-amber-200 bg-amber-50/70 p-6 text-center space-y-3 shadow-xs">
          <Clock className="h-8 w-8 text-amber-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-amber-900">Synthesis is taking longer than expected</h3>
            <p className="text-xs text-amber-800 max-w-md mx-auto">
              The AI worker is still analyzing extensive interview transcripts. The report generation is in progress in the background.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRetry} className="h-8 text-xs font-medium bg-white">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check Status Now
          </Button>
        </Card>
      )}

      {/* State 4: Empty State */}
      {!generating && report && (!report.skill_comparisons || report.skill_comparisons.length === 0) && (
        <Card className="border-dashed p-10 text-center space-y-3">
          <FileQuestion className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No Competencies Configured</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              This vacancy does not have required skill benchmarks configured yet, or no matching skills were evaluated during the candidate interview.
            </p>
          </div>
          <Link to={`/vacancies/${vacancyId}/edit`}>
            <Button variant="outline" size="sm" className="text-xs">
              Configure Vacancy Skills
            </Button>
          </Link>
        </Card>
      )}

      {/* State 5: Report Ready & Populated */}
      {!generating && report && report.skill_comparisons && report.skill_comparisons.length > 0 && (
        <div className="space-y-6">
          {/* Focus 1: Recruiter Executive Summary */}
          <RecruiterSummary
            comparisons={report.skill_comparisons}
            discoveredCount={discoveredSkills.length}
            roleTitle={vacancy?.role_title}
            candidateName={candidateName}
          />

          {/* Focus 2, 3, 5: Detailed Competency Comparison Table */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Role Competency Comparison
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Side-by-side comparison of vacancy benchmarks, initial AI scores, and final human assessor calibrations.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {/* Culture & Competency Fit Narratives */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Overall Competency Fit */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> Overall Competency Alignment
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {report.overall_narrative || "No overall narrative generated for this candidate."}
                </p>
              </CardContent>
            </Card>

            {/* Culture & Behavioral Fit */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-teal-600" /> Culture &amp; Work Style Dimension
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {report.culture_narrative ||
                    vacancy?.culture_dimensions ||
                    "Candidate demonstrated cooperative communication aligned with vacancy expectations."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Discovered Skills (Additive exploration) */}
          {discoveredSkills.length > 0 && (
            <Card className="border-amber-200/80 bg-amber-50/20 shadow-xs">
              <CardHeader className="pb-3 border-b border-amber-200/50">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-600" />
                  <div>
                    <CardTitle className="text-sm font-bold text-amber-950">
                      Discovered Additive Skills ({discoveredSkills.length})
                    </CardTitle>
                    <CardDescription className="text-xs text-amber-900/80">
                      Skills evidenced during the interview that were not explicitly listed in vacancy requirements, but may offer bonus value.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 divide-y divide-amber-100">
                {discoveredSkills.map((s) => {
                  const levelNum = parseLevel(s.ai_level);
                  return (
                    <div key={s.id} className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{s.skill_label}</span>
                          <span className="text-[11px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                            Additive
                          </span>
                        </div>
                        {s.competency_summary && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {s.competency_summary}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {levelNum >= 1 && levelNum <= 5 && (
                          <LevelBadge level={levelNum} size="sm" />
                        )}
                        <ConfidenceIndicator confidence={s.ai_confidence} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
