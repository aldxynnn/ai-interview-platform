import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, ShieldCheck, ArrowRight, AlertCircle, ClipboardCheck } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      saveToken(token);
      setAuth({ token });
      navigate("/assessments");
    } catch {
      setError("We couldn't sign you in. Check your email and password, then try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-slate-900 px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="pointer-events-none absolute -right-24 top-24 h-96 w-96 rounded-full border-[60px] border-teal-400/10" />
        <div className="pointer-events-none absolute bottom-16 left-1/4 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500 text-slate-950"><Sparkles className="h-5 w-5" /></span>
          <div><p className="font-bold tracking-tight">AI Interview</p><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Hiring workspace</p></div>
        </div>
        <div className="relative max-w-xl py-12">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Better interviews. Clearer evidence.</p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Make every candidate conversation count.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Create structured assessments, run AI-assisted interviews, and review candidate evidence with a consistent process.</p>
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4"><ClipboardCheck className="mb-3 h-5 w-5 text-teal-300" /><p className="text-sm font-semibold">Structured by design</p><p className="mt-1 text-xs leading-5 text-slate-400">Evaluate candidates against defined skills and expectations.</p></div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="mb-3 h-5 w-5 text-teal-300" /><p className="text-sm font-semibold">Evidence first</p><p className="mt-1 text-xs leading-5 text-slate-400">Keep human review at the center of hiring decisions.</p></div>
          </div>
        </div>
        <p className="relative text-xs text-slate-500">Private workspace · Handle candidate information responsibly</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white"><Sparkles className="h-5 w-5" /></span>
            <div><p className="font-bold text-slate-900">AI Interview</p><p className="text-xs text-slate-500">Hiring workspace</p></div>
          </div>
          <div className="mb-8">
            <p className="text-sm font-semibold text-teal-700">Welcome back</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Sign in to your workspace</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Use your organization account to manage assessments and review candidate results.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">Work email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-lg border-slate-200 bg-slate-50/60 px-3 focus-visible:bg-white" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label htmlFor="password" className="text-slate-700">Password</Label></div>
              <Input id="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 rounded-lg border-slate-200 bg-slate-50/60 px-3 focus-visible:bg-white" />
            </div>

            {error && <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

            <Button type="submit" className="h-11 w-full gap-2 rounded-lg bg-teal-700 font-semibold text-white shadow-sm hover:bg-teal-800" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
          <div className="mt-8 flex items-start gap-2 rounded-lg bg-slate-50 p-3.5 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><p>Your session is protected. Only sign in on a device you trust and sign out when finished.</p></div>
        </div>
      </section>
    </main>
  );
}
