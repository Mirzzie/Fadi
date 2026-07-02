import Link from "next/link";

/** Honest 404 — no dead end: name the problem, point back to the work. */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">This page doesn&apos;t exist</h1>
      <p className="text-sm text-muted-foreground">
        The link may be stale — a job or document it pointed to might have been removed.
      </p>
      <Link
        href="/dashboard"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Back to your dashboard
      </Link>
    </div>
  );
}
