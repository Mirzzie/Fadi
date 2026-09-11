# Is Fadi actually agentic? A reality check

11 September 2026. Asked directly: *"is fadi as agentic yet? how do we connect other AI
models with tools, web and multi agent capabilities? does Fadi work with them properly?
does Fadi support agentic swarm."*

Read the code rather than the ambitions. The short answer is **one round deep, blind to the
web, toolless on Anthropic, and no multi-agent anything** — with one genuinely strong part.

## 1. Tool calling: a single pass, not a loop

`lib/ai/providers/openai.ts:244`, and its own comment says it:

> Phase 1 — a single tool-resolution pass… Phase 2 — STREAM the final answer (no tools
> offered, so it must answer).

One chance to choose tools, execute them, then answer with tools **removed**. Consequences,
all real:

- Fadi cannot **chain**. It cannot call `inspect_machine`, see there is no Docker, and then
  propose something else. Both calls would have to be guessed in the first shot.
- It cannot **recover**. A tool that returns "no live grant" ends the turn; it cannot ask for
  the grant and retry.
- It cannot **verify its own work**. Propose → approve → check it worked is three rounds.

This is tool-augmented, not agentic. It is also the single highest-value thing to fix,
because every other capability below is worth less without it.

## 2. The web: not connected at all

22 tools. None of them browse, search or fetch. `search_jobs` and `scan_company_jobs` hit
ATS APIs — structured connectors, not the web.

So Fadi cannot look up a certification syllabus, check whether a tool still exists, read a
vendor's docs, or research anything it has no connector for. For a platform whose job is
advising on skills and certifications, that is a hole in the middle of the product.

## 3. Other models: fine, except the one you would expect to work

`lib/ai/registry.ts` supports openai, openrouter, anthropic, groq, google and **ollama**
(keyless, local, via the OpenAI-compatible endpoint).

But `runWithTools` is implemented **only in `providers/openai.ts`**. Everything routed
through `OpenAIProvider` inherits it — Groq, OpenRouter, Google, Ollama. `AnthropicProvider`
does not implement it, and the interface marks it optional, so the chat route silently falls
through to *"Fallback: plain resilient stream (no tools)"*.

**Choose Claude as your provider and Fadi quietly stops being able to act.** No error, no
warning; it just answers instead of doing. That is a bug, not a limitation.

Local models: Ollama does get tools, which is the good news for running this privately. How
well a small local model actually chooses tools is untested here and should not be claimed
either way.

## 4. Multi-agent and swarm: no

- `agent_messages` exists in the schema. **Nothing reads or writes it.** Dead table.
- The "background agent" (`lib/agents/background.ts`) runs a fixed sequence — new roles,
  expired saves, market signals — and inserts findings. It is a scheduled job with good
  manners. There is no delegation, no agent-to-agent message, nothing that could be called a
  swarm.

Calling this multi-agent would be the kind of claim this platform exists to refuse.

## 5. MCP: an excellent server, not a client

`/api/mcp` works — driven end to end this session: `tools/list`, `tools/call`, bearer auth,
per-user tokens, annotations, and the actor recorded as `mcp` in the audit log. An external
agent can use Fadi's tools today.

The reverse does not exist. There is **no MCP client anywhere in the codebase** — no
outbound transport, no server registry. Fadi cannot consume anyone else's tools, so it gains
nothing from the ecosystem it participates in.

This is also the cheapest honest route to something swarm-shaped: consuming other MCP
servers gives Fadi capabilities without Fadi having to become a multi-agent framework.

## What "agentic" would actually take, in value order

1. **Multi-round tool loop.** Bounded (say 5 rounds), tools still offered on each round,
   stop when the model stops asking. Unlocks chaining, recovery and self-verification.
2. **A web research tool**, through the same broker discipline as everything else — the
   model supplies a query, not a URL to fetch.
3. **Tool calling on Anthropic**, or stop offering Anthropic as a provider that can act.
4. **An MCP client**, so Fadi can use other servers' tools under the existing approval flow.
5. **Multi-agent** — only after 1–4, and only if something actually needs it. It is the
   fashionable answer and the least useful one until the single agent can take two steps.

## The honest headline

Fadi is a **tool-augmented assistant with an excellent MCP server and a real permission
broker**. The broker, the audit trail and the approval flow are genuinely good and unusual.
The agent itself is one round deep.
