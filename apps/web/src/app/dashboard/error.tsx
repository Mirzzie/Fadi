"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary for the dashboard. Without it, any uncaught server
 * error showed Next's raw crash screen. Honest and calm: say it broke, offer a
 * retry, never blame the user. (Details go to the server logs, not the screen.)
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side breadcrumb; the server already logged the real error.
    console.error("dashboard.route_error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-24 text-center">
      <h1 className="font-heading text-3xl font-medium tracking-tight">This page couldn’t load</h1>
      <p className="text-sm text-muted-foreground">
        Try again before continuing. If you were editing, check the latest saved version when the
        page returns.
      </p>
      <Button size="sm" onClick={reset}>
        <RotateCcw className="size-4" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
