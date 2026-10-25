import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, Search, RefreshCw } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await vacanciesApi.list();
      setVacancies(res.data.vacancies);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVacancies();
  }, [loadVacancies]);

  const filteredVacancies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return vacancies;
    return vacancies.filter((vacancy) =>
      vacancy.role_title.toLowerCase().includes(normalizedQuery)
    );
  }, [vacancies, query]);

  const openVacancy = (id: Vacancy["id"]) => navigate(`/vacancies/${id}/edit`);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vacancies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the roles used for your interview assessments.
          </p>
        </div>
        <Button onClick={() => navigate("/vacancies/new")} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" /> New Vacancy
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search vacancies"
            placeholder="Search by role title"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Refresh vacancies"
          title="Refresh vacancies"
          onClick={() => void loadVacancies()}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        {!loading && !error && (
          <span className="text-sm text-muted-foreground sm:ml-auto">
            {filteredVacancies.length} of {vacancies.length}
          </span>
        )}
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="text-sm text-destructive">
            Couldn’t load vacancies. Check your connection and try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => void loadVacancies()}>
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-label="Loading vacancies">
          {[1, 2].map((i) => <Skeleton key={i} className="h-[60px] w-full rounded-md" />)}
        </div>
      ) : !error && filteredVacancies.length === 0 ? (
        <div className="rounded-md border px-5 py-12 text-center">
          <p className="text-sm font-medium">
            {vacancies.length === 0 ? "No vacancies yet" : "No matching roles"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {vacancies.length === 0
              ? "Create a vacancy to define the role for your interview."
              : "Try a different search term."}
          </p>
          {vacancies.length === 0 ? (
            <Button className="mt-4" onClick={() => navigate("/vacancies/new")}>
              <Plus className="mr-1.5 h-4 w-4" /> New Vacancy
            </Button>
          ) : (
            <Button className="mt-4" variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          )}
        </div>
      ) : !error ? (
        <div className="space-y-2">
          {filteredVacancies.map((vacancy) => (
            <Card
              key={vacancy.id}
              role="link"
              tabIndex={0}
              aria-label={`Edit ${vacancy.role_title}`}
              className="cursor-pointer rounded-md shadow-none transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => openVacancy(vacancy.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openVacancy(vacancy.id);
                }
              }}
            >
              <CardContent className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="truncate text-sm font-medium">{vacancy.role_title}</p>
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
