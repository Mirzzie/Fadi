import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { signExtensionToken } from "@/lib/extension/token";

import { ConnectCode } from "./connect-code";

export const metadata: Metadata = { title: "Connect the Fadi extension" };
export const dynamic = "force-dynamic";

const wrap = {
  maxWidth: 560,
  margin: "0 auto",
  padding: "48px 24px",
  lineHeight: 1.55,
} as const;

export default async function ExtensionConnectPage() {
  const user = await getCurrentAuthUser();

  if (!user) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Connect the Fadi extension</h1>
        <p style={{ opacity: 0.8, marginBottom: 20 }}>
          Sign in to Fadi first, then come back here to get your one-time connection code for the
          browser extension.
        </p>
        <Link
          href="/auth/sign-in?redirect=/extension/connect"
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 8,
            background: "#0f766e",
            color: "#fff",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Sign in to Fadi
        </Link>
      </main>
    );
  }

  const token = signExtensionToken(user.id);

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Connect the Fadi extension</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        The browser extension can&rsquo;t read your Fadi login cookie directly, so paste this code
        into it once. It links the extension to <strong>{user.email}</strong>.
      </p>

      <ConnectCode token={token} />

      <ol style={{ marginTop: 24, paddingLeft: 20, opacity: 0.9 }}>
        <li style={{ marginBottom: 6 }}>Copy the code above.</li>
        <li style={{ marginBottom: 6 }}>
          Click the Fadi extension icon, paste it into <em>Connection code</em>, and press{" "}
          <em>Connect</em>.
        </li>
        <li>That&rsquo;s it — scraping and autofill now save straight to your account.</li>
      </ol>

      <p style={{ marginTop: 24, fontSize: 12, opacity: 0.6 }}>
        This code is valid for 90 days and grants the extension access to your Fadi account. Keep it
        private; re-open this page any time to get a fresh one.
      </p>
    </main>
  );
}
