/**
 * Route-level loading state for every dashboard screen. The jobs board does live
 * source pulls (bounded ~3.5s) and most pages batch several reads — without this,
 * navigation shows a blank screen while the server works. Calm skeleton, no spin-hype.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-shell space-y-4 pt-2" aria-busy="true" aria-live="polite">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted/60" />
      <div className="h-24 animate-pulse rounded-xl border bg-muted/30" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl border bg-muted/30" />
        <div className="h-40 animate-pulse rounded-xl border bg-muted/30" />
      </div>
      <p className="text-sm text-muted-foreground">Loading your data…</p>
    </div>
  );
}
