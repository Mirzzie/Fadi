import "server-only";

import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/observability/logger";

/**
 * Pluggable transactional email — the missing piece that blocked password
 * reset / email verification (see auth security audit). Zero-dependency:
 * Resend's HTTP API via fetch. Configure with RESEND_API_KEY + EMAIL_FROM.
 *
 * Without a key, sends are logged instead (so the full reset flow is testable
 * locally) — and in production the auth flows that depend on email stay
 * honest: requestPasswordReset still answers neutrally, but the operator sees
 * an error log rather than users silently never receiving mail.
 */

const RESEND_API = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(serverEnv.RESEND_API_KEY && serverEnv.EMAIL_FROM);
}

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(message: EmailMessage): Promise<{ ok: boolean }> {
  if (!isEmailConfigured()) {
    const log = process.env.NODE_ENV === "production" ? logger.error : logger.info;
    log("email.not_configured", {
      to: message.to,
      subject: message.subject,
      // Dev convenience: the body carries the reset/verify link.
      preview: process.env.NODE_ENV === "production" ? undefined : message.text,
    });
    return { ok: false };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: serverEnv.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      logger.error("email.send_failed", { status: res.status, subject: message.subject });
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    logger.error("email.send_failed", {
      error: err instanceof Error ? err.message : "unknown",
      subject: message.subject,
    });
    return { ok: false };
  }
}

/** Plain, human email bodies — same voice rules as everything Fadi writes:
 *  no hype, no corporate filler, one clear action. */
export function resetPasswordEmail(url: string): Pick<EmailMessage, "subject" | "text" | "html"> {
  return {
    subject: "Reset your FadiOS password",
    text: `Someone (hopefully you) asked to reset your FadiOS password.\n\nReset it here: ${url}\n\nIf this wasn't you, ignore this email — your password is unchanged. The link expires in 1 hour.`,
    html: `<p>Someone (hopefully you) asked to reset your FadiOS password.</p><p><a href="${url}">Reset your password</a></p><p>If this wasn't you, ignore this email — your password is unchanged. The link expires in 1 hour.</p>`,
  };
}

export function verifyEmailEmail(url: string): Pick<EmailMessage, "subject" | "text" | "html"> {
  return {
    subject: "Verify your FadiOS email",
    text: `Confirm this is your email address to secure your FadiOS account.\n\nVerify here: ${url}\n\nIf you didn't create a FadiOS account, ignore this email.`,
    html: `<p>Confirm this is your email address to secure your FadiOS account.</p><p><a href="${url}">Verify your email</a></p><p>If you didn't create a FadiOS account, ignore this email.</p>`,
  };
}
