"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Input } from "@/components/ui/core";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Reset password</h1>
      <p className="mb-6 text-sm text-slate-500">We'll email you a secure link to set a new password.</p>
      {sent ? (
        <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-700">
          Check your inbox — if an account exists for that email, a reset link is on its way.
          <Link href="/login" className="mt-3 block font-medium underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit">Send reset link</Button>
        </form>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <Link href="/login" className="mt-6 text-center text-xs text-slate-400 hover:underline">Back to sign in</Link>
    </main>
  );
}
