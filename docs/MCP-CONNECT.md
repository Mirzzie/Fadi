# FadiOS as an MCP server — "Claude Code with FadiOS"

FadiOS exposes its career capabilities over the **Model Context Protocol (MCP)**, so any agentic AI client — Claude Code, OpenClaw, Cursor, your own agent — can use FadiOS as tools (the "Lego" connector). This is the self-hostable, local-first path: your data stays in your FadiOS instance; the client just calls tools.

## What gets exposed

Every FadiOS agent tool, including:

- `search_jobs` — find roles matched to the user's active direction
- `scan_company_jobs` — pull a company's currently-open roles straight from its ATS
- `evaluate_fit` — "should I apply to this?" fit-gate verdict for a job description
- `prep_interview` — JD-tailored STAR answers drawn from the user's real history
- `answer_behavioral_question` — answer one behavioral question from the user's story bank
- `draft_referral_outreach` — add a referral target and draft the message
- `get_rejection_patterns` — the named pattern across the user's rejections
- `get_career_weather` — what's moving in the world + the controllable next move
- `get_performance` / `get_momentum_reflection` — honest "how am I doing" reads
- `create_career_track` — start/switch a career direction

Tools are grounded in the user's real data and never fabricate. The same user-level honesty and provenance rules apply whether a tool is called from the FadiOS UI or from an external agent.

## Enable it (self-host, single user)

Set two environment variables on your FadiOS instance:

```
FADIOS_MCP_TOKEN=<a long random secret you generate>
FADIOS_MCP_USER_ID=<the FadiOS user id these tools should act as>
```

Then restart FadiOS. The endpoint is:

```
POST  http://localhost:3000/api/mcp
Authorization: Bearer <FADIOS_MCP_TOKEN>
```

It speaks JSON-RPC 2.0 over HTTP (MCP "Streamable HTTP"): `initialize`, `tools/list`, `tools/call`, `ping`. If the token/user aren't configured, the endpoint returns `401` (MCP stays off until you opt in).

> Multi-tenant hosted mode (per-user tokens minted in the app) layers on top later without changing the protocol — the single-token path is the local-first v1.

## Connect from Claude Code

Add it as an HTTP MCP server (replace the token):

```jsonc
// .mcp.json (project) or your Claude Code MCP config
{
  "mcpServers": {
    "fadios": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_FADIOS_MCP_TOKEN" }
    }
  }
}
```

Now in Claude Code you can say things like *"use fadios to fit-check this job description"*, *"prep me for this role with fadios"*, or *"scan fadios for open roles at Stripe"* — and FadiOS answers from your real career data.

## Connect from another agent (generic)

Any MCP client that supports an HTTP/Streamable-HTTP server works the same way: point it at `/api/mcp`, send the Bearer token, call `tools/list` then `tools/call`. A raw smoke test:

```bash
curl -s http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $FADIOS_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Notes / limits (honest)

- **v1 is single-user, token = one user.** Good for local "Claude Code with FadiOS"; not yet multi-tenant.
- **POST only.** Server-initiated SSE streaming isn't enabled on this endpoint yet (`GET` returns 405).
- Tools that need an AI provider use the configured user's own provider key; if none is set, those tools return an honest "connect a provider" message rather than failing.
- Keep `FADIOS_MCP_TOKEN` secret — it grants tool access as that user.
