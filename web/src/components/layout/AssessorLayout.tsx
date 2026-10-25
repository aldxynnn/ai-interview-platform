import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ClipboardList, Briefcase, LogOut, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  const currentPage = navItems.find(({ href }) => location.pathname.startsWith(href))?.label ?? "Workspace";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/80 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-7">
            <Link to="/assessments" className="group flex shrink-0 items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm shadow-teal-900/15 transition-transform group-hover:-translate-y-0.5">
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-bold tracking-tight text-slate-900">AI Interview</span>
                <span className="block text-[11px] font-medium tracking-wide text-slate-500">HIRING WORKSPACE</span>
              </span>
            </Link>
            <nav aria-label="Main navigation" className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-700/10"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Current workspace</p>
              <p className="max-w-48 truncate text-sm font-medium text-slate-700">{tenant.name || "Your organization"}</p>
            </div>
            <span className="hidden h-8 w-px bg-slate-200 md:block" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex h-10 max-w-[1440px] items-center gap-2 px-4 text-xs sm:px-6 lg:px-8">
          <span className="font-medium text-slate-400">Workspace</span>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="font-semibold text-slate-700">{currentPage}</span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-1 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>AI Interview · Hiring decisions with clearer evidence</span>
          <span>Private workspace · Candidate data should be handled responsibly</span>
        </div>
      </footer>
    </div>
  );
}
