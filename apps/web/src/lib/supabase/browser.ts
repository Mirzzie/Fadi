import { createBrowserClient } from "@supabase/ssr";

import { assertSupabasePublicEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = assertSupabasePublicEnv();

  return createBrowserClient(url, anonKey);
}
