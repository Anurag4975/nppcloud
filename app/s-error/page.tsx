import { Link2Off, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Next.js 16: page props (searchParams, params) are now async — accessing
// them synchronously throws "used `searchParams`... must be unwrapped with
// `await`" at runtime, the same issue that broke the [id] route handlers.
export default async function ShareErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-6">
      <div className="w-full max-w-sm animate-slide-up text-center">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-900 text-white shadow-pop">
          <Link2Off className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Link unavailable</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          {message ?? "This link is no longer available."}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </div>
    </main>
  );
}
