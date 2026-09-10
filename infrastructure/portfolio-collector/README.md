# Fadi portfolio collector

A ~150-line Cloudflare Worker that receives visitor events from a portfolio you host
statically (GitHub Pages, Netlify, S3) and holds them until your Fadi pulls them in.

**Why you need it:** Fadi runs on your machine. A portfolio on GitHub Pages is read by
strangers from *their* machines, so it cannot report to `localhost` — that address means
*their* computer, not yours. Collecting visitor events needs something publicly reachable
that is awake when they visit. This is the smallest possible version of that.

**Cost: £0.** Cloudflare's Workers free plan needs no credit card, and since 1 Sept 2026 the
D1 free tier *fails closed* instead of billing you. Limits are 100k Worker requests/day and
100k D1 row writes/day — a personal portfolio will not come close.

**Privacy:** no cookies; the visitor's IP and user-agent are used once in memory to derive a
salted hash that changes every day, and are never stored. The hash tells one reader from five
but cannot follow anyone over time.

## Setup (about 5 minutes)

**First, make your two secrets.** They are not obtained from anywhere — you invent them.
Any long random string works; generate them with:

```bash
openssl rand -base64 32     # run twice: one for VISITOR_SALT, one for EXPORT_TOKEN
```

- `VISITOR_SALT` — salts the daily visitor hash so it can't be reversed. Never leaves the Worker.
- `EXPORT_TOKEN` — the password Fadi uses to pull events back. Also goes in `.env.local`.

Changing `VISITOR_SALT` later is harmless: it only means yesterday's readers stop matching
today's, which is already true by design.

**Then, IN THIS ORDER** (each step needs the one before it):

```bash
cd infrastructure/portfolio-collector
npx wrangler login                                   # opens a browser; free account is fine

# 1. Create the database, then PASTE the printed uuid into wrangler.toml as database_id.
#    Skipping the paste is the usual cause of "Invalid property: databaseId => Invalid uuid".
npx wrangler d1 create fadi-portfolio-analytics
#    (already created one? `npx wrangler d1 list` shows its uuid)

# 2. Create the table. Fails until step 1's uuid is actually in wrangler.toml.
npx wrangler d1 execute fadi-portfolio-analytics --remote --file=./schema.sql
# Already deployed before the context column existed? Add it (once):
npx wrangler d1 execute fadi-portfolio-analytics --remote --file=./migrations/001_event_context.sql

# 3. Deploy — this CREATES the Worker, so it must come before the secrets.
npx wrangler deploy                                  # prints your URL

# 4. Now the secrets, pasted at the prompt.
npx wrangler secret put VISITOR_SALT
npx wrangler secret put EXPORT_TOKEN
```

Deploying before the secrets exist is safe: without `EXPORT_TOKEN` the `/export` drain
refuses everything with a 401, so nothing is readable in the gap.

You now have a URL like `https://fadi-portfolio-collector.<you>.workers.dev`.
Check it: opening it in a browser should say `fadi portfolio collector: ok`.

## Point your portfolio at it

In `apps/web/.env.local`:

```bash
NEXT_PUBLIC_PORTFOLIO_ANALYTICS_URL=https://fadi-portfolio-collector.<you>.workers.dev
PORTFOLIO_COLLECTOR_URL=https://fadi-portfolio-collector.<you>.workers.dev
PORTFOLIO_COLLECTOR_TOKEN=<the EXPORT_TOKEN you set above>
```

Then **re-publish your portfolio from Fadi**. The first variable is baked into the static
build, so events only start flowing after a fresh publish. The other two let Fadi pull them
back in — press **Who's looking → Sync** in the portfolio manager.

## Get told when it happens (optional, free)

Fadi runs on your laptop, so a recruiter who clicks your contact link at 9pm is news you
get whenever you next open Fadi and press Sync. This Worker is already awake at that
moment — give it a channel and it tells you straight away.

It notifies on **contact clicks**, **CV downloads** and **feedback** only. Never on views:
most views are crawlers and your own devices, and an alert that cries wolf gets muted
within a day. Repeat clicks of the same kind are collapsed into one alert per 15 minutes;
feedback is never throttled, because someone took the trouble to write to you.

Pick whichever you already use — configure none and nothing changes.

```bash
# Telegram — free, instant on your phone, no domain needed.
#   1. Message @BotFather → /newbot → copy the token
#   2. Message your new bot once, then open
#      https://api.telegram.org/bot<TOKEN>/getUpdates and copy "chat":{"id":...}
# NOTE: `secret put` takes the KEY ONLY. Passing the value as a second argument fails
# with "Unknown argument" — the value goes on stdin, which also keeps it out of `ps`
# and your shell history.
printf '%s' '123456:AAF-your-bot-token' | npx wrangler secret put TELEGRAM_BOT_TOKEN
printf '%s' '7300000000'                | npx wrangler secret put TELEGRAM_CHAT_ID

# Discord or Slack — one incoming-webhook URL, works for either.
printf '%s' 'https://discord.com/api/webhooks/…' | npx wrangler secret put ALERT_WEBHOOK_URL

# Email — Resend's free tier (3,000/month). Without a verified domain you can only
# send to your own Resend account address, which is exactly what this needs.
printf '%s' 're_your_key'   | npx wrangler secret put RESEND_API_KEY
printf '%s' 'you@mail.com' | npx wrangler secret put ALERT_EMAIL   # where to send it
printf '%s' 'Fadi <you@yourdomain>' | npx wrangler secret put ALERT_FROM  # optional
```

Then re-run step 2 above (`d1 execute ... --file=./schema.sql`) — it adds the `alerts`
table the 15-minute cooldown lives in. The file is idempotent, so re-running is safe.

### What an alert now tells you

```
Someone opened your booking link — mirzad

Where: Dublin, Leinster, IE
Network: Vodafone Ireland
Their local time: 9 Sept 2026, 22:41
Device: mobile
Came from: linkedin.com
They said they are: recruiter
They came for: security
This reader today — 5 actions today · read: Shield-Right DevSecOps, OpenClaw · Home SOC
```

All of it comes from what Cloudflare already attaches to the request, plus the events
this same daily pseudonym produced earlier — no new tracking, no third party, and the
raw IP and user-agent are still never stored (only a country/city and a device class).

**`Network` deserves a word.** `asOrganization` frequently names a visitor's employer,
which is precisely what commercial lead-tracking sells. For a job seeker it is the most
actionable line in the message. It is also the line that turns an anonymous reader into
a named company, so it is worth knowing that is what it does.

### Check it works — without waiting for a visitor

```bash
# EXPORT_TOKEN is the one already in apps/web/.env.local as PORTFOLIO_COLLECTOR_TOKEN.
curl -s -H "Authorization: Bearer $EXPORT_TOKEN" \
  https://fadi-portfolio-collector.<you>.workers.dev/alert-test | jq
```

It sends one real message and tells you exactly what each channel answered:

```json
{ "ok": true, "configured": { "telegram": true, "webhook": false, "email": false },
  "results": [ { "channel": "telegram", "ok": true, "status": 200 } ] }
```

`"hint": "No alert channel is set"` means the secrets aren't on the Worker (or you set
them but haven't run `wrangler deploy` since adding the alert code). A failure passes the
provider's own words straight through — `chat not found` is a wrong `TELEGRAM_CHAT_ID`,
`Unauthorized` is a wrong or revoked `TELEGRAM_BOT_TOKEN`.

Your bot will not answer `/start` — it has no command handler and never reads messages.
It only pushes. Sending `/start` is still needed once, though: Telegram refuses to let a
bot message you until you have opened a conversation with it.

If a channel is down the event is still recorded; only the notification is lost.

## What it does NOT do

It doesn't know about your careers, evidence or tracks — it stores events and hands them
over. All the interpreting happens in Fadi. If you delete this Worker you stop collecting
new events; nothing already pulled into Fadi is lost.
