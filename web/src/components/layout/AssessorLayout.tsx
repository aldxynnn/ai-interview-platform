import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { ClipboardList, Briefcase, LogOut, Sparkles, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 font-sans text-slate-900 antialiased">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/assessments" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-slate-900 block leading-tight">
                  Rakamin <span className="text-sky-600 font-semibold">AI Interview</span>
                </span>
                <span className="text-[10px] text-muted-foreground tracking-wide uppercase font-medium">
                  Talent Assessment Hub
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-1.5" aria-label="Main Navigation">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-sky-50 text-sky-700 shadow-2xs border border-sky-200/60"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-sky-600" : "text-slate-400")} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {tenant.name && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100/80 border border-slate-200/80 rounded-full px-3 py-1 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Tenant: <strong className="text-slate-800">{tenant.name}</strong></span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-2.5 text-xs"
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rakamin Product Engineer Case Study</span>
            <span>·</span>
            <span className="font-medium text-slate-700">Monozukuri Craft Edition</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>UU PDP No. 27/2022 Compliant · Multi-Tenant Isolated</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
