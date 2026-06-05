import "server-only";

import type { DocGenerate } from "@/lib/documents/generate";
import { buildProviderChain } from "./registry";
import { getUserProviderConfigs } from "./user-settings";

/** Build the document-generation capability from the user's configured provider. */
export async function getUserDocGenerate(userId: string): Promise<DocGenerate | null> {
  const chain = buildProviderChain(await getUserProviderConfigs(userId));
  const provider = chain[0];
  if (!provider) return null;
  return {
    structured: (system, user, schema, name) =>
      provider.parseStructured(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        schema,
        name,
        { temperature: 0.4 },
      ),
    text: (system, user) =>
      provider.chat(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { temperature: 0.6 },
      ),
  };
}
