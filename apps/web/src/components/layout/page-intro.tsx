import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./page-intro.module.css";

/** Shared work-page hierarchy, not a marketing hero or a new navigation surface. */
export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <header
      data-slot="page-intro"
      data-fadi-reveal
      className={cn(styles.header, compact && styles.compact, className)}
    >
      <div className={styles.copy}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {description ? <div className={styles.description}>{description}</div> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
