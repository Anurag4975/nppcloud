"use client";
import { useState } from "react";
import Link from "next/link";
import { Cloud, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Input, Label } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-6">
      <div className="w-full max-w-sm animate-slide-up">
        <Link href="/login" className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-ink-400 transition-colors hover:text-ink-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>

        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
            <Cloud className="h-5 w-5 text-white" />
          </span>
          <span className="text-base font-bold text-ink-900">NPP Cloud</span>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-ink-900">Reset password</h1>
        <p className="mt-1 text-sm text-ink-500">We'll email you a secure link to set a new password.</p>

        <div className="mt-6">
          {sent ? (
            <div className="flex animate-fade-in items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              <div>
                <p className="text-sm font-semibold text-brand-800">Check your inbox</p>
                <p className="mt-1 text-xs text-brand-700">
                  If an account exists for that email, a reset link is on its way.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
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
              <Button type="submit" loading={loading} className="h-11 w-full justify-center rounded-xl">
                Send reset link
              </Button>
            </form>
          )}
          {error && <p className="mt-4 animate-fade-in text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </main>
  );
}
