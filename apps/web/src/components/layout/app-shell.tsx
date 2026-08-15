import { cookies } from "next/headers";

import { OsShell } from "@/components/os/os-shell";
import { MODE_COOKIE, type CareerMode } from "@/app/dashboard/mode-actions";

/** Every authenticated screen renders inside the Fadi chrome (menu bar, dock, wallpaper,
 *  persistent Fadi). Reads the career phase from a cookie server-side so the shell paints the
 *  right mode on the first render — no flash, no hydration mismatch. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const cookieMode = (await cookies()).get(MODE_COOKIE)?.value;
  const initialMode: CareerMode = cookieMode === "prepare" ? "prepare" : "apply";
  return <OsShell initialMode={initialMode}>{children}</OsShell>;
}
