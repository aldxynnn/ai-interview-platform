import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, ChevronRight, Search, Users, Layers3, RefreshCw, ArrowUpRight } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const loadVacancies = () => {
    setLoading(true);
    setError(false);
    vacanciesApi.list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadVacancies(); }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return vacancies.filter((v) =>
      v.role_title.toLowerCase().includes(term)
      || (v.skills ?? []).some((skill) => skill.skill_label.toLowerCase().includes(term))
    );
  }, [vacancies, query]);

  const totalSkills = vacancies.reduce((sum, vacancy) => sum + (vacancy.skills?.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            <Briefcase className="h-3.5 w-3.5" /> Role library
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Vacancy profiles</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Define role expectations once, then use the same skill criteria to compare candidate evidence consistently.</p>
        </div>
        <Button onClick={() => navigate("/vacancies/new")} className="h-11 gap-2 bg-teal-700 px-5 font-semibold text-white shadow-sm hover:bg-teal-800">
          <Plus className="h-4 w-4" /> New vacancy
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card className="rounded-xl border-slate-200 shadow-none"><CardContent className="flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><Briefcase className="h-5 w-5" /></span>
          <div><p className="text-sm text-slate-500">Saved role profiles</p><p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{vacancies.length}</p></div>
        </CardContent></Card>
        <Card className="rounded-xl border-slate-200 shadow-none"><CardContent className="flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Layers3 className="h-5 w-5" /></span>
          <div><p className="text-sm text-slate-500">Skill expectations defined</p><p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{totalSkills}</p></div>
        </CardContent></Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h2 className="text-lg font-bold tracking-tight text-slate-900">Your role profiles</h2><p className="mt-1 text-sm text-slate-500">Search by role title or a skill to find the right criteria.</p></div>
          <Button variant="outline" size="sm" onClick={loadVacancies} disabled={loading} className="gap-2 self-start border-slate-200 bg-white sm:self-auto"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
        </div>

        <div className="relative max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search vacancies by title or skill" placeholder="Search role title or skill..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10" />
        </div>

        {error && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"><span>We couldn't load vacancy profiles. Try again.</span><Button variant="outline" size="sm" onClick={loadVacancies} className="border-rose-200 bg-white">Try again</Button></div>}

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-800"><Briefcase className="h-6 w-6" /></span>
            <h3 className="mt-4 font-semibold text-slate-900">{vacancies.length === 0 ? "Build your first vacancy profile" : "No matching role profiles"}</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{vacancies.length === 0 ? "Add expected skills and culture signals so candidate reports have a clear reference point." : "Try a different role title or skill keyword."}</p>
            {vacancies.length === 0 ? <Button onClick={() => navigate("/vacancies/new")} className="mt-5 gap-2 bg-teal-700 hover:bg-teal-800"><Plus className="h-4 w-4" /> Create vacancy</Button> : <Button variant="outline" onClick={() => setQuery("")} className="mt-5">Clear search</Button>}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((v) => (
              <Card key={v.id} role="button" tabIndex={0} onClick={() => navigate(`/vacancies/${v.id}/edit`)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/vacancies/${v.id}/edit`); } }} className="group cursor-pointer rounded-xl border-slate-200 bg-white shadow-none transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md hover:shadow-slate-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-teal-50 group-hover:text-teal-800"><Briefcase className="h-5 w-5" /></span>
                      <div className="min-w-0"><h3 className="font-semibold text-slate-900 group-hover:text-teal-800">{v.role_title}</h3><p className="mt-1 text-xs text-slate-500">{v.skills?.length ?? 0} skill expectations</p></div>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 group-hover:border-teal-200 group-hover:text-teal-700"><ArrowUpRight className="h-4 w-4" /></span>
                  </div>
                  {v.skills?.length ? <div className="mt-4 flex flex-wrap gap-1.5">{v.skills.slice(0, 4).map((skill) => <span key={skill.id ?? skill.skill_label} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">{skill.skill_label}</span>)}{v.skills.length > 4 && <span className="rounded-md bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800">+{v.skills.length - 4} more</span>}</div> : <p className="mt-4 text-xs text-amber-700">No skill expectations defined yet</p>}
                  {(v.culture_dimensions || v.competency_expectations) && <p className="mt-4 line-clamp-2 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">{v.culture_dimensions || v.competency_expectations}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {!loading && filtered.length > 0 && <p className="text-xs text-slate-400">Showing {filtered.length} of {vacancies.length} role profiles</p>}
      </section>
    </div>
  );
}
