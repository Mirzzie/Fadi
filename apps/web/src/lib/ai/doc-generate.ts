import type { ZodSchema } from "zod";

/**
 * The model-generation capability, bound to a user's provider by the caller.
 *
 * This interface is the AI layer's OWN contract, and it lives here on purpose. It used
 * to live in `lib/documents/generate.ts`, which forced `lib/ai/user-generate` to import
 * a domain module just to describe its own return type — the reverse edge of the
 * `lib/ai ↔ lib/documents` import cycle. Dependencies now flow one way: domains depend
 * on `lib/ai` for generation; `lib/ai` depends only on providers and types, never back
 * on a domain. (Part of the lib/ai dependency-inversion — see docs/ARCHITECTURE_ASSESSMENT.md.)
 */
export interface DocGenerate {
  structured<T>(system: string, user: string, schema: ZodSchema<T>, name: string): Promise<T>;
  text(system: string, user: string): Promise<string>;
}
