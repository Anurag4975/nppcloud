"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function UnlockSharePage() {
  const params = useParams<{ id: string }>();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/s/${params.id}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Incorrect password.");
        setLoading(false);
        return;
      }
      window.location.href = json.download_url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm animate-slide-up rounded-2xl border border-ink-200/80 bg-white p-6 text-center shadow-pop"
      >
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-900 text-white shadow-pop">
          <Lock className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Password protected</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          This link's owner protected it with a password.
        </p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="mt-5 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition-colors focus:border-brand-400"
          style={{ backgroundColor: "#ffffff", color: "#111827" }}
        />
        {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="mt-4 w-full rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-ink-800 disabled:opacity-50"
        >
          {loading ? "Checking…" : "Unlock"}
        </button>
        <Link
          href="/login"
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </form>
    </main>
  );
}
