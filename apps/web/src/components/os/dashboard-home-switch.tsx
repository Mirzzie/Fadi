"use client";

import { ScoutHome, type ScoutOpportunity } from "@/components/os/scout-home";
import { useOsMode } from "@/components/os/os-mode";

/**
 * The Home app respects the OS mode: Desk shows the dashboard; Scout shows the
 * assistant-first core. The desk content is rendered on the server and passed
 * in, so both modes share the same fetched data.
 */
export function DashboardHomeSwitch({
  desk,
  greeting,
  subline,
  opportunities,
}: {
  desk: React.ReactNode;
  greeting: string;
  subline?: string;
  opportunities?: ScoutOpportunity[];
}) {
  const { mode } = useOsMode();
  return mode === "scout" ? (
    <ScoutHome greeting={greeting} subline={subline} opportunities={opportunities} />
  ) : (
    <>{desk}</>
  );
}
