/**
 * SILENCE ONE DEV-ONLY REACT ERROR THAT LOOKS LIKE A CRASH.
 *
 * React's Server Components profiler (Next's bundled react-server-dom-turbopack) reports each
 * server component to the browser's performance timeline in development. When the server began
 * rendering before the tab's own clock started — an ordinary thing on a warm dev server — it
 * hands performance.measure a negative start time, which throws:
 *
 *   Failed to execute 'measure' on 'Performance': '<zero-width space>DashboardPage'
 *   cannot have a negative time stamp.
 *
 * Nothing is broken: the page has already rendered. But Next's error overlay shows it as a
 * runtime TypeError, so the owner sees what looks like a crash on Dashboard, Sign-up and
 * Evidence, on every other refresh.
 *
 * This swallows exactly that one case — a TypeError from measuring React's own component track,
 * whose names carry a zero-width space prefix — and rethrows everything else, so a real
 * performance bug in our code still surfaces. Development only; the profiler does not run in a
 * production build.
 *
 * The real fix belongs upstream (the version of Next that bundles the corrected profiler). This
 * is here so the owner can work in the meantime.
 */
if (process.env.NODE_ENV !== "production" && typeof performance !== "undefined") {
  const measure = performance.measure.bind(performance);
  performance.measure = function guardedMeasure(
    name: string,
    startOrOptions?: string | PerformanceMeasureOptions,
    end?: string
  ) {
    try {
      return measure(name, startOrOptions as never, end as never);
    } catch (error) {
      const reactComponentTrack = typeof name === "string" && name.startsWith("​");
      if (reactComponentTrack && error instanceof TypeError) {
        return undefined as unknown as PerformanceMeasure;
      }
      throw error;
    }
  } as typeof performance.measure;
}
