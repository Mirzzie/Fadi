"use server";

import { createGithubConnectionsRepository, createPortfolioRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import { buildPortfolioSite, pagesBasePath } from "@/lib/portfolio/build-export";
import { buildPagesDeployWorkflow, GitHubClient, GitHubError, pagesUrl } from "@/lib/portfolio/github";
import { toPortfolioView } from "@/lib/portfolio/view";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";

/**
 * GitHub portfolio publishing (ADR 0008). The token is a BYO fine-grained PAT, encrypted
 * at rest (crypto.ts) and NEVER logged. Publishing generates the snapshot server-side and
 * pushes it to the user's repo, then enables Pages.
 */

type Result<T = unknown> = { ok: true; data: T } | { ok: false; message: string };

/** Safe, token-free view of the connection for the UI. */
export type GithubConnectionView = {
  connected: boolean;
  githubLogin: string | null;
  repo: string | null;
  pagesUrl: string | null;
  autoRefresh: boolean;
  tokenHint: string | null;
  lastPublishedAt: string | null;
};

function githubFetch(): (typeof globalThis)["fetch"] {
  return globalThis.fetch;
}

/** The real-fetch client wrapper — keeps the pure client (github.ts) network-free. */
function clientFor(token: string): GitHubClient {
  const f = githubFetch();
  return new GitHubClient(token, (url, init) =>
    f(url, init as RequestInit).then((r) => ({
      ok: r.ok,
      status: r.status,
      json: () => r.json(),
      text: () => r.text(),
    })),
  );
}

export async function getGithubConnection(): Promise<GithubConnectionView> {
  const user = await getCurrentAuthUser();
  const empty: GithubConnectionView = {
    connected: false,
    githubLogin: null,
    repo: null,
    pagesUrl: null,
    autoRefresh: false,
    tokenHint: null,
    lastPublishedAt: null,
  };
  if (!user) return empty;
  const row = await createGithubConnectionsRepository(getDatabase()).getByUserId(user.id);
  if (!row) return empty;
  return {
    connected: true,
    githubLogin: row.githubLogin,
    repo: row.repo,
    pagesUrl: row.pagesUrl,
    autoRefresh: row.autoRefresh,
    tokenHint: row.tokenHint,
    lastPublishedAt: row.lastPublishedAt?.toISOString() ?? null,
  };
}

/**
 * Store a GitHub PAT after validating it against the API. Validation doubles as UX: a
 * bad/expired/wrong-scope token fails HERE with a clear message rather than at publish.
 */
export async function connectGithub(input: { token: string }): Promise<Result<{ login: string }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const token = input.token.trim();
  if (!token) return { ok: false, message: "Paste your GitHub token." };

  try {
    const login = await clientFor(token).getAuthenticatedLogin();
    await createGithubConnectionsRepository(getDatabase()).upsert({
      userId: user.id,
      tokenCiphertext: encryptSecret(token),
      tokenHint: token.slice(-4),
      githubLogin: login,
    });
    // Never log the token; login is safe.
    logger.info("github.connected", { userId: user.id, login });
    return { ok: true, data: { login } };
  } catch (error) {
    if (error instanceof GitHubError) {
      return { ok: false, message: `GitHub rejected the token: ${error.message}` };
    }
    logger.error("github.connect_failed", {
      userId: user.id,
      error: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, message: "Couldn't reach GitHub. Try again." };
  }
}

export async function disconnectGithub(): Promise<Result<null>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  await createGithubConnectionsRepository(getDatabase()).deleteForUser(user.id);
  logger.info("github.disconnected", { userId: user.id });
  return { ok: true, data: null };
}

/**
 * Publish the FULL static portfolio site to GitHub Pages (ADR 0009).
 *
 * Phase A (always): create the repo if needed → commit index.html + .nojekyll → enable
 * Pages. Works from any Fadi (even localhost) because Fadi pushes the built HTML itself.
 *
 * Phase B (enableAutoRefresh): also commit the refresh workflow and fire a dispatch. The
 * workflow only *functions* when Fadi is reachable at a public origin (the runner curls
 * the snapshot endpoint) — surfaced honestly to the caller when the origin is unset.
 */
export async function publishToGithub(input: {
  repo: string;
  enableAutoRefresh?: boolean;
  /** DESTRUCTIVE (ADR 0008): replace ALL files in the repo with only Fadi's, in one
   *  commit. Only ever passed after an explicit user confirmation in the UI. */
  replaceExisting?: boolean;
}): Promise<Result<{ pagesUrl: string; autoRefreshActive: boolean; note?: string }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const repoName = input.repo.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!repoName) return { ok: false, message: "Give the repository a name (e.g. \"portfolio\")." };

  // A publish is several GitHub writes + repo creation; cap it so a stuck button can't
  // hammer GitHub or the user's rate limit.
  const rate = await consumeRateLimit({
    key: `github-publish:${user.id}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return { ok: false, message: "That's a lot of publishes in one hour — give it a few minutes." };
  }

  const db = getDatabase();
  const connections = createGithubConnectionsRepository(db);
  const conn = await connections.getByUserId(user.id);
  if (!conn) return { ok: false, message: "Connect your GitHub account first." };

  const token = decryptSecret(conn.tokenCiphertext);
  if (!token) return { ok: false, message: "Your stored token is unreadable — reconnect GitHub." };

  // Resolve the user's published site + render the snapshot server-side (one renderer).
  const portfolio = createPortfolioRepository(db);
  const sites = await portfolio.listSitesForUser(user.id).catch(() => []);
  const site = sites[0];
  if (!site) return { ok: false, message: "Create your portfolio first." };
  const published = await portfolio.getPublishedByHandle(site.handle);
  if (!published) {
    return { ok: false, message: "Publish your portfolio inside Fadi first (it's still a draft)." };
  }
  const view = toPortfolioView(published.site, published.items);

  try {
    const gh = clientFor(token);
    const login = conn.githubLogin || (await gh.getAuthenticatedLogin());

    // Decide create-vs-reuse from the token's ACTUAL view of the repo, and turn the
    // fine-grained-token failure modes into guidance instead of GitHub's opaque 403.
    const state = await gh.repoStatus(login, repoName);
    if (state === "no_access") {
      return {
        ok: false,
        message: `Your token can't access "${repoName}". Fine-grained tokens only reach the repositories you select — open the token settings and grant it access to this repo (Contents, Pages, Administration: read & write).`,
      };
    }
    if (state === "missing") {
      try {
        await gh.createRepo(repoName);
      } catch (e) {
        if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) {
          return {
            ok: false,
            message: `Couldn't create "${repoName}". Fine-grained tokens usually can't create repositories. Either create an empty repo named "${repoName}" on GitHub first (then grant the token access to it), or use a classic token with the "repo" scope.`,
          };
        }
        throw e;
      }
    }

    const branch = state === "exists" ? await gh.getDefaultBranch(login, repoName) : "main";

    // Build the FULL static site (ADR 0009) — the real template with framer-motion
    // animations and case studies, NOT the old single-file snapshot. Data is baked in and
    // the assets are base-path-aware for this repo's Pages URL.
    let siteFiles;
    try {
      siteFiles = await buildPortfolioSite({ view, basePath: pagesBasePath(login, repoName) });
    } catch (e) {
      logger.error("github.export_build_failed", {
        userId: user.id,
        error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      });
      return { ok: false, message: "Couldn't build your portfolio site — please try again." };
    }

    // .nojekyll is REQUIRED so GitHub Pages serves the _next/ folder (underscore-prefixed,
    // which Jekyll would otherwise skip). The whole site replaces the repo contents.
    const nojekyll = { path: ".nojekyll", content: "", encoding: "utf-8" as const };
    const deployWf = {
      path: ".github/workflows/deploy.yml",
      content: buildPagesDeployWorkflow(branch),
      encoding: "utf-8" as const,
    };

    // PREFER the Actions workflow; if the token lacks the "Workflows" permission (can't
    // write .github/workflows/), FALL BACK to branch-serving — which serves the same
    // static site directly with no workflow file. Either way the full site goes live.
    let deployedVia: "workflow" | "branch" = "workflow";
    let note: string | undefined;
    try {
      await gh.replaceAllFiles({
        owner: login,
        repo: repoName,
        branch,
        files: [...siteFiles, nojekyll, deployWf],
        message: "Publish portfolio site from Fadi",
      });
      await gh.ensureActionsPages(login, repoName);
      note = "Deploying via a GitHub Actions workflow — watch the run in your repo's Actions tab. Live in ~1 minute.";
    } catch (e) {
      if (!(e instanceof GitHubError)) throw e;
      await gh.replaceAllFiles({
        owner: login,
        repo: repoName,
        branch,
        files: [...siteFiles, nojekyll],
        message: "Publish portfolio site from Fadi (branch-served)",
      });
      await gh.ensureBranchPages(login, repoName, branch);
      deployedVia = "branch";
      note =
        `Deploying straight from the ${branch} branch (no workflow needed) — Fadi couldn't add a GitHub Actions workflow, which needs the token's “Workflows” permission. Add it to use the Actions pipeline instead.`;
    }

    const url = pagesUrl(login, repoName);
    await connections.markPublished(user.id, {
      repo: repoName,
      pagesUrl: url,
      githubLogin: login,
      autoRefresh: false,
    });
    logger.info("github.published", {
      userId: user.id,
      repo: repoName,
      deployedVia,
      files: siteFiles.length,
    });
    return { ok: true, data: { pagesUrl: url, autoRefreshActive: false, note } };
  } catch (error) {
    if (error instanceof GitHubError) {
      // A 403 past the repo check means the repo is reachable but a specific permission
      // (Contents/Pages/Administration write) is missing — say so, don't echo the raw line.
      if (error.status === 403) {
        return {
          ok: false,
          message: `GitHub blocked the write to "${repoName}". Grant the token Contents, Pages and Administration (read & write) on this repo, then try again. (GitHub: ${error.message})`,
        };
      }
      return { ok: false, message: `GitHub: ${error.message}` };
    }
    logger.error("github.publish_failed", {
      userId: user.id,
      error: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, message: "Publish failed. Check your token's repo permissions and try again." };
  }
}

/**
 * Preflight a target repo so the UI can WARN before overwriting an existing site. Reports
 * whether the repo already has an index.html and any non-Fadi files that a merge-publish
 * would leave live. Non-destructive — reads only.
 */
export async function inspectGithubRepo(input: {
  repo: string;
}): Promise<Result<{ exists: boolean; hasIndex: boolean; foreign: string[] }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const repoName = input.repo.trim();
  if (!repoName) return { ok: true, data: { exists: false, hasIndex: false, foreign: [] } };

  const conn = await createGithubConnectionsRepository(getDatabase()).getByUserId(user.id);
  if (!conn) return { ok: false, message: "Connect your GitHub account first." };
  const token = decryptSecret(conn.tokenCiphertext);
  if (!token) return { ok: false, message: "Your stored token is unreadable — reconnect GitHub." };

  try {
    const gh = clientFor(token);
    const login = conn.githubLogin || (await gh.getAuthenticatedLogin());
    const state = await gh.repoStatus(login, repoName);
    if (state !== "exists") return { ok: true, data: { exists: false, hasIndex: false, foreign: [] } };
    const root = await gh.listRootFiles(login, repoName);
    return { ok: true, data: { exists: true, hasIndex: root.hasIndex, foreign: root.foreign } };
  } catch (error) {
    if (error instanceof GitHubError) return { ok: false, message: `GitHub: ${error.message}` };
    return { ok: false, message: "Couldn't inspect the repository." };
  }
}

/**
 * The repos the connected token can reach — powers the repo picker so the user targets a
 * repo the token genuinely has access to, instead of typing a name blindly.
 */
export async function getGithubRepos(): Promise<Result<{ repos: string[] }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const conn = await createGithubConnectionsRepository(getDatabase()).getByUserId(user.id);
  if (!conn) return { ok: false, message: "Connect your GitHub account first." };
  const token = decryptSecret(conn.tokenCiphertext);
  if (!token) return { ok: false, message: "Your stored token is unreadable — reconnect GitHub." };
  try {
    const repos = await clientFor(token).listRepos();
    return { ok: true, data: { repos: repos.map((r) => r.name) } };
  } catch (error) {
    if (error instanceof GitHubError) return { ok: false, message: `GitHub: ${error.message}` };
    return { ok: false, message: "Couldn't list your repositories." };
  }
}
