"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary — catches failures in the ROOT layout itself, which
 * `app/dashboard/error.tsx` cannot: a route-level boundary renders *inside* the
 * layout, so when the layout is what threw, there is nothing left to render it.
 * Without this file that case falls through to Next's raw crash screen.
 *
 * Two deliberate constraints, both consequences of replacing the root layout:
 *
 *  1. It must supply its own <html> and <body>. Next mounts this in place of the
 *     root layout, so the document shell it normally provides is gone.
 *
 *  2. Styling is inline, not Tailwind or the design system. If the root layout
 *     failed, the global stylesheet may never have loaded and any imported
 *     component could be part of what broke. A boundary that depends on the thing
 *     it is catching is not a boundary. Inline styles always render.
 *
 * Theme-aware via prefers-color-scheme, since there is no <ThemeProvider> here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server already logged the real error; this is the client breadcrumb.
    // `digest` is the only identifier that ties this screen to the server log.
    console.error("app.global_error", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: "#ffffff",
          color: "#0a0a0a",
        }}
      >
        <style>{`
          @media (prefers-color-scheme: dark) {
            body { background-color: #0a0a0a !important; color: #fafafa !important; }
            .ge-muted { color: #a1a1aa !important; }
            .ge-button { background-color: #fafafa !important; color: #0a0a0a !important; }
            .ge-digest { color: #71717a !important; }
          }
        `}</style>
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.75rem" }}>
            Something broke on our side
          </h1>
          <p
            className="ge-muted"
            style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "#52525b", margin: "0 0 1.25rem" }}
          >
            That&apos;s on us, not you. Nothing you saved has been lost. Reloading usually clears
            it — if it doesn&apos;t, sign out and back in.
          </p>
          <button
            className="ge-button"
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              backgroundColor: "#0a0a0a",
              color: "#fafafa",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            // Shown so a user reporting the problem can quote it and we can find the
            // exact server log line. It is an opaque hash, not error internals.
            <p
              className="ge-digest"
              style={{ fontSize: "0.75rem", color: "#a1a1aa", margin: "1.25rem 0 0" }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
