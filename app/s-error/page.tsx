export default function ShareErrorPage({ searchParams }: { searchParams: { message?: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-2 text-lg font-semibold text-slate-800">Link unavailable</h1>
      <p className="text-sm text-slate-500">{searchParams.message ?? "This link is no longer available."}</p>
    </main>
  );
}
