import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React 19's newer hooks lints (React Compiler era). They flag legitimate
      // "sync external state on mount" and "read a ref" patterns in our voice /
      // OS-shell hooks that work correctly and are awkward to satisfy without
      // useSyncExternalStore gymnastics. Keep them VISIBLE as warnings (so new
      // code is nudged) rather than blocking the lint gate. Revisit with the
      // React Compiler.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
