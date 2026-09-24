"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Plan = { id: string; name: string; quota_bytes: number; price_npr: number };

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usage").then(async (res) => {
      const json = await res.json();
      setCurrentPlan(json.plan?.name ?? null);
    });
    // Plans themselves are public-read, fetch directly from a small endpoint
    // (falls back to a static list if not available yet).
    fetch("/api/plans")
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((json) => setPlans(json.plans ?? []))
      .catch(() => setPlans([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedTerms) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        accepted_terms: true,
        referral_code: referralCode || null,
      }),
    });

    if (!res.ok) {
      const json = await res.json();
      setError(json.error?.message ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Welcome to MyCloud</h1>
      <p className="mb-6 text-sm text-slate-500">
        You're already set up on the Free plan{currentPlan ? ` (${currentPlan})` : ""} — just a couple of details before you get started.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Your name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder="Anurag Sharma"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Referral code (optional)</label>
          <input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-slate-500"
            placeholder="e.g. STUDENT20"
          />
        </div>

        {plans.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Plans</p>
            <div className="flex flex-col gap-2">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    p.name === "Free" ? "border-slate-800 bg-slate-50" : "border-slate-200 text-slate-400"
                  }`}
                >
                  <span>{p.name}</span>
                  <span>
                    {p.price_npr === 0 ? "Free — active now" : `NPR ${p.price_npr}/mo — coming soon`}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">Paid plans aren't live yet — you'll be notified the moment they are.</p>
          </div>
        )}

        <label className="flex items-start gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5" />
          I agree to the Terms of Service and Privacy Policy.
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? "Setting up…" : "Continue to MyCloud"}
        </button>
      </form>
    </main>
  );
}
