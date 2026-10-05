/**
 * Dates that render identically on the server and in the browser.
 *
 * A bare toLocaleDateString() follows each machine's locale and time zone: the server wrote
 * "29/09/2026", the owner's browser "29/9/2026", and React threw a hydration error on Learning
 * (5 Oct 2026). UTC and fixed month names make both sides agree, and "29 Sep 2026" cannot be
 * misread as month-first.
 */
// Fixed names, not Intl: an explicit locale is still not enough. Node's ICU writes September
// as "Sept" in en-GB, many browsers write "Sep" — different CLDR data, same request — so the
// two sides of a hydration can disagree even with locale and time zone pinned.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "29 Sep 2026", or "" for a missing or invalid date. */
export function formatDay(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
