import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import {
  Plus,
  Clock,
  ChevronRight,
  Search,
  ClipboardCheck,
  Radio,
  CheckCircle2,
  AlertCircle,
  Users,
  Languages,
} from "lucide-react";
import type { Assessment } from "@/types";

function SessionStatusBadge({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        Belum ada sesi
      </span>
    );
  }

  if (session.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 animate-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
        Live Now
      </span>
    );
  }

  if (session.status === "ended" && session.end_reason === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
        <AlertCircle className="h-3 w-3" /> Selesai (Error)
      </span>
    );
  }

  if (session.status === "ended") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Selesai
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      <Users className="h-3 w-3" /> Menunggu Kandidat
    </span>
  );
}

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredAssessments = useMemo(() => {
    if (!searchQuery.trim()) return assessments;
    const q = searchQuery.toLowerCase();
    return assessments.filter((a) => a.name.toLowerCase().includes(q));
  }, [assessments, searchQuery]);

  const activeCount = useMemo(
    () => assessments.filter((a) => a.latest_session?.status === "active").length,
    [assessments]
  );
  const completedCount = useMemo(
    () => assessments.filter((a) => a.latest_session?.status === "ended").length,
    [assessments]
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assessments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daftar template wawancara berbasis kompetensi untuk evaluasi kandidat.
          </p>
        </div>
        <Button onClick={() => navigate("/assessments/new")} className="shadow-xs gap-1.5">
          <Plus className="h-4 w-4" /> New Assessment
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Asesmen</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {loading ? "—" : assessments.length}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <ClipboardCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Wawancara Aktif (Live)</p>
            <p className="text-2xl font-bold text-sky-700 mt-1 tabular-nums">
              {loading ? "—" : activeCount}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
            <Radio className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Selesai Dievaluasi</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
              {loading ? "—" : completedCount}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan nama asesmen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-white"
          />
        </div>
        {searchQuery && (
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
            Reset
          </Button>
        )}
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-xl p-4 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Gagal memuat data asesmen. Silakan refresh halaman atau periksa koneksi backend.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-sm text-muted-foreground bg-white/50 space-y-3">
          <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-slate-800">
              {searchQuery ? "Tidak ada asesmen yang cocok" : "Belum ada asesmen dibuat"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery
                ? `Tidak ditemukan asesmen dengan kata kunci "${searchQuery}".`
                : "Buat asesmen baru untuk mulai mengundang kandidat dan menjalankan wawancara AI."}
            </p>
          </div>
          {!searchQuery && (
            <Button variant="outline" size="sm" onClick={() => navigate("/assessments/new")}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Asesmen Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAssessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-sky-400 hover:shadow-xs transition-all duration-150 border-slate-200/90"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="font-semibold text-sm text-slate-900 truncate">{a.name}</p>
                    <SessionStatusBadge session={a.latest_session} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {a.time_limit_min} menit
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Languages className="h-3.5 w-3.5 text-slate-400" />
                      {a.language === "id" ? "Bahasa Indonesia" : "English"}
                    </span>
                    {a.skills && a.skills.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{a.skills.length} kompetensi terkonfigurasi</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 hidden sm:inline-flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/assessments/${a.id}/invite`);
                    }}
                  >
                    <Users className="h-3.5 w-3.5" /> Kelola Sesi
                  </Button>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
