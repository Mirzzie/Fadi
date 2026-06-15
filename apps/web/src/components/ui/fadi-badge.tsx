import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

type FadiBadgeProps = {
  size?: "xs" | "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
};

export function FadiBadge({ size = "sm", showName = true, className }: FadiBadgeProps) {
  const avatarSize = {
    xs: "size-5",
    sm: "size-7",
    md: "size-9",
    lg: "size-12",
  }[size];

  const iconSize = {
    xs: "size-2.5",
    sm: "size-3.5",
    md: "size-4.5",
    lg: "size-6",
  }[size];

  const dotSize = {
    xs: "size-1.5",
    sm: "size-2",
    md: "size-2.5",
    lg: "size-3",
  }[size];

  const nameSize = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  }[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative shrink-0">
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-primary",
            avatarSize,
          )}
        >
          <Sparkles className={cn("text-primary-foreground", iconSize)} aria-hidden="true" />
        </div>
        <div
          className={cn(
            "absolute -right-0.5 bottom-0 rounded-full bg-emerald-400 ring-2 ring-background",
            dotSize,
          )}
          aria-hidden="true"
        />
      </div>
      {showName ? (
        <span className={cn("font-semibold text-primary", nameSize)}>Fadi</span>
      ) : null}
    </div>
  );
}
