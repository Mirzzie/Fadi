"use client";

import { KaiHome, type KaiOpportunity } from "@/components/os/kai-home";
import { useOsMode } from "@/components/os/os-mode";

/**
 * The Home app respects the OS mode: Desk shows the dashboard; Kai shows the
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
  opportunities?: KaiOpportunity[];
}) {
  const { mode } = useOsMode();
  return mode === "kai" ? (
    <KaiHome greeting={greeting} subline={subline} opportunities={opportunities} />
  ) : (
    <>{desk}</>
  );
}
