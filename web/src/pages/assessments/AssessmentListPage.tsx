import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight, Search, RefreshCw } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs text-destructive">Last: failed</span>;

  if (session.status === "ended")
    return <span className="text-xs text-muted-foreground">Last: completed</span>;

  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await assessmentsApi.list();
      setAssessments(res.data.assessments);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  const filteredAssessments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return assessments;
    return assessments.filter((assessment) =>
      assessment.name.toLowerCase().includes(normalizedQuery)
    );
  }, [assessments, query]);

  const openAssessment = (id: Assessment["id"]) => navigate(`/assessments/${id}/invite`);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Assessments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage interview assessments and candidate sessions.
          </p>
        </div>
        <Button onClick={() => navigate("/assessments/new")} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" /> New Assessment
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search assessments"
            placeholder="Search assessments"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Refresh assessments"
          title="Refresh assessments"
          onClick={() => void loadAssessments()}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        {!loading && !error && (
          <span className="text-sm text-muted-foreground sm:ml-auto">
            {filteredAssessments.length} of {assessments.length}
          </span>
        )}
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="text-sm text-destructive">
            Couldn’t load assessments. Check your connection and try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => void loadAssessments()}>
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-label="Loading assessments">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[68px] w-full rounded-md" />)}
        </div>
      ) : !error && filteredAssessments.length === 0 ? (
        <div className="rounded-md border px-5 py-12 text-center">
          <p className="text-sm font-medium">
            {assessments.length === 0 ? "No assessments yet" : "No matching assessments"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {assessments.length === 0
              ? "Create an assessment to start inviting candidates."
              : "Try a different search term."}
          </p>
          {assessments.length === 0 ? (
            <Button className="mt-4" onClick={() => navigate("/assessments/new")}>
              <Plus className="mr-1.5 h-4 w-4" /> New Assessment
            </Button>
          ) : (
            <Button className="mt-4" variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          )}
        </div>
      ) : !error ? (
        <div className="space-y-2">
          {filteredAssessments.map((assessment) => (
            <Card
              key={assessment.id}
              role="link"
              tabIndex={0}
              aria-label={`Open ${assessment.name}`}
              className="cursor-pointer rounded-md shadow-none transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => openAssessment(assessment.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openAssessment(assessment.id);
                }
              }}
            >
              <CardContent className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{assessment.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {assessment.time_limit_min} min
                    </span>
                    {assessment.latest_session && (
                      <>
                        <span aria-hidden="true">·</span>
                        <SessionSummary session={assessment.latest_session} />
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </section>
  );
}
