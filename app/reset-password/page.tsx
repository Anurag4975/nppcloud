"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Input } from "@/components/ui/core";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else { setDone(true); setTimeout(() => router.push("/dashboard"), 1500); }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Set new password</h1>
      <p className="mb-6 text-sm text-slate-500">Choose a new password for your account.</p>
      {done ? (
        <p className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-700">Password updated. Redirecting…</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input type="password" required minLength={8} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input type="password" required placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit">Update password</Button>
        </form>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </main>
  );
}
