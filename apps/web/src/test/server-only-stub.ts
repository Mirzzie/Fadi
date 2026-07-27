/**
 * Stub for the `server-only` package under vitest.
 *
 * `server-only` ships no runtime behaviour — inside Next's bundler it exists solely to
 * make a client-side import fail at build time. Outside Next it cannot be resolved at
 * all, so every module that imports it threw on load and was untestable.
 *
 * Aliasing it here (see vitest.config.ts) restores the server layer to the test runner.
 * It intentionally does nothing: the real guard belongs to the Next build, not to tests.
 */
export {};
