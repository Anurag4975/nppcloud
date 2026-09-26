"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, User, Ticket, Check, ArrowRight } from "lucide-react";
import { Button, Input, Label, Card, cn } from "@/components/ui";

type Plan = { id: string; name: string; quota_bytes: number; price_npr: number };

function formatGB(bytes: number): string {
  return `${(bytes / 1e9).toFixed(0)} GB`;
}

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
    fetch("/api/usage")
      .then(async (res) => {
        const json = await res.json();
        setCurrentPlan(json.plan?.name ?? null);
      })
      .catch(() => {});
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
      body: JSON.stringify({ name, accepted_terms: true, referral_code: referralCode || null }),
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
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-6 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
            <Cloud className="h-5 w-5 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold text-ink-900">NPP Cloud</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Welcome aboard</h1>
        <p className="mt-1 text-sm text-ink-500">
          You're on the <span className="font-medium text-ink-700">{currentPlan ?? "Free"}</span> plan —
          just a couple of details before you get started.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              required
              icon={<User className="h-4 w-4" />}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anurag Sharma"
              className="h-11"
            />
          </div>

          <div>
            <Label htmlFor="ref">Referral code (optional)</Label>
            <Input
              id="ref"
              icon={<Ticket className="h-4 w-4" />}
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="e.g. STUDENT20"
              className="h-11 uppercase"
            />
          </div>

          {plans.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-ink-600">Your plan</p>
              <div className="space-y-2">
                {plans.map((p) => {
                  const active = p.name === (currentPlan ?? "Free");
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-150",
                        active
                          ? "border-brand-300 bg-brand-50/60 shadow-soft"
                          : "border-ink-200 bg-white opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {active && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-ink-900">{p.name}</p>
                          <p className="text-[11px] text-ink-500">{formatGB(p.quota_bytes)} storage</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-ink-500">
                        {p.price_npr === 0 ? "Active now" : `NPR ${p.price_npr}/mo · soon`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-ink-500">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              I agree to the <span className="font-medium text-ink-700 underline underline-offset-2">Terms of Service</span> and{" "}
              <span className="font-medium text-ink-700 underline underline-offset-2">Privacy Policy</span>.
            </span>
          </label>

          {error && <p className="animate-fade-in text-sm text-red-600">{error}</p>}

          <Button
            type="submit"
            loading={submitting}
            className="h-11 w-full justify-center rounded-xl text-sm"
          >
            {submitting ? "Setting up…" : "Continue to NPP Cloud"} <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}
