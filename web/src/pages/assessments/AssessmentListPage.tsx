import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus, Clock, ChevronRight, Search, ClipboardCheck, Activity,
  CircleCheck, Users, ArrowUpRight, SlidersHorizontal, RefreshCw
} from "lucide-react";
import type { Assessment } from "@/types";

type StatusFilter = "all" | "live" | "waiting" | "completed";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return <span className="text-xs text-slate-500">No candidates yet</span>;
  if (session.status === "active") return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live now
    </span>
  );
  if (session.status === "ended" && session.end_reason === "error") return (
    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">Needs review</span>
  );
  if (session.status === "ended") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <CircleCheck className="h-3 w-3" /> Completed
    </span>
  );
  return <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Awaiting candidate</span>;
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const navigate = useNavigate();

  const loadAssessments = () => {
    setLoading(true);
    setError(false);
    assessmentsApi.list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAssessments(); }, []);

  const stats = useMemo(() => ({
    total: assessments.length,
    live: assessments.filter((a) => a.latest_session?.status === "active").length,
    waiting: assessments.filter((a) => a.latest_session?.status === "pending").length,
    completed: assessments.filter((a) => a.latest_session?.status === "ended").length,
  }), [assessments]);

  const filtered = useMemo(() => assessments.filter((a) => {
    const matchesQuery = a.name.toLowerCase().includes(query.trim().toLowerCase());
    const status = a.latest_session?.status;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "live" && status === "active")
      || (statusFilter === "waiting" && (!status || status === "pending"))
      || (statusFilter === "completed" && status === "ended");
    return matchesQuery && matchesStatus;
  }), [assessments, query, statusFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-7 text-white shadow-sm sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[36px] border-teal-400/10" />
        <div className="pointer-events-none absolute right-28 top-16 h-28 w-28 rounded-full bg-teal-400/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-teal-100">
              <Activity className="h-3.5 w-3.5" /> Hiring operations
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Assessment workspace</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">
              Build structured interviews, invite candidates, and review evidence from every session in one place.
            </p>
          </div>
          <Button onClick={() => navigate("/assessments/new")} className="h-11 shrink-0 gap-2 bg-teal-500 px-5 font-semibold text-slate-950 shadow-sm hover:bg-teal-400">
            <Plus className="h-4 w-4" /> Create assessment
          </Button>
        </div>
      </section>

      <section aria-label="Assessment overview" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total assessments", value: stats.total, detail: "Interview templates", icon: ClipboardCheck, tint: "bg-slate-100 text-slate-700" },
          { label: "Live sessions", value: stats.live, detail: "Candidates interviewing", icon: Activity, tint: "bg-emerald-50 text-emerald-700" },
          { label: "Awaiting candidate", value: stats.waiting, detail: "Invites not completed", icon: Users, tint: "bg-amber-50 text-amber-700" },
          { label: "Completed", value: stats.completed, detail: "Ready for review", icon: CircleCheck, tint: "bg-sky-50 text-sky-700" },
        ].map(({ label, value, detail, icon: Icon, tint }) => (
          <Card key={label} className="rounded-xl border-slate-200 bg-white shadow-none">
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
                <p className="mt-1 text-xs text-slate-400">{detail}</p>
              </div>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Your assessments</h2>
            <p className="mt-1 text-sm text-slate-500">Select an assessment to manage invitations and candidate results.</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAssessments} disabled={loading} className="gap-2 self-start border-slate-200 bg-white text-slate-600 sm:self-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by role title..." aria-label="Search assessments" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/10" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter assessments by status">
            <SlidersHorizontal className="mr-1 h-4 w-4 text-slate-400" />
            {([
              ["all", "All"],
              ["live", "Live"],
              ["waiting", "Waiting"],
              ["completed", "Completed"],
            ] as [StatusFilter, string][]).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setStatusFilter(value)} aria-pressed={statusFilter === value} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${statusFilter === value ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
            <span>We couldn't load assessments. Your work is safe—try loading the list again.</span>
            <Button variant="outline" size="sm" onClick={loadAssessments} className="border-rose-200 bg-white">Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><ClipboardCheck className="h-6 w-6" /></span>
            <h3 className="mt-4 font-semibold text-slate-900">{assessments.length === 0 ? "Create your first assessment" : "No matching assessments"}</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{assessments.length === 0 ? "Start with a role and the skills you want to evaluate. You can invite candidates right after setup." : "Try a different search term or change the status filter."}</p>
            {assessments.length === 0 ? (
              <Button onClick={() => navigate("/assessments/new")} className="mt-5 gap-2 bg-teal-700 hover:bg-teal-800"><Plus className="h-4 w-4" /> Create assessment</Button>
            ) : (
              <Button variant="outline" onClick={() => { setQuery(""); setStatusFilter("all"); }} className="mt-5">Clear filters</Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => (
              <Card key={a.id} className="group cursor-pointer rounded-xl border-slate-200 bg-white shadow-none transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md hover:shadow-slate-900/5" onClick={() => navigate(`/assessments/${a.id}/invite`)}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><ClipboardCheck className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900 group-hover:text-teal-800">{a.name}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {a.time_limit_min} min</span>
                        <span>{a.skills?.length ?? 0} skills configured</span>
                        {a.language && <span>{a.language === "id" ? "Bahasa Indonesia" : "English"}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <SessionSummary session={a.latest_session} />
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition group-hover:border-teal-200 group-hover:text-teal-700"><ArrowUpRight className="h-4 w-4" /></span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {!loading && filtered.length > 0 && <p className="text-xs text-slate-400">Showing {filtered.length} of {assessments.length} assessments</p>}
      </section>
    </div>
  );
}
