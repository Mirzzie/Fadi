import { A2A_VERSION } from "@/lib/a2a/server";

/**
 * Fadi's A2A agent card: what it is, where to reach it and what it can be asked to do.
 * Public metadata only — no user data, and nothing here grants access (the endpoint needs a token).
 */

// Dynamic: the card names this server's own origin, which a static build would freeze at
// whatever host built it.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  return Response.json({
    name: "Fadi",
    description:
      "An honest career mentor. Hand it a piece of career work; it plans, does one step at a time and waits for you.",
    version: "0.1.0",
    supportedInterfaces: [
      { url: `${origin}/api/a2a`, protocolBinding: "JSONRPC", protocolVersion: A2A_VERSION },
    ],
    capabilities: { streaming: false, pushNotifications: false },
    securitySchemes: {
      bearer: {
        httpAuthSecurityScheme: {
          scheme: "Bearer",
          description: "A Fadi MCP personal access token",
        },
      },
    },
    security: [{ bearer: [] }],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "apply-to-role",
        name: "Apply to a saved role",
        description:
          "Checks the posting is live, checks fit, tailors your CV and drafts the message; you submit.",
        tags: ["career", "applications"],
        examples: ["Apply to the Deerfoot role"],
      },
    ],
  });
}
