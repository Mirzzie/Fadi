import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  GraduationCap,
  LayoutDashboard,
  MessageSquareText,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const appNavigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/dashboard/learning", label: "Learning", icon: GraduationCap },
  { href: "/dashboard/kai", label: "Ask Kai", icon: MessageSquareText },
];

export type NavGroup = { label: string; items: NavItem[] };

export const appNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Career",
    items: [
      { href: "/dashboard/jobs", label: "Jobs", icon: BriefcaseBusiness },
      { href: "/dashboard/learning", label: "Learning", icon: GraduationCap },
    ],
  },
  {
    label: "Kai",
    items: [{ href: "/dashboard/kai", label: "Ask Kai", icon: MessageSquareText }],
  },
  {
    label: "Account",
    items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
];
