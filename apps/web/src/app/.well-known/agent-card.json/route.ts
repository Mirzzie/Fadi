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
      {
        id: "voice-turn",
        name: "Ask or tell Fadi anything",
        description:
          'Any other line is answered by Fadi\'s own agent, shaped to be spoken. Questions are answered from your data. A change is never made straight away: it comes back as an INPUT_REQUIRED task whose metadata["fadi.heldChange"] names the tool and the exact read-back; reply confirm or cancel on that taskId. Pass contextId to follow up ("save the second one"). Machine, lab and publishing actions are not available here.',
        tags: ["career", "voice", "jobs", "applications", "documents", "learning"],
        examples: [
          "Find remote junior security roles in Dublin",
          "Save the second one",
          "I got an interview with Stripe",
          "What should I do today?",
          "Take on the phishing flagship",
        ],
      },
    ],
  });
}
