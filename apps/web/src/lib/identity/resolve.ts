/**
 * Entity resolution now lives in `@careeros/portfolio` (src/identity.ts).
 *
 * It had to move: the portfolio package's integrity checks need it, and a package
 * cannot import from the app. Keeping two copies would have been worse than the bug
 * it exists to fix — the CMS said "No duplicates found" about six duplicates while
 * the app-side resolver could see every one of them, because the two surfaces were
 * running different code.
 *
 * Re-exported here so existing importers keep working.
 */
export {
  compareIdentity,
  findSameThings,
  rareOverlap,
  rareTokens,
  rarityIndex,
  tokens,
  type IdentityInput,
  type IdentityMatch,
  type Verdict,
} from "@careeros/portfolio";
