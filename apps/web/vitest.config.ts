import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the pure logic that powers matching, document quality and
// freshness — no DB, no network, no React. Fast and deterministic.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is not an installed package — Next resolves it inside its own
      // bundler, where it exists purely to make a client import fail loudly. Outside
      // Next it is unresolvable, which meant every module carrying `import
      // "server-only"` threw on load and could not be tested AT ALL.
      //
      // That is the real cause of the "inverted test coverage" finding in
      // ARCHITECTURE_ASSESSMENT.md: coverage clustered in the pure modules not because
      // the coupled ones were skipped, but because they were structurally unloadable by
      // the test runner. Mapping it to an empty stub makes the server layer testable.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
