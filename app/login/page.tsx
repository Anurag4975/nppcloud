"use client";
import { useState } from "react";
import Link from "next/link";
import { Cloud, Mail, ArrowRight, ShieldCheck, Zap, Globe } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Input, Label, cn } from "@/components/ui";

const FEATURES = [
  { icon: ShieldCheck, title: "Private by default", desc: "Files encrypted at rest, owned by you." },
  { icon: Zap, title: "Fast uploads", desc: "Resumable, chunked uploads from anywhere." },
  { icon: Globe, title: "Built for Nepal", desc: "Local pricing with eSewa, Khalti & Fonepay." },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-ink-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
            <Cloud className="h-5 w-5 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">NPP Cloud</span>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
              Your files,
              <br />
              <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
                always within reach.
              </span>
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-400">
              Secure cloud storage built for speed. Upload, share, and access your files from any device.
            </p>
          </div>
          <div className="space-y-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="flex animate-slide-up items-start gap-3"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-brand-400 ring-1 ring-inset ring-white/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.title}</p>
                    <p className="text-xs text-ink-400">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="relative text-[11px] text-ink-500">
          © {new Date().getFullYear()} NPP Cloud · Built in Nepal
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-6 py-10 lg:w-1/2">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
              <Cloud className="h-5 w-5 text-white" />
            </span>
            <span className="text-base font-bold text-ink-900">NPP Cloud</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-ink-900">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-500">Sign in to continue to your files.</p>

          <div className="mt-8 space-y-4">
            <Button
              variant="secondary"
              onClick={handleGoogle}
              loading={loading}
              className="h-11 w-full justify-center rounded-xl text-sm"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
              </svg>
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-ink-400">
              <div className="h-px flex-1 bg-ink-200" /> or <div className="h-px flex-1 bg-ink-200" />
            </div>

            {sent ? (
              <div className="animate-fade-in rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
                <p className="font-semibold">Check your inbox</p>
                <p className="mt-1 text-xs text-brand-700">
                  We sent a sign-in link to <strong>{email}</strong>. It expires in a few minutes.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    icon={<Mail className="h-4 w-4" />}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                  />
                </div>
                <Button type="submit" loading={loading} className="h-11 w-full justify-center rounded-xl text-sm">
                  Send sign-in link <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            )}

            {error && (
              <p className={cn("animate-fade-in rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600")}>
                {error}
              </p>
            )}

            <div className="flex items-center justify-between pt-2 text-xs">
              <Link href="/forgot-password" className="text-ink-400 transition-colors hover:text-ink-700">
                Forgot password?
              </Link>
              <span className="text-ink-300">·</span>
              <span className="text-ink-400">No account? Sign in creates one</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
