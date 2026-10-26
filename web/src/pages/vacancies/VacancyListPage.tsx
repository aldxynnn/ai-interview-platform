import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import {
  Plus,
  Briefcase,
  ChevronRight,
  Search,
  Target,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Layers,
  HeartHandshake,
} from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const loadVacancies = () => {
    setLoading(true);
    setError(false);
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVacancies();
  }, []);

  const filteredVacancies = useMemo(() => {
    if (!searchQuery.trim()) return vacancies;
    const q = searchQuery.toLowerCase();
    return vacancies.filter(
      (v) =>
        v.role_title.toLowerCase().includes(q) ||
        v.culture_dimensions?.toLowerCase().includes(q) ||
        v.competency_expectations?.toLowerCase().includes(q) ||
        v.skills?.some((s) => s.skill_label.toLowerCase().includes(q))
    );
  }, [vacancies, searchQuery]);

  const totalSkillsCount = useMemo(() => {
    return vacancies.reduce((acc, v) => acc + (v.skills?.length || 0), 0);
  }, [vacancies]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600 mb-1">
            <Briefcase className="h-3.5 w-3.5" />
            <span>Role Taxonomy &amp; Requirements</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Job Vacancies</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Define role benchmarks, required skill rubrics (L1–L5), and cultural expectations for AI fit/gap analysis.
          </p>
        </div>
        <Button
          onClick={() => navigate("/vacancies/new")}
          className="bg-sky-600 hover:bg-sky-700 text-white shrink-0 shadow-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Open Roles</span>
            <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? "..." : vacancies.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Active vacancy profiles</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Benchmark Competencies</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? "..." : totalSkillsCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">Assessed across all roles</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Fit/Gap AI Readiness</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">Active</p>
          <p className="text-xs text-slate-400 mt-0.5">Tenant-isolated rubric engine</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Filter vacancies by role title, competency or skill..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white border-slate-200/90 shadow-2xs text-sm"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Failed to load vacancies</p>
            <p className="text-xs text-rose-700 mt-0.5">
              Could not retrieve the vacancies for your tenant. Please verify your connection and try again.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadVacancies} className="shrink-0 text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredVacancies.length === 0 ? (
        /* Empty state */
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100/80 text-sky-700 mb-4 shadow-2xs">
            <Briefcase className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {searchQuery ? "No matching vacancies found" : "No job vacancies yet"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
            {searchQuery
              ? `We couldn't find any vacancy matching "${searchQuery}". Try a different keyword.`
              : "Create vacancy profiles with expected skill levels (L1–L5) and culture expectations to unlock automated Fit/Gap analysis."}
          </p>
          {searchQuery ? (
            <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
              Clear search filter
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/vacancies/new")}
              className="bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
            </Button>
          )}
        </div>
      ) : (
        /* List of vacancies */
        <div className="space-y-3">
          {filteredVacancies.map((v) => {
            const skillCount = v.skills?.length || 0;
            return (
              <Card
                key={v.id}
                className="cursor-pointer border-slate-200/90 hover:border-sky-300 hover:shadow-xs transition-all duration-150 bg-white group"
                onClick={() => navigate(`/vacancies/${v.id}/edit`)}
              >
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors shrink-0">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <h2 className="text-base font-semibold text-slate-900 group-hover:text-sky-600 transition-colors truncate">
                        {v.role_title}
                      </h2>
                      <Badge variant="secondary" className="text-2xs font-medium text-slate-600 bg-slate-100">
                        {skillCount} {skillCount === 1 ? "skill" : "skills"}
                      </Badge>
                    </div>

                    {/* Culture / Competency previews */}
                    {v.culture_dimensions && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 line-clamp-1">
                        <HeartHandshake className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate italic">"{v.culture_dimensions}"</span>
                      </div>
                    )}

                    {/* Skill chips preview */}
                    {skillCount > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {v.skills.slice(0, 5).map((skill, idx) => (
                          <span
                            key={skill.id || idx}
                            className="inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-md bg-sky-50/80 text-sky-800 border border-sky-200/60"
                          >
                            <span>{skill.skill_label}</span>
                            <span className="font-bold text-sky-600">L{skill.expected_level}</span>
                          </span>
                        ))}
                        {skillCount > 5 && (
                          <span className="text-2xs text-slate-400 font-medium self-center">
                            +{skillCount - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <span className="text-xs font-medium text-sky-600 group-hover:text-sky-700 opacity-0 group-hover:opacity-100 transition-opacity">
                      Edit details
                    </span>
                    <div className="h-8 w-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
