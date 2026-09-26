"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, Lock, CheckCircle2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Input, Label } from "@/components/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else {
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-6">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
            <Cloud className="h-5 w-5 text-white" />
          </span>
          <span className="text-base font-bold text-ink-900">NPP Cloud</span>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-ink-900">Set new password</h1>
        <p className="mt-1 text-sm text-ink-500">Choose a new password for your account.</p>

        <div className="mt-6">
          {done ? (
            <div className="flex animate-fade-in items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />
              <p className="text-sm font-semibold text-brand-800">Password updated. Redirecting…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="pw">New password</Label>
                <Input
                  id="pw"
                  type="password"
                  required
                  minLength={8}
                  icon={<Lock className="h-4 w-4" />}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  icon={<Lock className="h-4 w-4" />}
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11"
                />
              </div>
              <Button type="submit" loading={loading} className="h-11 w-full justify-center rounded-xl">
                Update password
              </Button>
            </form>
          )}
          {error && <p className="mt-4 animate-fade-in text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </main>
  );
}
