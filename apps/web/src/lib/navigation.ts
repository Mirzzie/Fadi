import type { LucideIcon } from "lucide-react";
import { BriefcaseBusiness, GraduationCap, LayoutDashboard, MessageSquareText } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const appNavigation: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/jobs",
    label: "Jobs",
    icon: BriefcaseBusiness,
  },
  {
    href: "/dashboard/learning",
    label: "Learning",
    icon: GraduationCap,
  },
  {
    href: "/dashboard/kai",
    label: "Ask Kai",
    icon: MessageSquareText,
  },
];
