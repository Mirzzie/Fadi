/**
 * WHERE A PROJECT'S WORK LIVES.
 *
 * The owner's correction, and it settles a question I had answered badly: Fadi was about to
 * create a GitHub repository automatically on every commit. That is an outward action on
 * someone's account, taken without asking, for a project they may abandon in an hour.
 *
 * It is their choice. Local is the default because it needs no account, no token, and
 * nothing leaves the machine — which is what this product is supposed to be. GitHub and
 * GitLab are things they pick, when they decide the work is worth pushing.
 */

export type WorkspaceKind = "local" | "github" | "gitlab";

export const DEFAULT_WORKSPACE: WorkspaceKind = "local";

/**
 * A folder or repository name from a project title.
 *
 * Deliberately narrow: lowercase, digits, single dashes, bounded. It becomes a directory
 * inside the workspace jail and possibly a repository name, and both are happier without
 * apostrophes, slashes or the word "&".
 */
export function workspaceSlug(title: string): string {
  const slug = (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  // Everything can fail to produce a name — a title of only punctuation, or of a script
  // this regex strips entirely. A fallback beats an empty path.
  return slug || "project";
}

/**
 * Does this deserve a workspace at all?
 *
 * Only things that produce files. A workspace per certification leaves a trail of empty
 * folders, and an empty folder named after something you did not finish is worse than no
 * folder at all.
 */
export function deservesWorkspace(kind: string): boolean {
  return kind === "project";
}
