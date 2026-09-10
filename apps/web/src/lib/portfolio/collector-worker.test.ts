import { describe, expect, it } from "vitest";

// The collector is deployed separately (infrastructure/portfolio-collector) but it is
// the PUBLIC surface of this feature — an open endpoint anyone can post to — so it is
// tested here rather than left to hope.
import worker from "../../../../../infrastructure/portfolio-collector/worker.js";

/** Minimal D1 stand-in that records what would have been written. */
function fakeDb() {
  const writes: unknown[][] = [];
  const rows: Record<string, unknown>[] = [];
  return {
    writes,
    rows,
    prepare(sql: string) {
      const exec = (args: unknown[]) => ({
        async run() {
          if (/^\s*insert/i.test(sql)) writes.push(args);
          return { success: true };
        },
        async all() {
          // Aggregates are queried unbound; give them a shape the worker can read.
          if (/max\(id\)/i.test(sql)) return { results: [{ max: rows.length }] };
          return { results: rows };
        },
      });
      // Real D1 allows both prepare().all() and prepare().bind().all(); the stub
      // only had the bound form, so an unbound aggregate threw.
      return { bind: (...args: unknown[]) => exec(args), ...exec([]) };
    },
  };
}

const env = () => ({ DB: fakeDb(), VISITOR_SALT: "salt", EXPORT_TOKEN: "tok" });

const post = (body: unknown, handle = "someone", headers: Record<string, string> = {}) =>
  new Request(`https://c.example.dev/api/portfolio/${handle}/event`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("collector — ingest", () => {
  it("stores a valid event", async () => {
    const e = env();
    const res = await worker.fetch(post({ type: "view" }), e);

    expect(res.status).toBe(204);
    expect(e.DB.writes).toHaveLength(1);
  });

  it("stores the owner's self-flag so it can be excluded later", async () => {
    const e = env();
    await worker.fetch(post({ type: "view", self: true }), e);

    // handle, type, visitor, automated, self, ...
    expect(e.DB.writes[0][4]).toBe(1);
  });

  it("rejects anything outside the closed event set — and writes nothing", async () => {
    for (const bad of [{ type: "drop_table" }, { type: "" }, { type: 1 }, {}, null]) {
      const e = env();
      const res = await worker.fetch(post(bad), e);

      expect(res.status).toBe(204);
      expect(e.DB.writes).toHaveLength(0);
    }
  });

  it("never stores the IP or user-agent it hashed", async () => {
    const e = env();
    await worker.fetch(
      post({ type: "view" }, "someone", {
        "cf-connecting-ip": "203.0.113.9",
        "user-agent": "Mozilla/5.0 SecretBrowser",
      }),
      e
    );

    const stored = JSON.stringify(e.DB.writes[0]);
    expect(stored).not.toContain("203.0.113.9");
    expect(stored).not.toContain("SecretBrowser");
    expect(e.DB.writes[0][2]).toMatch(/^[0-9a-f]{16}$/); // visitor hash
  });

  it("gives different readers different pseudonyms, and one reader a stable one", async () => {
    const a = env();
    await worker.fetch(post({ type: "view" }, "someone", { "cf-connecting-ip": "1.1.1.1" }), a);
    const b = env();
    await worker.fetch(post({ type: "view" }, "someone", { "cf-connecting-ip": "1.1.1.1" }), b);
    const c = env();
    await worker.fetch(post({ type: "view" }, "someone", { "cf-connecting-ip": "2.2.2.2" }), c);

    expect(a.DB.writes[0][2]).toBe(b.DB.writes[0][2]);
    expect(a.DB.writes[0][2]).not.toBe(c.DB.writes[0][2]);
  });

  it("does not let one portfolio's reader be linked to another's", async () => {
    const a = env();
    await worker.fetch(post({ type: "view" }, "alice", { "cf-connecting-ip": "1.1.1.1" }), a);
    const b = env();
    await worker.fetch(post({ type: "view" }, "bob", { "cf-connecting-ip": "1.1.1.1" }), b);

    expect(a.DB.writes[0][2]).not.toBe(b.DB.writes[0][2]);
  });

  it("flags bots", async () => {
    const e = env();
    await worker.fetch(post({ type: "view" }, "someone", { "user-agent": "Googlebot/2.1" }), e);

    expect(e.DB.writes[0][3]).toBe(1);
  });

  it("truncates oversized fields rather than storing them", async () => {
    const e = env();
    await worker.fetch(post({ type: "item_opened", title: "x".repeat(5000) }), e);

    expect(String(e.DB.writes[0][6]).length).toBeLessThanOrEqual(200);
  });
});

describe("collector — export drain", () => {
  const get = (url: string, token?: string) =>
    new Request(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  it("refuses without the right token — visitor data is not public", async () => {
    for (const t of [undefined, "", "wrong"]) {
      const res = await worker.fetch(get("https://c.example.dev/export", t), env());
      expect(res.status).toBe(401);
    }
  });

  it("returns events to the owner's Fadi with the right token", async () => {
    const e = env();
    e.DB.rows.push({ id: 1, handle: "someone", type: "view" });

    const res = await worker.fetch(get("https://c.example.dev/export", "tok"), e);
    const body = (await res.json()) as { events: unknown[] };

    expect(res.status).toBe(200);
    expect(body.events).toHaveLength(1);
  });
});

describe("collector — surface", () => {
  it("answers CORS preflight so a static site elsewhere can report", async () => {
    const res = await worker.fetch(
      new Request("https://c.example.dev/api/portfolio/x/event", { method: "OPTIONS" }),
      env()
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("has a health check", async () => {
    const res = await worker.fetch(new Request("https://c.example.dev/"), env());
    expect(res.status).toBe(200);
  });
});

/* ---------------------------------------------------------------------------
 * ALERTS
 *
 * Fadi runs on a laptop that is shut most of the day, so the pull-only design means
 * the owner hears about a recruiter's contact click whenever they next open it and
 * press Sync. The Worker is awake at the moment it happens; these pin that it tells
 * someone, and — just as important — that it stays quiet for noise. An alert that
 * fires for crawlers gets muted, and a muted alert is worth nothing.
 * ------------------------------------------------------------------------- */

/** Captures outbound alert calls without touching the network. */
function captureFetch() {
  const sent: { url: string; body: unknown }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(null, { status: 200 });
  }) as typeof globalThis.fetch;
  return { sent, restore: () => void (globalThis.fetch = original) };
}

const withTelegram = () => ({
  ...env(),
  TELEGRAM_BOT_TOKEN: "bot-token",
  TELEGRAM_CHAT_ID: "12345",
});

const BOT = { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" };

/**
 * The real Workers ExecutionContext. Alerts are deliberately fire-and-forget so a
 * visitor's request is never held open by a notification — which means the test has
 * to wait for the same background work the platform would.
 */
function ctxStub() {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => void pending.push(p) },
    settle: () => Promise.allSettled(pending),
  };
}

describe("collector — alerts", () => {
  it("tells the owner when a visitor clicks contact", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    try {
      await worker.fetch(post({ type: "contact_clicked" }), withTelegram(), c.ctx);
    } finally {
      await c.settle();
      cap.restore();
    }

    expect(cap.sent).toHaveLength(1);
    expect(cap.sent[0].url).toContain("api.telegram.org/botbot-token/sendMessage");
    expect(JSON.stringify(cap.sent[0].body)).toMatch(/contact link/i);
  });

  it("tells the owner when someone writes feedback, with what they wrote", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    const req = new Request("https://c.example.dev/api/portfolio/someone/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "The Home SOC lab needs a network diagram.", from: "Dana" }),
    });
    try {
      await worker.fetch(req, withTelegram(), c.ctx);
    } finally {
      await c.settle();
      cap.restore();
    }

    expect(cap.sent).toHaveLength(1);
    expect(JSON.stringify(cap.sent[0].body)).toContain("network diagram");
  });

  it("stays silent for a plain view — that is noise, and noise gets the alert muted", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    try {
      await worker.fetch(post({ type: "view" }), withTelegram(), c.ctx);
    } finally {
      await c.settle();
      cap.restore();
    }

    expect(cap.sent).toHaveLength(0);
  });

  it("stays silent for a crawler", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    try {
      await worker.fetch(post({ type: "contact_clicked" }, "someone", BOT), withTelegram(), c.ctx);
    } finally {
      await c.settle();
      cap.restore();
    }

    expect(cap.sent).toHaveLength(0);
  });

  it("stays silent for the owner's own click", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    try {
      await worker.fetch(post({ type: "contact_clicked", self: true }), withTelegram(), c.ctx);
    } finally {
      await c.settle();
      cap.restore();
    }

    expect(cap.sent).toHaveLength(0);
  });

  it("sends nothing when no channel is configured — collection is unchanged", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    try {
      await worker.fetch(post({ type: "contact_clicked" }), env(), c.ctx);
    } finally {
      await c.settle();
      cap.restore();
    }

    expect(cap.sent).toHaveLength(0);
  });

  it("still records the event when the alert channel is down", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("telegram unreachable");
    }) as typeof globalThis.fetch;
    const e = withTelegram();
    const c = ctxStub();
    try {
      const res = await worker.fetch(post({ type: "contact_clicked" }), e, c.ctx);
      expect(res.status).toBe(204);
      await c.settle();
    } finally {
      globalThis.fetch = original;
    }

    // The visit is history; the notification is a convenience. Losing the second
    // must never cost the first. (The cooldown row is the other write.)
    expect(e.DB.writes[0]).toContain("contact_clicked");
  });

  it("does not send twice for the same kind inside the quiet period", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    const e = withTelegram();
    // A cooldown row written moments ago — the second click must be swallowed.
    e.DB.rows.push({ last_sent: new Date().toISOString() });
    try {
      await worker.fetch(post({ type: "contact_clicked" }), e, c.ctx);
    } finally {
      await c.settle();
      cap.restore();
    }

    expect(cap.sent).toHaveLength(0);
  });

  it("posts one payload that both Discord and Slack can read", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    try {
      await worker.fetch(
        post({ type: "resume_downloaded" }),
        { ...env(), ALERT_WEBHOOK_URL: "https://discord.com/api/webhooks/x/y" },
        c.ctx,
      );
    } finally {
      await c.settle();
      cap.restore();
    }

    const body = cap.sent[0].body as { content?: string; text?: string };
    expect(body.content).toBeTruthy(); // Discord
    expect(body.text).toBeTruthy(); // Slack
  });
});

describe("collector — alert self-test", () => {
  const testReq = (token?: string) =>
    new Request("https://c.example.dev/alert-test", {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  it("refuses without the export token — it sends a real message", async () => {
    const res = await worker.fetch(testReq(), withTelegram(), undefined);
    expect(res.status).toBe(401);
  });

  it("says plainly when no channel is configured, instead of silently doing nothing", async () => {
    const res = await worker.fetch(testReq("tok"), env(), undefined);
    const body = (await res.json()) as { ok: boolean; hint?: string };

    expect(body.ok).toBe(false);
    expect(body.hint).toMatch(/No alert channel/i);
  });

  it("reports each channel's own words when delivery fails", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('{"description":"chat not found"}', { status: 400 })) as typeof globalThis.fetch;
    try {
      const res = await worker.fetch(testReq("tok"), withTelegram(), undefined);
      const body = (await res.json()) as {
        ok: boolean;
        results: { channel: string; ok: boolean; status: number; detail?: string }[];
      };

      // A wrong chat id and a revoked token look identical from outside — silence.
      // Passing Telegram's own message through IS the diagnosis.
      expect(body.ok).toBe(false);
      expect(body.results[0].channel).toBe("telegram");
      expect(body.results[0].detail).toContain("chat not found");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("confirms success when the channel accepts it", async () => {
    const cap = captureFetch();
    try {
      const res = await worker.fetch(testReq("tok"), withTelegram(), undefined);
      const body = (await res.json()) as { ok: boolean; configured: Record<string, boolean> };

      expect(body.ok).toBe(true);
      expect(body.configured.telegram).toBe(true);
    } finally {
      cap.restore();
    }
  });
});

describe("collector — richer alert content", () => {
  /** Cloudflare fills request.cf at the edge; the Worker was discarding all of it. */
  const withCf = (body: unknown, cf: Record<string, string>, ua = "Mozilla/5.0 (iPhone)") => {
    const r = new Request("https://c.example.dev/api/portfolio/someone/event", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": ua },
      body: JSON.stringify(body),
    });
    Object.defineProperty(r, "cf", { value: cf });
    return r;
  };

  const DUBLIN = { country: "IE", city: "Dublin", region: "Leinster", timezone: "Europe/Dublin", asOrganization: "Acme Corp" };

  it("says WHICH contact was clicked — booking is not the same as email", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    try {
      await worker.fetch(
        withCf({ type: "contact_clicked", kind: "booking", title: "Book a call" }, DUBLIN),
        withTelegram(),
        c.ctx,
      );
    } finally {
      await c.settle();
      cap.restore();
    }

    const text = JSON.stringify(cap.sent[0].body);
    expect(text).toMatch(/booking link/i);
    expect(text).toContain("Book a call");
  });

  it("includes where they are, their network, device and referrer", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    try {
      await worker.fetch(
        withCf({ type: "contact_clicked", ref: "linkedin.com" }, DUBLIN),
        withTelegram(),
        c.ctx,
      );
    } finally {
      await c.settle();
      cap.restore();
    }

    const text = JSON.stringify(cap.sent[0].body);
    expect(text).toContain("Dublin");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("linkedin.com");
    expect(text).toContain("mobile");
  });

  it("stores the context on the event so the history can show it later", async () => {
    const e = withTelegram();
    const c = ctxStub();
    await worker.fetch(withCf({ type: "view", ref: "google.com" }, DUBLIN), e, c.ctx);
    await c.settle();

    const context = JSON.parse(String(e.DB.writes[0].at(-1)));
    expect(context).toMatchObject({ country: "IE", city: "Dublin", org: "Acme Corp", ref: "google.com" });
    // The raw user-agent and IP are still never stored — only a device class.
    expect(JSON.stringify(context)).not.toMatch(/Mozilla|iPhone/);
  });

  it("degrades cleanly when the edge gives nothing", async () => {
    const cap = captureFetch();
    const c = ctxStub();
    try {
      await worker.fetch(post({ type: "contact_clicked" }), withTelegram(), c.ctx);
    } finally {
      await c.settle();
      cap.restore();
    }

    // No city, no org, no referrer — still a usable message, no "undefined" in it.
    const text = JSON.stringify(cap.sent[0].body);
    expect(text).not.toMatch(/undefined|null/);
    expect(text).toMatch(/direct or unknown/);
  });
});
