import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi.list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Workspace</p><h1 className="text-2xl font-semibold tracking-tight">Vacancies</h1><p className="text-sm text-muted-foreground">Manage the roles and skill requirements used for Fit/Gap analysis.</p></div>
        <Button className="w-full sm:w-auto" onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-5 py-12 text-center text-sm text-muted-foreground sm:px-10">
          <p className="mb-3">No vacancies yet.</p>
          <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {vacancies.map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer rounded-xl shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
            >
              <CardContent className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <p className="break-words text-sm font-semibold">{v.role_title}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
