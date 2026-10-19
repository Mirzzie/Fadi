import {
  BriefcaseBusiness,
  Settings,
  UserRoundCog,
  GraduationCap,
  Layers,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

/**
 * Four destinations, and everything in the product lives inside one of them.
 *
 * The dock used to carry ten icons whose labels only appeared on hover, ordered by a phase
 * switch. Ten peers is not a structure — it is a list you re-read every time, and a label you
 * have to hover for is a label nobody has.
 *
 * Each destination names its areas. The active destination exposes those areas from the dock,
 * and they decide which destination is lit: a route belongs to exactly one.
 */
export type NavArea = { href: string; label: string };

export type Destination = {
  href: string;
  label: string;
  /** What the person expects to find here, in their words. */
  blurb: string;
  icon: LucideIcon;
  areas: NavArea[];
};

export const DESTINATIONS: Destination[] = [
  {
    href: "/dashboard",
    label: "Today",
    blurb: "What matters now.",
    icon: LayoutDashboard,
    areas: [
      { href: "/dashboard", label: "Today" },
      { href: "/dashboard/overview", label: "The full picture" },
      { href: "/dashboard/report", label: "Career report" },
    ],
  },
  {
    href: "/dashboard/jobs",
    label: "Opportunities",
    blurb: "Find roles, apply, follow up.",
    icon: BriefcaseBusiness,
    areas: [
      { href: "/dashboard/jobs", label: "Roles" },
      { href: "/dashboard/applications", label: "Applications" },
      { href: "/dashboard/network", label: "People" },
    ],
  },
  {
    href: "/dashboard/learning",
    label: "Practice",
    blurb: "Learn, build proof, rehearse.",
    icon: GraduationCap,
    areas: [
      { href: "/dashboard/learning", label: "Learning" },
      { href: "/dashboard/interview", label: "Interview practice" },
    ],
  },
  {
    href: "/dashboard/evidence",
    label: "My career",
    blurb: "Your record, and what you share from it.",
    icon: Layers,
    areas: [
      { href: "/dashboard/evidence", label: "My record" },
      { href: "/dashboard/documents", label: "CVs and letters" },
      { href: "/dashboard/portfolio", label: "Portfolio" },
      // No "Directions" entry: /dashboard/tracks has actions and no page, and switching or
      // creating a direction already lives in the switcher at the top of every screen. A
      // labelled destination that 404s is worse than one fewer label.
    ],
  },
];

/** Longest matching area wins, so /dashboard/documents is not swallowed by /dashboard. */
export function destinationFor(pathname: string): Destination | null {
  let best: { destination: Destination; length: number } | null = null;
  for (const destination of DESTINATIONS) {
    for (const area of destination.areas) {
      const matches = area.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(area.href);
      if (matches && (!best || area.href.length > best.length)) {
        best = { destination, length: area.href.length };
      }
    }
  }
  // Routes with no area of their own (profile, settings, the niche finder) belong to nobody
  // on purpose: they are reached from the account menu or from the question that raises them.
  return best?.destination ?? null;
}

export function areaFor(pathname: string): NavArea | null {
  const destination = destinationFor(pathname);
  if (!destination) return null;
  let best: { area: NavArea; length: number } | null = null;
  for (const area of destination.areas) {
    const matches = area.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(area.href);
    if (matches && (!best || area.href.length > best.length)) best = { area, length: area.href.length };
  }
  return best?.area ?? null;
}

/**
 * Every place a person can go, flattened for search. Each one carries the destination it
 * lives in, so "Applications" reads as "Applications · Opportunities" and the four-part
 * structure is taught by the search box as well as by the dock.
 */
export type NavTarget = { href: string; label: string; within: string; icon: LucideIcon };

export const NAV_TARGETS: NavTarget[] = [
  ...DESTINATIONS.flatMap((destination) =>
    destination.areas.map((area) => ({
      href: area.href,
      label: area.label,
      within: destination.label,
      icon: destination.icon,
    }))
  ),
  // Reached from the account menu, not the dock — but still worth finding by name.
  { href: "/dashboard/profile", label: "Profile", within: "Account", icon: UserRoundCog },
  { href: "/dashboard/settings", label: "Settings", within: "Account", icon: Settings },
];
