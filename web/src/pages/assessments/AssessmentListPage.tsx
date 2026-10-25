import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;
  if (session.status === "active") return <span className="flex items-center gap-1 text-xs text-primary"><span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />Live now</span>;
  if (session.status === "failed" || (session.status === "ended" && session.end_reason === "error")) return <span className="text-xs text-destructive">Last: failed</span>;
  if (session.status === "ended") return <span className="text-xs text-muted-foreground">Last: completed</span>;
  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi.list()
      .then((response) => setAssessments(response.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-xl font-semibold">Assessments</h1>
        <Button onClick={() => navigate("/assessments/new")}><Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />New Assessment</Button>
      </header>

      {error && <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">Failed to load assessments. Refresh the page to retry.</div>}

      {loading ? (
        <div aria-busy="true" aria-label="Loading assessments" className="space-y-2">
          {[1, 2, 3].map((index) => <Skeleton key={index} className="h-16 w-full" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No assessments yet.</p>
          <Button variant="outline" onClick={() => navigate("/assessments/new")}><Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />Create your first assessment</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {assessments.map((assessment) => (
            <Card key={assessment.id} className="transition-colors hover:border-primary/40">
              <CardContent className="p-0">
                <Link
                  to={"/assessments/" + assessment.id + "/invite"}
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{assessment.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock aria-hidden="true" className="h-3 w-3" />{assessment.time_limit_min} min</span>
                      {assessment.latest_session && <><span aria-hidden="true">·</span><SessionSummary session={assessment.latest_session} /></>}
                    </div>
                  </div>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
