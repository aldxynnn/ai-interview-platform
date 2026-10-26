import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, saveToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

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
      setError("Invalid email or password. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-sky-50/40 p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Rakamin AI Interview
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Autonomous Talent Evaluation &amp; Trustworthy Competency Fit/Gap Engine
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-slate-200/90 shadow-sm bg-white/95 backdrop-blur-xs">
          <CardContent className="p-6 sm:p-7 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">Sign In to Assessor Workspace</h2>
              <p className="text-xs text-slate-500">
                Access your tenant assessments, candidate transcripts, and Fit/Gap reports.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  Work Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="assessor@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 text-xs bg-white border-slate-200 shadow-2xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 text-xs bg-white border-slate-200 shadow-2xs"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-700 text-white shadow-xs font-medium text-xs h-10"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Authenticating...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Trust & Compliance Strip */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-950">
            <ShieldCheck className="h-4 w-4 text-sky-600" />
            <span>Enterprise-Grade Trust &amp; Compliance</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-2xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span>UU PDP No. 27/2022</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span>Multi-Tenant Row Isolation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span>Human-in-the-Loop Override</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span>Auditable Rubric Verification</span>
            </div>
          </div>
        </div>

        <p className="text-center text-2xs text-slate-400">
          © {new Date().getFullYear()} Rakamin AI Interview. All rights reserved.
        </p>
      </div>
    </div>
  );
}
