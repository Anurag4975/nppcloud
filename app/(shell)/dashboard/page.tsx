import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

// Auth + onboarding checks now live in app/(shell)/layout.tsx, mounted once
// for every route in this group. Suspense boundary: DashboardClient reads
// useSearchParams() (for the folder-path history sync) which Next.js
// requires to be wrapped so this route can still be statically analyzed.
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardClient />
    </Suspense>
  );
}
