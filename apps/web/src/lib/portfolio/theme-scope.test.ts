import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CaseStudyTemplate } from "@careeros/portfolio";

/**
 * The portfolio's colours are scoped to [data-pf-template]. A page without that attribute has
 * no colours of its own: inside Fadi the app's dark styles hid it, but the static GitHub Pages
 * copy rendered the case study as dark text on a dark ground (7 Oct 2026). Rendered here
 * without any app styles, as the static host serves it.
 */
describe("portfolio pages carry their own palette", () => {
  it("scopes the case study page to the palette", () => {
    const html = renderToStaticMarkup(
      createElement(CaseStudyTemplate, {
        backHref: "/",
        site: {
          handle: "someone",
          title: "Someone",
          headline: null,
          template: "work",
          theme: {},
          profile: { name: "Someone" },
          resumeLinks: {},
        },
        item: {
          id: "a",
          section: "projects",
          title: "WordPress on AWS",
          subtitle: null,
          location: null,
          dateRange: null,
          description: "A hardened stack.",
          bullets: [],
          roles: [],
          tag: null,
          url: null,
          imageUrl: null,
          gallery: [],
          isPublished: true,
        },
      })
    );
    expect(html).toMatch(/<main[^>]*data-pf-template=/);
    // And the palette it is scoped to is on the page.
    expect(html).toContain("[data-pf-template]{");
  });
});
