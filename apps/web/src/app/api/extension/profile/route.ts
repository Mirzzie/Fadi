import { NextResponse } from "next/server";

import { createProfilesRepository } from "@careeros/database";

import { getExtensionUser } from "@/lib/extension/auth";
import { getDatabase } from "@/lib/database/client";

// Serves the user's verified basics to the Fadi extension for application autofill. Read-only,
// session-auth'd. Doctrine: only the user's own real details — the extension never invents.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withCors(res: NextResponse, origin: string | null): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", origin ?? "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Vary", "Origin");
  return res;
}

export function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req.headers.get("origin"));
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  const user = await getExtensionUser(req);
  if (!user) {
    return withCors(NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 }), origin);
  }
  const profile = await createProfilesRepository(getDatabase())
    .getByUserId(user.id)
    .catch(() => null);
  const loc = profile?.jobPreferences?.location;
  return withCors(
    NextResponse.json({
      ok: true,
      profile: {
        name: profile?.fullName ?? "",
        email: user.email ?? "",
        location: [loc?.city, loc?.country].filter(Boolean).join(", "),
      },
    }),
    origin,
  );
}
