import { cookies } from "next/headers";

import { createCareerProfilesRepository } from "@careeros/database";

import { OsShell } from "@/components/os/os-shell";
import { MODE_COOKIE, type CareerMode } from "@/app/dashboard/mode";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";

/** Every authenticated screen renders inside the Fadi chrome (menu bar, dock, wallpaper,
 *  persistent Fadi). Reads the career phase from a cookie server-side so the shell paints the
 *  right mode on the first render — no flash, no hydration mismatch.
 *
 *  Also reads the ACTIVE career direction and passes its id as a remount key: switching
 *  directions must transform the WHOLE page to the new track's data. Server components re-read
 *  the active track on refresh, but client components that seed local state from track props
 *  (e.g. the mock-interview form) would keep the old direction's values — remounting on the
 *  track key forces every page subtree to re-seed from the new track. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const cookieMode = (await cookies()).get(MODE_COOKIE)?.value;
  const initialMode: CareerMode = cookieMode === "prepare" ? "prepare" : "apply";

  const user = await getCurrentAuthUser();
  const activeTrack = user
    ? await createCareerProfilesRepository(getDatabase()).getActiveForUser(user.id)
    : null;
  const activeTrackKey = activeTrack?.id ?? "none";

  return (
    <OsShell initialMode={initialMode} activeTrackKey={activeTrackKey}>
      {children}
    </OsShell>
  );
}
