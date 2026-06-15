import { cn } from "@/lib/utils";

/**
 * FadiOS logo — a calligraphic nod to فادي ("one who helps / saves"). The mark is
 * a flowing brush form of the Arabic letter ف (fā, the initial of فادي): an open
 * bowl that sweeps into a rising tail, crowned by the letter's single dot. Rendered
 * in the brand aurora gradient (teal → violet).
 *
 * - variant="tile"  → rounded app-icon square (white mark on the gradient).
 * - variant="mark"  → the stroke alone in the gradient, on a transparent ground.
 * Size with a className (e.g. `size-5`).
 */
export function FadiLogo({
  className,
  variant = "tile",
  title = "FadiOS",
}: {
  className?: string;
  variant?: "tile" | "mark";
  title?: string;
}) {
  // Deterministic id (no hook → works in Server Components). Duplicate defs across
  // instances are harmless: url(#id) resolves to the first, and the stops match.
  const gid = `fadi-logo-${variant}`;
  const stroke = variant === "tile" ? "white" : `url(#${gid})`;

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn(variant === "tile" && "rounded-[28%]", className)}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.72 0.19 192)" />
          <stop offset="1" stopColor="oklch(0.66 0.22 285)" />
        </linearGradient>
      </defs>

      {variant === "tile" ? <rect width="64" height="64" rx="17" fill={`url(#${gid})`} /> : null}

      {/* ف — open calligraphic bowl sweeping into a rising tail */}
      <path
        d="M40 49 A12.5 12.5 0 1 1 44 34 C46 27 44 22 50 20"
        fill="none"
        stroke={stroke}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the dot of ف */}
      <circle cx="33" cy="16" r="3.6" fill={stroke} />
    </svg>
  );
}
