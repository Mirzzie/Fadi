"use client";

import { useEffect } from "react";

import { PERSONA_EVENT } from "./persona";

/** Set by `?not-me=1`; marks this browser as the owner's own. */
export const SELF_KEY = "fadi-portfolio-self";

/**
 * Reports what a visitor DID, to the owner's own Fadi instance. Views are logged
 * server-side when the page renders; this covers the things only a browser can
 * see — the focus someone chose, the piece of work they opened, a CV download, a
 * click on the contact link.
 *
 * Three deliberate properties:
 *   - No cookies, no storage, no identifiers of any kind are sent. The server
 *     derives a per-day pseudonym from the request; nothing here can influence it.
 *   - `keepalive` so a click that navigates away still reports.
 *   - Every failure is swallowed. A reader must never see an analytics error, and
 *     a blocked request must never interrupt a click.
 *
 * IMPORTANT LIMITATION. Reporting needs a collector that is publicly reachable AND
 * running when a stranger visits. A Fadi on localhost is neither, so a portfolio
 * copy on GitHub Pages cannot report to it — the visitor's browser would be posting
 * to its OWN machine. That is why `base` must be set deliberately, and why it points
 * at whatever public collector exists rather than "the Fadi instance".
 */
export function PortfolioAnalytics({
  handle,
  base,
}: {
  handle: string;
  /**
   * Where to report to. `""` means same-origin (the Fadi-served route). An absolute
   * URL is for a copy hosted elsewhere — the GitHub Pages export — pointing back at a
   * PUBLICLY REACHABLE collector.
   *
   * `undefined`/`null` DISABLES reporting, and that is the default on purpose. A
   * static copy on Pages has no `/api` of its own, so a relative post there 404s on
   * every click — silent, useless traffic against someone else's host. Reporting is
   * opt-in by the host that knows it has somewhere to report to.
   */
  base?: string | null;
}) {
  useEffect(() => {
    if (!handle || base === undefined || base === null) return;
    const endpoint = `${base}/api/portfolio/${encodeURIComponent(handle)}/event`;

    // Owner self-exclusion for any browser or device.
    //
    // The server can recognise the owner only on the Fadi-served route, where there
    // is a session. On a copy hosted elsewhere there is none, so the owner marks the
    // browser once by opening their site with `?not-me=1`. The flag then rides along
    // on every report and the server files it as a self-visit rather than an audience.
    //
    // This is the ONE thing written to a visitor's browser, it is written only when
    // someone explicitly asks to be excluded, and it stores no identity — just "don't
    // count me". Wrapped because storage throws outright in some privacy modes.
    let isSelf = false;
    try {
      if (new URLSearchParams(window.location.search).has("not-me")) {
        localStorage.setItem(SELF_KEY, "1");
      }
      isSelf = localStorage.getItem(SELF_KEY) === "1";
    } catch {
      /* storage unavailable — treat as a normal visitor */
    }

    // WHERE THEY CAME FROM — hostname only, never the full referring URL.
    //
    // "linkedin.com" or "google.com" is the useful half and is safe to keep; the rest
    // of a referrer can carry search terms, private board URLs and session tokens, none
    // of which are the owner's business and all of which would have to be stored.
    let ref: string | undefined;
    try {
      ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : undefined;
      if (ref && ref === window.location.hostname) ref = undefined; // internal navigation
    } catch {
      /* malformed referrer — no signal, no problem */
    }

    const send = (type: string, detail: Record<string, string | undefined> = {}) => {
      try {
        void fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, ref, ...detail, ...(isSelf ? { self: true } : {}) }),
          keepalive: true,
          // No cookies are sent — this is a public, anonymous endpoint.
          credentials: "omit",
        }).catch(() => {});
      } catch {
        /* never let reporting break the page */
      }
    };

    // The signal the welcome gate was collecting and discarding: visitors say who
    // they are and what they came for, in the owner's own vocabulary.
    const onPersona = (e: Event) => {
      const d = (e as CustomEvent).detail as { role?: string; interest?: string };
      send("persona_declared", { role: d?.role, interest: d?.interest });
    };
    window.addEventListener(PERSONA_EVENT, onPersona);

    // One delegated listener rather than props threaded through every template:
    // a new template gets analytics for free as long as it keeps the standard
    // `data-portfolio-item` hooks the visitor lens already requires.
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("a");
      if (!el) return;
      const href = el.getAttribute("href") ?? "";

      // Booking is the strongest intent a visitor can show — someone taking a slot
      // in your calendar is worth more than any view count, so it is recorded as a
      // contact rather than as an ordinary outbound link.
      if (
        href.startsWith("mailto:") ||
        el.hasAttribute("data-pf-contact") ||
        el.hasAttribute("data-pf-booking")
      ) {
        // WHICH kind of contact. Booking a slot in someone's calendar and firing off an
        // email are not the same act, and an alert that cannot tell them apart makes the
        // owner open the dashboard to find out — which is the thing the alert exists to
        // save them. The link's own text carries the rest ("Book a call", "Get in touch"),
        // whatever the owner has renamed it to.
        send("contact_clicked", {
          kind: el.hasAttribute("data-pf-booking")
            ? "booking"
            : href.startsWith("mailto:")
              ? "email"
              : "link",
          title: el.textContent?.trim() || undefined,
        });
        return;
      }
      if (el.hasAttribute("data-pf-resume")) {
        send("resume_downloaded", { title: el.textContent?.trim() || undefined });
        return;
      }
      const item = el.closest<HTMLElement>("[data-portfolio-item]");
      if (item && !href.startsWith("#")) {
        send("item_opened", {
          itemId: item.id?.replace(/^item-/, "") || undefined,
          title: item.querySelector("h3")?.textContent?.trim() || undefined,
        });
      }
    };
    document.addEventListener("click", onClick, { capture: true });

    return () => {
      window.removeEventListener(PERSONA_EVENT, onPersona);
      document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
    };
  }, [handle, base]);

  return null;
}
