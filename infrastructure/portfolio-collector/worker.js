/**
 * FADI PORTFOLIO COLLECTOR — a tiny always-on endpoint for a portfolio you host
 * somewhere static (GitHub Pages, Netlify, S3…).
 *
 * WHY THIS EXISTS
 * Fadi is normally run locally. A portfolio published to GitHub Pages is read by
 * strangers, at any hour, from their own machines — so it cannot report anything
 * back to a Fadi on localhost: "localhost" in a visitor's browser means the
 * VISITOR'S computer. Collecting visitor events needs something publicly reachable
 * that is awake when they visit. That is all this is.
 *
 * It deliberately knows nothing about Fadi's database, users or careers. It accepts
 * events, stores them, and hands them over when the owner's Fadi asks. Fadi does the
 * interpreting. That keeps the public surface tiny and means losing this Worker
 * costs you future events, never your history.
 *
 * COST: designed to sit inside Cloudflare's free tier (100k Worker requests/day;
 * D1 5 GB, 100k row writes/day) with no credit card. Since Sept 2026 the free tier
 * FAILS rather than billing you, so it cannot generate a surprise charge.
 *
 * PRIVACY — identical model to Fadi's own:
 *   - no cookies, nothing written to the visitor's browser;
 *   - the IP and user-agent are used once, in memory, to derive a salted DAILY hash
 *     and are never stored;
 *   - that hash changes every day and differs per site, so it can tell one reader
 *     from five but cannot follow anyone over time or across portfolios.
 */

/** Must match apps/web/src/lib/portfolio/analytics.ts. A closed set. */
const EVENTS = new Set([
  "view",
  "item_opened",
  "persona_declared",
  "resume_downloaded",
  "contact_clicked",
]);

const BOT_UA =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|uptime/i;

/* ---------------------------------------------------------------------------
 * ALERTS — the reason this Worker, and not Fadi, does the telling.
 *
 * Fadi runs on a laptop that is closed most of the day. A recruiter who reads the
 * work at 9pm and clicks the contact link is the single most time-sensitive thing
 * this whole system produces, and under the pull-only design the owner learns about
 * it whenever they next open their laptop and press Sync. This Worker is already
 * awake for that visit, so it is the only piece that can say so at the time.
 *
 * Every channel is optional and free, configured as Worker secrets:
 *   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID  — push to a phone, no domain, no cost
 *   ALERT_WEBHOOK_URL                      — Discord or Slack incoming webhook
 *   RESEND_API_KEY + ALERT_EMAIL           — email (Resend's free tier)
 * Configure none and nothing changes: collection carries on exactly as before.
 *
 * A VIEW IS NEVER AN ALERT. Views are mostly crawlers and the owner's own devices,
 * and a notification that fires for noise gets muted within a day — at which point
 * it stops working for the one message that mattered.
 * ------------------------------------------------------------------------- */

/** Events worth interrupting someone for. Deliberately short. */
const ALERTABLE = new Set(["contact_clicked", "resume_downloaded"]);

/** Per-handle, per-kind quiet period, so one person clicking twice sends one alert. */
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * WHAT CLOUDFLARE ALREADY KNOWS, and this Worker was discarding.
 *
 * Every request arrives with `request.cf` filled in at the edge: country, city,
 * timezone, and the network the visitor is on. None of it costs a lookup, none of it
 * is a new identifier, and it is per-event rather than per-person — it does not make
 * the daily pseudonym any easier to reverse.
 *
 * `asOrganization` is the sharp one, and it is here deliberately: for a job seeker,
 * "someone on Amazon's corporate network downloaded your CV" is the single most
 * actionable thing this system can produce. It also means the alert can name a
 * visitor's employer, which is exactly the capability commercial lead-tracking
 * sells. Worth knowing that is what it does.
 */
function edgeContext(request) {
  const cf = request.cf || {};
  const ua = request.headers.get("user-agent") || "";
  return {
    country: cf.country || null,
    city: cf.city || null,
    region: cf.region || null,
    timezone: cf.timezone || null,
    org: cf.asOrganization || null,
    // Device class only — the raw user-agent is never stored, here or in Fadi.
    device: /iphone|ipad|android|mobile/i.test(ua) ? "mobile" : "desktop",
  };
}

/** Their local clock, so "9pm on a Sunday" reads as it did for them. */
function localTime(timezone) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }
}

/**
 * What this same reader already did today.
 *
 * One ping on its own says almost nothing — "someone clicked contact" could be a
 * misclick. The same pseudonym having read two case studies first is a completely
 * different message, and it is already in the table. Same-day only, because the
 * pseudonym is same-day only by design.
 */
async function sameDayStory(env, handle, visitor) {
  try {
    const since = new Date(Date.now() - 864e5).toISOString();
    const { results } = await env.DB.prepare(
      `select type, title from events
       where handle = ? and visitor = ? and created_at > ? and self = 0
       order by id asc limit 40`,
    )
      .bind(handle, visitor, since)
      .all();
    const rows = results || [];
    if (rows.length < 2) return null;
    const opened = [...new Set(rows.filter((r) => r.type === "item_opened" && r.title).map((r) => r.title))];
    const parts = [`${rows.length} actions today`];
    if (opened.length) parts.push(`read: ${opened.slice(0, 4).join(", ")}`);
    return parts.join(" · ");
  } catch {
    return null;
  }
}

function alertsConfigured(env) {
  return Boolean(
    (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) || env.ALERT_WEBHOOK_URL || (env.RESEND_API_KEY && env.ALERT_EMAIL),
  );
}

/** True if this kind may fire now; records the send. Fails OPEN — a broken cooldown
 *  table must not silence a real alert. */
async function passesCooldown(env, handle, kind) {
  try {
    const now = Date.now();
    const { results } = await env.DB.prepare(
      "select last_sent from alerts where handle = ? and kind = ?",
    )
      .bind(handle, kind)
      .all();
    const last = Date.parse(results?.[0]?.last_sent || "") || 0;
    if (now - last < ALERT_COOLDOWN_MS) return false;
    await env.DB.prepare(
      `insert into alerts (handle, kind, last_sent) values (?, ?, ?)
       on conflict(handle, kind) do update set last_sent = excluded.last_sent`,
    )
      .bind(handle, kind, new Date(now).toISOString())
      .run();
    return true;
  } catch {
    return true;
  }
}

/**
 * Send to every configured channel and REPORT what each one answered.
 *
 * The report exists because "nothing came" is otherwise undiagnosable: a missing
 * secret, a wrong chat id, a revoked token and a typo'd webhook all look identical
 * from the outside — silence. /alert-test turns that silence into a status line.
 */
async function deliver(env, subject, body) {
  const text = `${subject}\n\n${body}`;
  const jobs = [];

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    jobs.push([
      "telegram",
      fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
      }),
    ]);
  }

  if (env.ALERT_WEBHOOK_URL) {
    // Discord reads `content`, Slack reads `text`; each ignores the other's key, so
    // one payload serves both and the owner does not have to say which they used.
    jobs.push([
      "webhook",
      fetch(env.ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: text, text }),
      }),
    ]);
  }

  if (env.RESEND_API_KEY && env.ALERT_EMAIL) {
    jobs.push([
      "email",
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: env.ALERT_FROM || "Fadi <onboarding@resend.dev>",
          to: [env.ALERT_EMAIL],
          subject,
          text: body,
        }),
      }),
    ]);
  }

  // One dead channel must not stop the others.
  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  return Promise.all(
    settled.map(async (r, i) => {
      const channel = jobs[i][0];
      if (r.status === "rejected") return { channel, ok: false, error: String(r.reason).slice(0, 200) };
      const res = r.value;
      // The provider's own words on failure — "chat not found", "Unauthorized" — are
      // the entire diagnosis, so pass them through rather than a generic false.
      const detail = res.ok ? undefined : (await res.text().catch(() => "")).slice(0, 300);
      return { channel, ok: res.ok, status: res.status, ...(detail ? { detail } : {}) };
    }),
  );
}

/** Fire-and-forget: a visitor's request is never held open for a notification. */
function notify(env, ctx, promise) {
  const guarded = promise.catch(() => {});
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(guarded);
  return guarded;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

async function dailyVisitorHash({ ip, ua, handle, secret }) {
  const day = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${secret}|${day}|${handle}|${ip || ""}|${ua || ""}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

const str = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    // ---- Ingest: POST /api/portfolio/:handle/event -------------------------
    // Path mirrors Fadi's own endpoint EXACTLY, so the page's beacon needs no
    // special case: point it at this Worker and the same code reports here.
    const ingest = url.pathname.match(/^\/api\/portfolio\/([^/]+)\/event$/);
    if (ingest && request.method === "POST") {
      // One answer for every outcome, so this can never be used to discover which
      // handles exist.
      const done = new Response(null, { status: 204, headers: CORS });
      try {
        const handle = decodeURIComponent(ingest[1]).toLowerCase().slice(0, 100);
        const body = await request.json().catch(() => null);
        if (!body || !EVENTS.has(body.type)) return done;

        const ua = request.headers.get("user-agent") || "";
        const visitor = await dailyVisitorHash({
          ip: request.headers.get("cf-connecting-ip"),
          ua,
          handle,
          secret: env.VISITOR_SALT || "fadi-collector",
        });

        const edge = edgeContext(request);
        await env.DB.prepare(
          `insert into events (handle, type, visitor, automated, self, item_id, title, role, interest, created_at, context)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            handle,
            body.type,
            visitor,
            BOT_UA.test(ua) ? 1 : 0,
            // Self-reported by a browser the owner marked with ?not-me=1. Trusting it
            // is safe: the only thing a caller can do is exclude themselves.
            body.self === true ? 1 : 0,
            str(body.itemId),
            str(body.title),
            str(body.role),
            str(body.interest),
            new Date().toISOString(),
            // One JSON column rather than a column per field: this is an append-only
            // event log, and adding a signal later must not mean migrating a live D1.
            JSON.stringify({ ...edge, kind: str(body.kind), ref: str(body.ref) })
          )
          .run();

        // Only a real person doing something deliberate. A crawler is not interest,
        // and the owner's own click is not news to the owner.
        const genuine = !BOT_UA.test(ua) && body.self !== true;
        if (genuine && ALERTABLE.has(body.type) && alertsConfigured(env)) {
          notify(
            env,
            ctx,
            (async () => {
              if (!(await passesCooldown(env, handle, body.type))) return;
              const kind = str(body.kind);
              const what =
                body.type === "resume_downloaded"
                  ? "Someone downloaded your CV"
                  : kind === "booking"
                    ? "Someone opened your booking link"
                    : kind === "email"
                      ? "Someone clicked your email address"
                      : "Someone clicked your contact link";
              const where = [edge.city, edge.region, edge.country].filter(Boolean).join(", ");
              const story = await sameDayStory(env, handle, visitor);
              await deliver(
                env,
                `${what} — ${handle}`,
                [
                  `${what}${str(body.title) ? `: “${str(body.title)}”` : "."}`,
                  "",
                  where ? `Where: ${where}` : null,
                  edge.org ? `Network: ${edge.org}` : null,
                  edge.timezone ? `Their local time: ${localTime(edge.timezone)}` : null,
                  edge.device ? `Device: ${edge.device}` : null,
                  str(body.ref) ? `Came from: ${str(body.ref)}` : "Came from: direct or unknown",
                  str(body.role) ? `They said they are: ${str(body.role)}` : null,
                  str(body.interest) ? `They came for: ${str(body.interest)}` : null,
                  story ? `This reader today — ${story}` : null,
                  "",
                  "Open Fadi and press Sync in “Who’s looking” for the full picture.",
                ]
                  .filter(Boolean)
                  .join("\n"),
              );
            })(),
          );
        }
      } catch {
        // A reader must never see an analytics failure.
      }
      return done;
    }

    // ---- Feedback: POST /api/portfolio/:handle/feedback ---------------------
    // A separate path from the event beacon on purpose: this carries free text a
    // person actually wrote, so it needs real length, and it must never be counted
    // as an interaction statistic.
    const fb = url.pathname.match(/^\/api\/portfolio\/([^/]+)\/feedback$/);
    if (fb && request.method === "POST") {
      try {
        const handle = decodeURIComponent(fb[1]).toLowerCase().slice(0, 100);
        const body = await request.json().catch(() => null);
        const message = typeof body?.message === "string" ? body.message.trim() : "";
        // Bots send everything; a person sends something. Reject silently-cheap junk
        // but answer 200 either way so a bot learns nothing from the response.
        if (!message || message.length < 4) {
          return new Response(null, { status: 204, headers: CORS });
        }

        const ua = request.headers.get("user-agent") || "";
        const visitor = await dailyVisitorHash({
          ip: request.headers.get("cf-connecting-ip"),
          ua,
          handle,
          secret: env.VISITOR_SALT || "fadi-collector",
        });

        // One person cannot flood the inbox: 5 messages per day per pseudonym.
        const { results } = await env.DB.prepare(
          "select count(*) as n from feedback where visitor = ? and created_at > ?"
        )
          .bind(visitor, new Date(Date.now() - 864e5).toISOString())
          .all();
        if ((results?.[0]?.n || 0) >= 5) {
          return new Response(null, { status: 204, headers: CORS });
        }

        await env.DB.prepare(
          `insert into feedback (handle, kind, message, from_name, contact, visitor, created_at)
           values (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            handle,
            str(body.kind) || "other",
            message.slice(0, 4000),
            str(body.from),
            str(body.contact),
            visitor,
            new Date().toISOString()
          )
          .run();

        // No cooldown here. Someone took the trouble to write to you; that is never
        // noise, and the rate limit above already caps one person at 5 a day.
        if (alertsConfigured(env)) {
          notify(
            env,
            ctx,
            deliver(
              env,
              `New portfolio feedback — ${handle}`,
              [
                message.slice(0, 1500),
                "",
                `— ${str(body.from) || "Anonymous"}${str(body.contact) ? ` <${str(body.contact)}>` : ""}`,
                `About: ${str(body.kind) || "other"}`,
                (() => {
                  const e = edgeContext(request);
                  const where = [e.city, e.country].filter(Boolean).join(", ");
                  return [where && `Where: ${where}`, e.org && `Network: ${e.org}`]
                    .filter(Boolean)
                    .join(" · ");
                })() || null,
              ]
                .filter(Boolean)
                .join("\n"),
            ),
          );
        }
      } catch {
        /* never surface a failure to the person trying to help */
      }
      return new Response(null, { status: 204, headers: CORS });
    }

    // ---- Self-test: GET /alert-test ---------------------------------------
    // "Nothing came" has too many causes to guess at: not deployed, secret missing,
    // wrong chat id, revoked token, or simply no visitor yet. This says which.
    // Bearer-protected with the same token as the drain — it sends a real message,
    // so it must not be something a stranger can trigger.
    if (url.pathname === "/alert-test" && request.method === "GET") {
      const auth = request.headers.get("authorization") || "";
      if (!env.EXPORT_TOKEN || auth.replace(/^Bearer\s+/i, "") !== env.EXPORT_TOKEN) {
        return new Response("unauthorized", { status: 401 });
      }
      const configured = {
        telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
        webhook: Boolean(env.ALERT_WEBHOOK_URL),
        email: Boolean(env.RESEND_API_KEY && env.ALERT_EMAIL),
      };
      if (!alertsConfigured(env)) {
        return Response.json(
          { ok: false, configured, hint: "No alert channel is set on this Worker. Add the secrets, then deploy." },
          { status: 200 },
        );
      }
      const results = await deliver(
        env,
        "Fadi alert test",
        "If you are reading this, alerts from your portfolio collector work. No visitor did anything — you asked for this one.",
      );
      return Response.json({ ok: results.every((r) => r.ok), configured, results });
    }

    // ---- Drain: GET /export?after=<id> -------------------------------------
    // The owner's Fadi pulls from here. Bearer-protected: visitor events are not
    // public just because the endpoint that receives them is.
    if (url.pathname === "/export" && request.method === "GET") {
      const auth = request.headers.get("authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      if (!env.EXPORT_TOKEN || token !== env.EXPORT_TOKEN) {
        return new Response("unauthorized", { status: 401 });
      }
      const after = Number(url.searchParams.get("after") || 0) || 0;
      const limit = Math.min(Number(url.searchParams.get("limit") || 500) || 500, 1000);
      // Optional handle filter. One collector may serve several portfolios; without
      // this, a page of another handle's events could fill the window and the caller
      // would import nothing while its cursor stood still.
      const handle = (url.searchParams.get("handle") || "").toLowerCase();

      const { results } = handle
        ? await env.DB.prepare(
            `select id, handle, type, visitor, automated, self, item_id, title, role, interest, created_at, context
             from events where id > ? and handle = ? order by id asc limit ?`
          )
            .bind(after, handle, limit)
            .all()
        : await env.DB.prepare(
            `select id, handle, type, visitor, automated, self, item_id, title, role, interest, created_at, context
             from events where id > ? order by id asc limit ?`
          )
            .bind(after, limit)
            .all();

      // The highest id SCANNED, so a caller can advance past rows it filtered out.
      const [{ results: maxRow }] = [
        await env.DB.prepare("select max(id) as max from events").all(),
      ];
      const scanned = Number(maxRow?.[0]?.max ?? 0) || 0;

      return new Response(JSON.stringify({ events: results ?? [], scanned }), {
        headers: { "content-type": "application/json" },
      });
    }

    // Feedback drain — same bearer gate. What people wrote to the owner is theirs.
    if (url.pathname === "/export-feedback" && request.method === "GET") {
      const auth = request.headers.get("authorization") || "";
      if (!env.EXPORT_TOKEN || auth.replace(/^Bearer\s+/i, "") !== env.EXPORT_TOKEN) {
        return new Response("unauthorized", { status: 401 });
      }
      const after = Number(url.searchParams.get("after") || 0) || 0;
      const handle = (url.searchParams.get("handle") || "").toLowerCase();
      const { results } = handle
        ? await env.DB.prepare(
            `select id, handle, kind, message, from_name, contact, created_at
             from feedback where id > ? and handle = ? order by id asc limit 200`
          )
            .bind(after, handle)
            .all()
        : await env.DB.prepare(
            `select id, handle, kind, message, from_name, contact, created_at
             from feedback where id > ? order by id asc limit 200`
          )
            .bind(after)
            .all();
      const [{ results: maxRow }] = [
        await env.DB.prepare("select max(id) as max from feedback").all(),
      ];
      return new Response(
        JSON.stringify({ feedback: results ?? [], scanned: Number(maxRow?.[0]?.max ?? 0) || 0 }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    }

    // Health check — useful when wiring this up for the first time.
    if (url.pathname === "/") {
      return new Response("fadi portfolio collector: ok", { status: 200 });
    }

    return new Response("not found", { status: 404 });
  },
};
