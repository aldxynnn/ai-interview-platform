import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  FileText,
  Briefcase,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Award,
} from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as any;
      if (
        data.status === "generating" ||
        data.portfolio?.generation_status === "generating" ||
        data.portfolio?.generation_status === "pending"
      ) {
        setGenerating(true);
      } else if (data.portfolio) {
        setPortfolio(data.portfolio);
        setGenerating(false);
        // Build overrides map
        const overrideMap: Record<number, AssessorOverride> = {};
        data.portfolio.overrides?.forEach((o: AssessorOverride) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setOverrides(overrideMap);
      }
    } catch {
      // transient failure
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies || []);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Poll while generating
  usePolling(fetchPortfolio, 4000, generating);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(null);
    }
  };

  const configuredSkills = useMemo(() => {
    return portfolio?.skills.filter((s) => !s.is_discovered) || [];
  }, [portfolio]);

  const discoveredSkills = useMemo(() => {
    return portfolio?.skills.filter((s) => s.is_discovered) || [];
  }, [portfolio]);

  const overridesCount = useMemo(() => {
    return Object.keys(overrides).length;
  }, [overrides]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link
          to={`/assessments/${id}/invite`}
          className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Assessment Sessions
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">Portfolio #{sessionId}</span>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-600">
              Candidate Competency Portfolio
            </span>
            <Badge variant="secondary" className="text-2xs bg-slate-100 text-slate-700 font-medium">
              Session #{sessionId}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {candidateName ? `${candidateName}'s Evaluation Portfolio` : "Candidate Assessment Portfolio"}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Objective competency evidence distilled from dialogue transcripts, mapped to proficiency levels L1–L5 with auditable quotes and assessor overrides.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1.5 text-xs font-medium border border-slate-200 bg-white rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
          >
            <FileText className="h-3.5 w-3.5 text-slate-500" />
            View Transcript
          </Link>

          {!generating && portfolio && portfolio.generation_status === "complete" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
                className="bg-white border-slate-200 text-xs shadow-2xs"
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
                )}
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
                className="bg-white border-slate-200 text-xs shadow-2xs"
              >
                {exporting === "json" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
                )}
                Export JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Strip */}
      {!generating && portfolio && portfolio.generation_status === "complete" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Configured Competencies</span>
              <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{configuredSkills.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Assessed against assessment rubric</p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Discovered Competencies</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{discoveredSkills.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Probed dynamically during interview</p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Human Assessor Overrides</span>
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-indigo-700 mt-2">{overridesCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Human-in-the-Loop calibrated</p>
          </div>
        </div>
      )}

      {/* Generating State */}
      {generating && (
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50/70 via-white to-sky-50/40 p-10 text-center space-y-4 shadow-2xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md shadow-sky-600/20">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-semibold text-sky-950">
              Generating Candidate Evidence Portfolio
            </h3>
            <p className="text-xs text-sky-900/80 leading-relaxed">
              Our asynchronous AI model is extracting conversational signals, mapping competency evidence to L1–L5 rubrics, and checking compliance. This typically takes 1–2 minutes.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-2xs font-medium text-sky-700 bg-white/80 border border-sky-200/80 px-3 py-1 rounded-full">
            <Sparkles className="h-3 w-3 text-sky-600 animate-pulse" />
            Auto-refreshing status via background polling...
          </div>
        </div>
      )}

      {/* Failed State */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center space-y-4 shadow-2xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-rose-900">Portfolio Generation Encountered an Error</h3>
            <p className="text-xs text-rose-700 max-w-md mx-auto">
              The AI worker was unable to complete transcript analysis for this session. You can safely retry without losing any interview data.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
            className="bg-white border-rose-200 hover:bg-rose-100 text-rose-800 text-xs shadow-2xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Portfolio Generation
          </Button>
        </div>
      )}

      {/* Ready State */}
      {!generating && portfolio?.generation_status === "complete" && (
        <div className="space-y-8">
          {/* Configured Skills Section */}
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Configured Competencies</h2>
                <p className="text-xs text-slate-500">
                  Target skills planned in the assessment syllabus with verified quotes and rubric evaluations.
                </p>
              </div>
              <Badge variant="outline" className="text-2xs bg-white text-slate-600 border-slate-200">
                {configuredSkills.length} skills
              </Badge>
            </div>

            <div className="space-y-3">
              {configuredSkills.map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))}
            </div>
          </section>

          {/* Discovered Skills Section */}
          {discoveredSkills.length > 0 && (
            <section className="space-y-3.5 pt-4 border-t border-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Competencies
                  </h2>
                  <p className="text-xs text-slate-500">
                    Additional technical competencies uncovered and probed dynamically by the AI during discussion.
                  </p>
                </div>
                <Badge variant="outline" className="text-2xs bg-amber-50 text-amber-800 border-amber-200">
                  {discoveredSkills.length} discovered
                </Badge>
              </div>

              <div className="space-y-3">
                {discoveredSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Fit/Gap Analysis Launcher */}
          <section className="pt-4 border-t border-slate-200/80">
            <Card className="border-sky-200/80 bg-gradient-to-br from-sky-50/60 via-white to-sky-50/30 shadow-2xs">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Run Role Fit/Gap Analysis
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                      Select a job vacancy benchmark to compare this candidate's demonstrated evidence against role expectations. Calculates skill match, gaps, exceedances, and AI cultural fit narrative.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <div className="flex-1">
                    <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                      <SelectTrigger className="w-full bg-white border-slate-200 shadow-2xs text-xs h-10">
                        <SelectValue placeholder="Select target job vacancy..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vacancies.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)} className="text-xs">
                            {v.role_title} ({v.skills?.length || 0} required skills)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleRunFitGap}
                    disabled={!selectedVacancy}
                    className="bg-sky-600 hover:bg-sky-700 text-white shrink-0 text-xs h-10 px-5 shadow-xs"
                  >
                    Run Fit/Gap Analysis →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
