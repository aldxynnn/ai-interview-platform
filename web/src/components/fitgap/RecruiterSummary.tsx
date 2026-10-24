import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Star,
  AlertTriangle,
  HelpCircle,
  Edit3,
  Zap,
  TrendingUp,
  ShieldCheck,
  Award,
} from "lucide-react";
import type { SkillComparison } from "@/types";

interface RecruiterSummaryProps {
  comparisons: SkillComparison[];
  discoveredCount?: number;
  roleTitle?: string;
  candidateName?: string | null;
}

export default function RecruiterSummary({
  comparisons,
  discoveredCount = 0,
  roleTitle,
  candidateName,
}: RecruiterSummaryProps) {
  const stats = useMemo(() => {
    const total = comparisons.length;
    const matchCount = comparisons.filter((c) => c.result === "match").length;
    const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
    const gapCount = comparisons.filter((c) => c.result === "gap").length;
    const unassessedCount = comparisons.filter((c) => c.result === "not_assessed").length;
    const overrideCount = comparisons.filter((c) => Boolean(c.is_override)).length;

    const evaluatedCount = total - unassessedCount;
    const metCount = matchCount + exceedCount;
    const matchRate = evaluatedCount > 0 ? Math.round((metCount / evaluatedCount) * 100) : 0;

    let verdict: {
      label: string;
      description: string;
      variant: "success" | "warning" | "danger" | "neutral";
      badgeClass: string;
      progressClass: string;
    };

    if (total === 0 || evaluatedCount === 0) {
      verdict = {
        label: "Evaluation Inconclusive",
        description: "No required skills evaluated in the interview session.",
        variant: "neutral",
        badgeClass: "bg-neutral-100 text-neutral-700 border-neutral-300",
        progressClass: "bg-neutral-400",
      };
    } else if (matchRate >= 85 && gapCount === 0) {
      verdict = {
        label: "Strong Role Fit",
        description: "Candidate fully satisfies or exceeds all required competency benchmarks.",
        variant: "success",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
        progressClass: "bg-emerald-600",
      };
    } else if (matchRate >= 60) {
      verdict = {
        label: "Moderate Role Fit",
        description: `Candidate meets ${metCount} of ${total} benchmark skills. Minor gaps can be calibrated or mentored.`,
        variant: "warning",
        badgeClass: "bg-teal-50 text-teal-800 border-teal-300",
        progressClass: "bg-teal-600",
      };
    } else {
      verdict = {
        label: "Skill Gaps Identified",
        description: `Candidate does not meet required benchmarks in ${gapCount} skill${gapCount !== 1 ? "s" : ""}. Review gap areas below.`,
        variant: "danger",
        badgeClass: "bg-rose-50 text-rose-800 border-rose-300",
        progressClass: "bg-rose-600",
      };
    }

    return {
      total,
      matchCount,
      exceedCount,
      gapCount,
      unassessedCount,
      overrideCount,
      metCount,
      evaluatedCount,
      matchRate,
      verdict,
    };
  }, [comparisons]);

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      {/* Top Banner / Verdict */}
      <div className="bg-gradient-to-r from-muted/60 via-muted/40 to-background border-b px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Recruiter Executive Summary
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-xs"
                style={{
                  backgroundColor: stats.verdict.variant === "success" ? "#ecfdf5" : stats.verdict.variant === "warning" ? "#f0fdfa" : stats.verdict.variant === "danger" ? "#fff1f2" : "#f5f5f5",
                  color: stats.verdict.variant === "success" ? "#065f46" : stats.verdict.variant === "warning" ? "#115e59" : stats.verdict.variant === "danger" ? "#9f1239" : "#404040",
                  borderColor: stats.verdict.variant === "success" ? "#a7f3d0" : stats.verdict.variant === "warning" ? "#99f6e4" : stats.verdict.variant === "danger" ? "#fecdd3" : "#e5e5e5",
                }}
              >
                {stats.verdict.label}
              </span>
            </div>
            <p className="text-sm text-foreground/90 font-medium">
              {stats.verdict.description}
            </p>
          </div>

          {/* Fit Percentage Badge */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 bg-background/80 sm:bg-transparent rounded-md p-2 sm:p-0 border sm:border-0">
            <span className="text-xs text-muted-foreground font-medium">Competency Fit Rate</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">{stats.matchRate}%</span>
              <span className="text-xs text-muted-foreground">({stats.metCount}/{stats.total} met)</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <Progress
            value={stats.matchRate}
            className="h-2 bg-secondary"
            indicatorClassName={stats.verdict.progressClass}
          />
        </div>
      </div>

      {/* Metric KPI Chips Grid */}
      <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
        {/* Met / Matches */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Match</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-semibold text-emerald-700">{stats.matchCount}</div>
          <p className="text-[11px] text-muted-foreground">Met exact level</p>
        </div>

        {/* Exceeds */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Exceeds</span>
            <Star className="h-3.5 w-3.5 text-teal-600 fill-teal-100" />
          </div>
          <div className="text-lg font-semibold text-teal-700">{stats.exceedCount}</div>
          <p className="text-[11px] text-muted-foreground">Surpassed target</p>
        </div>

        {/* Gaps */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Gaps</span>
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div className="text-lg font-semibold text-rose-700">{stats.gapCount}</div>
          <p className="text-[11px] text-muted-foreground">Below required</p>
        </div>

        {/* Overrides */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Calibrated</span>
            <Edit3 className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-semibold text-amber-700">{stats.overrideCount}</div>
          <p className="text-[11px] text-muted-foreground">Human calibrated</p>
        </div>

        {/* Unassessed */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Unassessed</span>
            <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="text-lg font-semibold text-slate-600">{stats.unassessedCount}</div>
          <p className="text-[11px] text-muted-foreground">Not probed</p>
        </div>

        {/* Discovered Additives */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Discovered</span>
            <Zap className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-semibold text-amber-700">{discoveredCount}</div>
          <p className="text-[11px] text-muted-foreground">Additive skills</p>
        </div>
      </CardContent>
    </Card>
  );
}
