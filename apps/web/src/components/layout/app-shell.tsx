import { OsShell } from "@/components/os/os-shell";

/** Every authenticated screen renders inside the Fadi chrome (menu bar,
 *  dock, wallpaper, persistent Fadi). */
export function AppShell({ children }: { children: React.ReactNode }) {
  return <OsShell>{children}</OsShell>;
}
