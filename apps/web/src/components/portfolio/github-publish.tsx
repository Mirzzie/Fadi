"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, GitBranch, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  connectGithub,
  disconnectGithub,
  getGithubConnection,
  getGithubRepos,
  inspectGithubRepo,
  publishToGithub,
  type GithubConnectionView,
} from "@/app/dashboard/portfolio/github-actions";

/**
 * GitHub Pages publishing panel (ADR 0008). Connect a fine-grained PAT once, then publish
 * the portfolio to a repo and host it on Pages — without leaving Fadi. The token is
 * validated on connect and stored encrypted; only its last 4 chars are ever shown back.
 */
export function GithubPublishPanel({ isPublished }: { isPublished: boolean }) {
  const [conn, setConn] = useState<GithubConnectionView | null>(null);
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("portfolio");
  const [repos, setRepos] = useState<string[]>([]);
  const [inspect, setInspect] = useState<{ hasIndex: boolean; foreign: string[] } | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string; url?: string } | null>(null);
  const [pending, start] = useTransition();

  // Load the token's reachable repos so the picker only offers repos it can actually
  // write to — the point of showing a list instead of a blind name field.
  function loadRepos() {
    getGithubRepos().then((r) => {
      if (r.ok) setRepos(r.data.repos);
    });
  }

  useEffect(() => {
    getGithubConnection().then((c) => {
      setConn(c);
      if (c.repo) setRepo(c.repo);
      if (c.connected) loadRepos();
    });
  }, []);

  // Preflight the chosen repo (debounced) so we can warn BEFORE publishing that it already
  // has a site — publishing overwrites index.html but leaves other files live.
  useEffect(() => {
    if (!conn?.connected || !repo.trim()) {
      // Defer the clear off the synchronous effect pass to avoid cascading renders.
      const c = setTimeout(() => setInspect(null), 0);
      return () => clearTimeout(c);
    }
    const t = setTimeout(() => {
      inspectGithubRepo({ repo }).then((r) => {
        setInspect(r.ok && r.data.exists ? { hasIndex: r.data.hasIndex, foreign: r.data.foreign } : null);
      });
    }, 500);
    return () => clearTimeout(t);
  }, [repo, conn?.connected]);

  function connect() {
    setStatus(null);
    start(async () => {
      const res = await connectGithub({ token });
      if (res.ok) {
        setToken("");
        setConn(await getGithubConnection());
        loadRepos();
        setStatus({ ok: true, message: `Connected as ${res.data.login}.` });
      } else {
        setStatus({ ok: false, message: res.message });
      }
    });
  }

  function publish() {
    setStatus(null);
    start(async () => {
      // Building the full static site (with animations + case studies) then pushing it can
      // take ~30s — the transition keeps the button in its pending state throughout.
      const res = await publishToGithub({ repo });
      if (res.ok) {
        setConn(await getGithubConnection());
        setStatus({
          ok: true,
          message:
            res.data.note ??
            "Published your full portfolio site. Live in ~1 minute at the URL below.",
          url: res.data.pagesUrl,
        });
      } else {
        setStatus({ ok: false, message: res.message });
      }
    });
  }

  function disconnect() {
    start(async () => {
      await disconnectGithub();
      setConn(await getGithubConnection());
      setStatus(null);
    });
  }

  if (!conn) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />;
  }

  return (
    <div className="space-y-4">
      {!conn.connected ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Host your portfolio on your own GitHub, free. Create a{" "}
            <a
              className="underline"
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              rel="noreferrer"
            >
              fine-grained token
            </a>{" "}
            with <strong>Contents</strong>, <strong>Pages</strong> and{" "}
            <strong>Administration</strong> permissions (read & write) on the repo you want, then
            paste it here. It&apos;s encrypted at rest and never shown again.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="gh-token">GitHub token</Label>
            <Input
              id="gh-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_..."
              autoComplete="off"
            />
          </div>
          <Button size="sm" onClick={connect} disabled={pending || !token.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <GitBranch className="size-4" />}
            Connect GitHub
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connected as <strong>{conn.githubLogin}</strong>
            {conn.tokenHint ? ` (token …${conn.tokenHint})` : ""}.
          </p>

          {!isPublished && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              Your site is a draft. Publish it inside Fadi first, then it can go to GitHub.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="gh-repo">Repository</Label>
              <Input
                id="gh-repo"
                list="gh-repo-list"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="portfolio"
              />
              <datalist id="gh-repo-list">
                {repos.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground">
                {repos.includes(repo.trim())
                  ? "Existing repo — Fadi will publish into it."
                  : repos.length > 0
                    ? "New repo — pick an existing one above if creating fails (fine-grained tokens often can't create repos)."
                    : "Type the repo name, or reconnect to load your repositories."}
              </p>
            </div>
            <Button onClick={publish} disabled={pending || !isPublished}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <GitBranch className="size-4" />}
              {pending ? "Building & publishing…" : "Publish to GitHub"}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Publishes your <strong>full portfolio site</strong> — hero, animations, and case-study
            pages — exactly as it looks in Fadi. Building and deploying takes ~30 seconds.
          </p>

          {inspect && (inspect.hasIndex || inspect.foreign.length > 0) && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              <p>
                <strong>Heads up:</strong> this repo already has content. Publishing your portfolio
                site <strong>replaces the whole repository</strong> with it
                {inspect.foreign.length > 0 ? (
                  <>
                    {" "}— including <span className="font-mono">{inspect.foreign.slice(0, 5).join(", ")}</span>
                    {inspect.foreign.length > 5 ? ` +${inspect.foreign.length - 5} more` : ""}
                  </>
                ) : null}
                . Git history is kept, but use a dedicated/empty repo if that content matters.
              </p>
            </div>
          )}

          {conn.pagesUrl && (
            <a
              className="inline-flex items-center gap-1 text-xs underline text-muted-foreground"
              href={conn.pagesUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3" aria-hidden="true" />
              {conn.pagesUrl}
            </a>
          )}

          <button
            type="button"
            onClick={disconnect}
            disabled={pending}
            className="block text-xs text-muted-foreground underline"
          >
            Disconnect GitHub
          </button>
        </div>
      )}

      {status && (
        <div
          className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
            status.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {status.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <div className="space-y-1">
            <p>{status.message}</p>
            {status.url && (
              <a
                className="inline-flex items-center gap-1 underline"
                href={status.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-3" aria-hidden="true" />
                {status.url}
              </a>
            )}
          </div>
        </div>
      )}

      <TokenHelp />
    </div>
  );
}

/**
 * Collapsible token-permissions troubleshooting — the fix for the most common publish
 * failure ("Resource not accessible by personal access token"), available in-product so
 * the user doesn't have to leave to work out what permission is missing.
 */
function TokenHelp() {
  return (
    <details className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">
        Publish blocked? Token permissions &amp; troubleshooting
      </summary>
      <div className="mt-2 space-y-3">
        <p>
          <strong>&quot;Resource not accessible by personal access token&quot;</strong> means the
          token can <em>read</em> the repo but can&apos;t <em>write</em> to it — almost always
          because <strong>Contents</strong> is set to <em>Read-only</em> instead of{" "}
          <em>Read and write</em>.
        </p>

        <div>
          <p className="font-medium text-foreground">Fix a fine-grained token</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>
              GitHub →{" "}
              <a
                className="underline"
                href="https://github.com/settings/tokens?type=beta"
                target="_blank"
                rel="noreferrer"
              >
                Settings → Developer settings → Fine-grained tokens
              </a>{" "}
              → your token → <strong>Edit</strong>.
            </li>
            <li>
              <strong>Repository access</strong>: make sure the target repo is selected (or
              &quot;All repositories&quot;).
            </li>
            <li>
              <strong>Repository permissions</strong> — set to <strong>Read and write</strong>:{" "}
              <strong>Contents</strong>, <strong>Pages</strong>, <strong>Administration</strong>.
              Optionally add <strong>Workflows</strong> too — only needed if you want the GitHub
              Actions deploy workflow; without it Fadi deploys straight from the branch instead.
            </li>
            <li>
              <strong>Update</strong>, then click Publish again. If you regenerated the token,
              Disconnect and paste the new one.
            </li>
          </ol>
        </div>

        <div>
          <p className="font-medium text-foreground">Simpler: a classic token</p>
          <p className="mt-1">
            Create a{" "}
            <a
              className="underline"
              href="https://github.com/settings/tokens/new"
              target="_blank"
              rel="noreferrer"
            >
              classic token
            </a>{" "}
            with the <strong>repo</strong> scope checked — it has full read/write to your repos,
            so there are no per-permission toggles to get wrong. Disconnect, then reconnect with it.
          </p>
        </div>

        <div>
          <p className="font-medium text-foreground">&quot;Couldn&apos;t create the repo&quot;?</p>
          <p className="mt-1">
            Fine-grained tokens usually can&apos;t create repositories. Create an empty repo on
            GitHub first (then grant the token access to it), or use a classic token.
          </p>
        </div>

        <div>
          <p className="font-medium text-foreground">Site not showing after publishing?</p>
          <p className="mt-1">
            Fadi builds your full portfolio (hero, animations, case-study pages) and pushes the
            whole site. If your token has the <strong>Workflows</strong> permission it deploys via a
            GitHub <strong>Actions</strong> workflow — watch the run in your repo&apos;s{" "}
            <strong>Actions</strong> tab; the site is live about a minute after it goes green.
            Without that permission it deploys straight from the branch instead
            (<strong>Settings → Pages → Deploy from a branch</strong>), which Fadi sets for you.
            First-ever deploys can take a couple of minutes for GitHub to provision the Pages URL.
          </p>
        </div>
      </div>
    </details>
  );
}
