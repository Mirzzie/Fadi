/**
 * Dates that render identically on the server and in the browser.
 *
 * A bare toLocaleDateString() follows each machine's locale and time zone: the server wrote
 * "29/09/2026", the owner's browser "29/9/2026", and React threw a hydration error on Learning
 * (5 Oct 2026). An explicit locale and UTC make both sides agree, and "29 Sep 2026" cannot be
 * misread as month-first.
 */
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "29 Sep 2026", or "" for a missing or invalid date. */
export function formatDay(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : DAY.format(date);
}
