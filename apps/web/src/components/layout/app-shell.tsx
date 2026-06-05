import { OsShell } from "@/components/os/os-shell";

/** Every authenticated screen renders inside the Career OS chrome (menu bar,
 *  dock, wallpaper, persistent Kai). */
export function AppShell({ children }: { children: React.ReactNode }) {
  return <OsShell>{children}</OsShell>;
}
