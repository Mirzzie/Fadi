import { describe, expect, it } from "vitest";

import {
  buildPagesDeployWorkflow,
  buildRefreshWorkflow,
  GitHubClient,
  GitHubError,
  pagesBasePath,
  pagesUrl,
  toBase64,
  type FetchLike,
} from "./github";
import { buildSnapshotHtml, escapeHtml, inlineJson, snapshotTitle } from "./snapshot";

/** A fake fetch that records requests and replays a scripted queue of responses. */
function fakeFetch(
  script: Array<{ status: number; body?: unknown }>,
): { fetch: FetchLike; calls: Array<{ url: string; method: string; body?: string; headers?: Record<string, string> }> } {
  const calls: Array<{ url: string; method: string; body?: string; headers?: Record<string, string> }> = [];
  let i = 0;
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body, headers: init?.headers });
    const step = script[i++] ?? { status: 500 };
    return {
      ok: step.status < 400,
      status: step.status,
      json: async () => step.body ?? null,
      text: async () => JSON.stringify(step.body ?? null),
    };
  };
  return { fetch, calls };
}

describe("snapshot builder", () => {
  it("bakes the data in and mounts it without a server", () => {
    const html = buildSnapshotHtml({ sdk: "/*SDK*/", view: { site: { title: "Me" }, items: [] }, handle: "me" });
    expect(html).toContain("<script>/*SDK*/</script>");
    expect(html).toContain("FadiPortfolio.mountData(");
    expect(html).not.toContain("portfolio.js"); // self-contained, no external fetch
  });

  it("escapes </script> in the data so it cannot break out of the tag", () => {
    // The injection guard: a description containing "</script>" must not close the tag.
    const evil = { site: { title: "x" }, items: [{ description: "</script><img src=x onerror=alert(1)>" }] };
    const html = buildSnapshotHtml({ sdk: "", view: evil, handle: "me" });
    expect(html).not.toContain("</script><img");
    expect(html).toContain("\\u003c/script>");
  });

  it("escapes </script> in the SDK so the inlined script cannot break out", () => {
    // THE BUG THIS PINS: the real SDK's doc comment contains example </script> tags. Inlined
    // raw, the first one closed the <script> early → FadiPortfolio never defined → the whole
    // page rendered blank. Found by rendering the snapshot offline, not by byte-count.
    const sdk = "/* usage: <script src=x></script> */ window.FadiPortfolio = {};";
    const html = buildSnapshotHtml({ sdk, view: { site: { title: "x" }, items: [] }, handle: "h" });
    // The only real </script> in the doc must be the tag Fadi itself closes with — the
    // SDK's example one must be escaped so it can't terminate the block early.
    const firstClose = html.indexOf("</script>");
    expect(html.slice(0, firstClose)).toContain("window.FadiPortfolio"); // full SDK survived
    expect(html).toContain("<\\/script"); // the example tag was escaped
  });

  it("derives the title from name → title → handle → default", () => {
    expect(snapshotTitle({ site: { profile: { name: "Ada" }, title: "T" }, handle: "h" })).toBe("Ada");
    expect(snapshotTitle({ site: { profile: null, title: "T" }, handle: "h" })).toBe("T");
    expect(snapshotTitle({ site: { title: "" }, handle: "h" })).toBe("h");
    expect(snapshotTitle({})).toBe("Portfolio");
  });

  it("escapes the title into the <title> tag", () => {
    const html = buildSnapshotHtml({ sdk: "", view: { site: { title: "A & B <x>" } }, handle: "h" });
    expect(html).toContain("<title>A &amp; B &lt;x&gt; — Portfolio</title>");
  });

  it("inlineJson escapes every angle bracket", () => {
    expect(inlineJson({ a: "<b>" })).toBe('{"a":"\\u003cb>"}');
    expect(escapeHtml('a<b>&"')).toBe("a&lt;b&gt;&amp;&quot;");
  });
});

describe("GitHubClient — request construction", () => {
  it("sends bearer auth and the API version header", async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, body: { login: "ada" } }]);
    const login = await new GitHubClient("tok_secret", fetch).getAuthenticatedLogin();
    expect(login).toBe("ada");
    expect(calls[0].url).toBe("https://api.github.com/user");
    expect(calls[0].headers?.authorization).toBe("Bearer tok_secret");
    expect(calls[0].headers?.["x-github-api-version"]).toBe("2022-11-28");
  });

  it("repoStatus distinguishes exists / missing / no_access", async () => {
    // The three states drive different UX: reuse, create, or "grant access". A fine-
    // grained token not scoped to the repo returns 403 — NOT the same as "create it".
    const exists = fakeFetch([{ status: 200 }]);
    const missing = fakeFetch([{ status: 404 }]);
    const denied = fakeFetch([{ status: 403 }]);
    expect(await new GitHubClient("t", exists.fetch).repoStatus("ada", "p")).toBe("exists");
    expect(await new GitHubClient("t", missing.fetch).repoStatus("ada", "p")).toBe("missing");
    expect(await new GitHubClient("t", denied.fetch).repoStatus("ada", "p")).toBe("no_access");
  });

  it("listRootFiles separates foreign files from Fadi's own scaffolding", async () => {
    // Safety-critical: the warning about an existing site depends on correctly telling
    // "someone else's site" from Fadi's own files + the auto-init README.
    const { fetch } = fakeFetch([
      {
        status: 200,
        body: [
          { name: "index.html" }, // Fadi's — not foreign
          { name: ".nojekyll" }, // Fadi's — not foreign
          { name: "README.md" }, // auto-init — not foreign
          { name: "style.css" }, // foreign
          { name: "about.html" }, // foreign
        ],
      },
    ]);
    const r = await new GitHubClient("t", fetch).listRootFiles("ada", "p");
    expect(r.hasIndex).toBe(true);
    expect(r.foreign.sort()).toEqual(["about.html", "style.css"]);
  });

  it("listRootFiles treats an empty repo (404) as no content", async () => {
    const { fetch } = fakeFetch([{ status: 404 }]);
    const r = await new GitHubClient("t", fetch).listRootFiles("ada", "p");
    expect(r).toEqual({ files: [], hasIndex: false, foreign: [] });
  });

  it("listRepos returns the token's reachable repos", async () => {
    const { fetch, calls } = fakeFetch([
      { status: 200, body: [{ name: "portfolio", full_name: "ada/portfolio", private: false }, { name: "site", full_name: "ada/site", private: true }] },
    ]);
    const repos = await new GitHubClient("t", fetch).listRepos();
    expect(repos.map((r) => r.name)).toEqual(["portfolio", "site"]);
    expect(calls[0].url).toContain("/user/repos");
    expect(calls[0].url).toContain("affiliation=owner");
  });

  it("createRepo posts an auto-init public repo", async () => {
    const { fetch, calls } = fakeFetch([{ status: 201 }]);
    await new GitHubClient("t", fetch).createRepo("portfolio");
    const body = JSON.parse(calls[0].body!);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("https://api.github.com/user/repos");
    expect(body).toMatchObject({ name: "portfolio", private: false, auto_init: true });
  });

  it("putFile looks up the existing sha and includes it on update (idempotent)", async () => {
    // First GET returns an existing file with a sha → the PUT must carry it, or GitHub
    // 409s. This is the exact reason a second publish would fail without the lookup.
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { sha: "abc123" } }, // existing file
      { status: 200 }, // put ok
    ]);
    await new GitHubClient("t", fetch).putFile({
      owner: "ada",
      repo: "p",
      path: "index.html",
      content: "<html></html>",
      message: "publish",
    });
    const putBody = JSON.parse(calls[1].body!);
    expect(calls[1].method).toBe("PUT");
    expect(putBody.sha).toBe("abc123");
    expect(putBody.content).toBe(toBase64("<html></html>"));
  });

  it("putFile omits sha when the file is new (404 on lookup)", async () => {
    const { fetch, calls } = fakeFetch([{ status: 404 }, { status: 201 }]);
    await new GitHubClient("t", fetch).putFile({
      owner: "ada",
      repo: "p",
      path: "index.html",
      content: "x",
      message: "m",
    });
    expect(JSON.parse(calls[1].body!).sha).toBeUndefined();
  });

  it("enablePages treats 409 (already enabled) as success", async () => {
    const { fetch } = fakeFetch([{ status: 409 }]);
    await expect(new GitHubClient("t", fetch).enablePages("ada", "p")).resolves.toBeUndefined();
  });

  it("ensureBranchPages enables branch-serving when Pages is off", async () => {
    // GET 404 (not enabled) → POST to create as branch-serving.
    const { fetch, calls } = fakeFetch([{ status: 404 }, { status: 201 }]);
    const r = await new GitHubClient("t", fetch).ensureBranchPages("ada", "p", "main");
    expect(r.reconfiguredFromWorkflow).toBe(false);
    expect(calls[1].method).toBe("POST");
    expect(JSON.parse(calls[1].body!).source).toEqual({ branch: "main", path: "/" });
  });

  it("ensureBranchPages does nothing when already branch-serving from the right branch", async () => {
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { build_type: "legacy", source: { branch: "main", path: "/" } } },
    ]);
    const r = await new GitHubClient("t", fetch).ensureBranchPages("ada", "p", "main");
    expect(r.reconfiguredFromWorkflow).toBe(false);
    expect(calls).toHaveLength(1); // GET only; no reconfigure
  });

  it("ensureBranchPages SWITCHES a GitHub-Actions Pages source to branch-serving", async () => {
    // The bug this fixes: a former Jekyll/Actions repo whose workflow was deleted by
    // Replace — "pushed but not deployed". We must flip build_type workflow → legacy.
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { build_type: "workflow" } }, // Actions source
      { status: 200 }, // PUT reconfigure
    ]);
    const r = await new GitHubClient("t", fetch).ensureBranchPages("ada", "p", "main");
    expect(r.reconfiguredFromWorkflow).toBe(true);
    expect(calls[1].method).toBe("PUT");
    expect(JSON.parse(calls[1].body!)).toMatchObject({
      build_type: "legacy",
      source: { branch: "main", path: "/" },
    });
  });

  it("getPagesConfig returns null when Pages is not enabled", async () => {
    const { fetch } = fakeFetch([{ status: 404 }]);
    expect(await new GitHubClient("t", fetch).getPagesConfig("ada", "p")).toBeNull();
  });

  it("ensureActionsPages is a NO-OP when the source is already GitHub Actions", async () => {
    // The user's exact case: source already "workflow" → committing the deploy workflow
    // is enough; no source change, so no Administration permission is needed.
    const { fetch, calls } = fakeFetch([{ status: 200, body: { build_type: "workflow" } }]);
    const r = await new GitHubClient("t", fetch).ensureActionsPages("ada", "p");
    expect(r.changed).toBe(false);
    expect(calls).toHaveLength(1); // GET only
  });

  it("ensureActionsPages switches a branch-served repo to the Actions source", async () => {
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { build_type: "legacy", source: { branch: "main", path: "/" } } },
      { status: 200 }, // PUT
    ]);
    const r = await new GitHubClient("t", fetch).ensureActionsPages("ada", "p");
    expect(r.changed).toBe(true);
    expect(calls[1].method).toBe("PUT");
    expect(JSON.parse(calls[1].body!)).toEqual({ build_type: "workflow" });
  });

  it("ensureActionsPages enables Pages (POST) when it's off", async () => {
    const { fetch, calls } = fakeFetch([{ status: 404 }, { status: 201 }]);
    await new GitHubClient("t", fetch).ensureActionsPages("ada", "p");
    expect(calls[1].method).toBe("POST");
    expect(JSON.parse(calls[1].body!)).toEqual({ build_type: "workflow" });
  });
});

describe("buildPagesDeployWorkflow", () => {
  const wf = buildPagesDeployWorkflow("main");

  it("uses the standard static-deploy actions (no build step)", () => {
    expect(wf).toContain("actions/upload-pages-artifact@v3");
    expect(wf).toContain("actions/deploy-pages@v4");
    expect(wf).toContain('path: "."'); // uploads the repo root (the static site)
    expect(wf).not.toMatch(/npm (ci|install)|run build/); // nothing to build
  });

  it("requests the least privilege a Pages deploy needs", () => {
    expect(wf).toContain("pages: write");
    expect(wf).toContain("id-token: write");
  });

  it("triggers on push to the given branch and manually", () => {
    expect(buildPagesDeployWorkflow("master")).toContain('branches: ["master"]');
    expect(wf).toContain("workflow_dispatch:");
  });
});

describe("GitHubClient — errors & git-data", () => {
  it("surfaces GitHub's error message, not a generic one", async () => {
    const { fetch } = fakeFetch([{ status: 403, body: { message: "Resource not accessible by personal access token" } }]);
    await expect(new GitHubClient("t", fetch).createRepo("p")).rejects.toMatchObject({
      name: "GitHubError",
      status: 403,
      message: "Resource not accessible by personal access token",
    });
  });

  it("replaceAllFiles builds a tree with NO base_tree, then moves the ref last", async () => {
    // The safety contract: nothing mutates the repo until the final PATCH. The tree must
    // omit base_tree (so it's the whole content, not a merge), and the ref move is last.
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { object: { sha: "head123" } } }, // GET ref
      { status: 201, body: { sha: "tree456" } }, // POST tree
      { status: 201, body: { sha: "commit789" } }, // POST commit
      { status: 200, body: {} }, // PATCH ref
    ]);
    await new GitHubClient("t", fetch).replaceAllFiles({
      owner: "ada",
      repo: "p",
      branch: "main",
      files: [{ path: "index.html", content: "<html></html>" }],
      message: "replace",
    });

    const treeBody = JSON.parse(calls[1].body!);
    expect(treeBody.base_tree).toBeUndefined(); // whole-content replace, not a merge
    expect(treeBody.tree[0]).toMatchObject({ path: "index.html", mode: "100644", type: "blob" });

    const commitBody = JSON.parse(calls[2].body!);
    expect(commitBody.parents).toEqual(["head123"]); // history preserved
    expect(commitBody.tree).toBe("tree456");

    // The ref move is the LAST call — proving nothing went live before it.
    expect(calls[3].method).toBe("PATCH");
    expect(JSON.parse(calls[3].body!).sha).toBe("commit789");
  });

  it("replaceAllFiles aborts before touching the ref if the tree fails", async () => {
    // A mid-flight failure must leave the old site intact: no ref move happened.
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { object: { sha: "head" } } }, // GET ref
      { status: 422, body: { message: "bad tree" } }, // POST tree fails
    ]);
    await expect(
      new GitHubClient("t", fetch).replaceAllFiles({
        owner: "ada",
        repo: "p",
        branch: "main",
        files: [{ path: "index.html", content: "x" }],
        message: "m",
      }),
    ).rejects.toBeInstanceOf(GitHubError);
    // Only GET + failed POST ran — the ref was never patched.
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("getDefaultBranch reads default_branch, falling back to main", async () => {
    const master = fakeFetch([{ status: 200, body: { default_branch: "master" } }]);
    const none = fakeFetch([{ status: 200, body: {} }]);
    expect(await new GitHubClient("t", master.fetch).getDefaultBranch("a", "p")).toBe("master");
    expect(await new GitHubClient("t", none.fetch).getDefaultBranch("a", "p")).toBe("main");
  });

  it("dispatch fires repository_dispatch with the event type", async () => {
    const { fetch, calls } = fakeFetch([{ status: 204 }]);
    await new GitHubClient("t", fetch).dispatch("ada", "p", "fadi-portfolio-updated");
    expect(calls[0].url).toBe("https://api.github.com/repos/ada/p/dispatches");
    expect(JSON.parse(calls[0].body!).event_type).toBe("fadi-portfolio-updated");
  });
});

describe("pagesUrl", () => {
  it("lowercases the owner and points at the project path", () => {
    expect(pagesUrl("AdaLovelace", "portfolio")).toBe("https://adalovelace.github.io/portfolio/");
  });

  it("serves a user site at the root instead of repeating its name", () => {
    expect(pagesUrl("AdaLovelace", "adalovelace.github.io")).toBe("https://adalovelace.github.io/");
    expect(pagesUrl("AdaLovelace", "AdaLovelace.github.io")).toBe("https://adalovelace.github.io/");
  });

  it("agrees with the base path the site was BUILT for", () => {
    // These two must never disagree: the export bakes pagesBasePath into all 40-odd
    // asset URLs, and pagesUrl is where Fadi tells the user to look. When they diverge
    // the page loads and every stylesheet 404s — an unstyled site with no error anywhere.
    for (const [login, repo] of [
      ["AdaLovelace", "portfolio"],
      ["AdaLovelace", "adalovelace.github.io"],
      ["Mirzzie", "Mirzzie"],
    ] as const) {
      const url = new URL(pagesUrl(login, repo));
      expect(url.pathname).toBe(`${pagesBasePath(login, repo)}/`);
    }
  });
});

describe("resolveRepo — renamed repositories", () => {
  it("reports the name GitHub actually has, not the one we asked with", async () => {
    // THE BUG THIS PINS: the repo was renamed portfolio -> Mirzzie. GitHub follows the old
    // name on the API, so every write succeeded — but Pages moved to /Mirzzie/ while the
    // export was still built for /portfolio/, and all 47 assets 404'd. Unstyled page, no
    // error anywhere. The canonical name has to come back from GitHub.
    const { fetch } = fakeFetch([
      { status: 200, body: { name: "Mirzzie", full_name: "Mirzzie/Mirzzie", owner: { login: "Mirzzie" } } },
    ]);
    const gh = new GitHubClient("t", fetch);

    const r = await gh.resolveRepo("Mirzzie", "portfolio");
    expect(r.status).toBe("exists");
    expect(r.name).toBe("Mirzzie");
    // And the base path built from it is the one Pages will serve.
    expect(pagesBasePath(r.owner, r.name)).toBe("/Mirzzie");
  });

  it("keeps the requested name when the repo does not exist", async () => {
    const { fetch } = fakeFetch([{ status: 404 }]);
    const r = await new GitHubClient("t", fetch).resolveRepo("ada", "brand-new");

    expect(r.status).toBe("missing");
    expect(r.name).toBe("brand-new");
  });

  it("still answers no_access for a token that cannot see the repo", async () => {
    const { fetch } = fakeFetch([{ status: 403 }]);
    expect(await new GitHubClient("t", fetch).repoStatus("ada", "secret")).toBe("no_access");
  });
});

describe("listRepos", () => {
  it("walks past the first page so repo 101 is still offered", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ name: `r${i}`, full_name: `ada/r${i}` }));
    const { fetch, calls } = fakeFetch([
      { status: 200, body: page1 },
      { status: 200, body: [{ name: "the-one-i-wanted", full_name: "ada/the-one-i-wanted" }] },
    ]);

    const repos = await new GitHubClient("t", fetch).listRepos();
    expect(repos).toHaveLength(101);
    expect(repos.at(-1)!.name).toBe("the-one-i-wanted");
    expect(calls[1].url).toContain("page=2");
  });

  it("stops as soon as a page is short — no wasted requests", async () => {
    const { fetch, calls } = fakeFetch([{ status: 200, body: [{ name: "only", full_name: "ada/only" }] }]);
    await new GitHubClient("t", fetch).listRepos();

    expect(calls).toHaveLength(1);
  });
});

describe("GitHubError", () => {
  it("carries the status", () => {
    expect(new GitHubError(404, "nope").status).toBe(404);
  });
});

describe("buildRefreshWorkflow", () => {
  const wf = buildRefreshWorkflow("https://fadi.example.com/api/portfolio/ada/snapshot");

  it("triggers on the dispatch event Fadi fires, plus cron and manual", () => {
    expect(wf).toContain("types: [fadi-portfolio-updated]");
    expect(wf).toContain("schedule:");
    expect(wf).toContain("workflow_dispatch:");
  });

  it("curls the snapshot url into index.html and commits only when changed", () => {
    expect(wf).toContain('curl -fsSL "https://fadi.example.com/api/portfolio/ada/snapshot" -o index.html');
    expect(wf).toContain("git diff --quiet -- index.html");
  });

  it("requests only contents:write — least privilege for a commit", () => {
    expect(wf).toContain("contents: write");
    expect(wf).not.toContain("pages: write");
  });
});
