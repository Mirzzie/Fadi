"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import type { SocialProvider } from "@/lib/auth/social";

const LABELS: Record<SocialProvider, string> = {
  google: "Continue with Google",
  linkedin: "Continue with LinkedIn",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.44.35-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="#0A66C2" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45z" />
    </svg>
  );
}

/** Social sign-in buttons — rendered only for providers the server says are configured. */
export function SocialButtons({ providers }: { providers: SocialProvider[] }) {
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null);

  if (providers.length === 0) return null;

  async function signIn(provider: SocialProvider) {
    setPendingProvider(provider);
    try {
      await authClient.signIn.social({ provider, callbackURL: "/dashboard" });
    } finally {
      // Normally the browser navigates away; reset covers the error path.
      setPendingProvider(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className="w-full"
            disabled={pendingProvider !== null}
            onClick={() => signIn(provider)}
          >
            {pendingProvider === provider ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : provider === "google" ? (
              <GoogleIcon />
            ) : (
              <LinkedInIcon />
            )}
            {LABELS[provider]}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or with email</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
