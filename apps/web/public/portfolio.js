/*!
 * Fadi Portfolio SDK — embed a Fadi-managed portfolio on any website.
 *
 * Data only:
 *   <script src="https://YOUR-FADI-HOST/portfolio.js"></script>
 *   <script>
 *     FadiPortfolio.get("your-handle").then(data => console.log(data));
 *   </script>
 *
 * Render into an element:
 *   FadiPortfolio.mount("your-handle", "#portfolio");
 *
 * Auto-mount (zero JS):
 *   <div id="portfolio"></div>
 *   <script src="https://YOUR-FADI-HOST/portfolio.js"
 *           data-handle="your-handle" data-target="#portfolio"></script>
 *
 * The API is public, CORS-open, and returns only published content.
 */
(function () {
  "use strict";

  // The SDK infers the Fadi host from its own <script src>, so consumers don't
  // hardcode it. Override via the `baseUrl` option if you proxy the API.
  var selfScript = document.currentScript;
  var DEFAULT_BASE = (function () {
    try {
      return new URL(selfScript.src).origin;
    } catch (_e) {
      return "";
    }
  })();

  function apiUrl(handle, baseUrl) {
    var base = (baseUrl || DEFAULT_BASE).replace(/\/$/, "");
    return base + "/api/portfolio/" + encodeURIComponent(String(handle).toLowerCase());
  }

  function get(handle, opts) {
    opts = opts || {};
    return fetch(apiUrl(handle, opts.baseUrl), { headers: { Accept: "application/json" } }).then(
      function (res) {
        if (!res.ok) throw new Error("Fadi portfolio not found (" + res.status + ")");
        return res.json();
      },
    );
  }

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  // esc() stops attribute breakout but NOT a `javascript:`/`data:` protocol — those need no
  // special chars, so a link like `javascript:...` would execute on click under this origin.
  // safeUrl allows only web + mailto schemes (and protocol-relative/relative paths); anything
  // else becomes "#". Always wrap a user-supplied href/src with BOTH safeUrl and esc.
  var safeUrl = function (s) {
    var v = String(s == null ? "" : s).trim();
    if (!v) return "";
    if (/^(https?:|mailto:)/i.test(v)) return v;
    if (/^(\/\/|\/|\.\/|#)/.test(v)) return v; // protocol-relative / site-relative / anchor
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return "#"; // any OTHER explicit scheme → blocked
    return v; // bare relative (e.g. "path/x") — no scheme, safe
  };

  var STYLE_ID = "fadi-portfolio-style";
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      ".fadi-pf{--gold:#c9a84c;color:#e7e7ea;background:#0a0a0b;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;padding:clamp(24px,5vw,72px)}" +
      ".fadi-pf *{box-sizing:border-box}" +
      ".fadi-pf .fadi-eyebrow{font-family:ui-monospace,monospace;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--gold)}" +
      ".fadi-pf h1{font-size:clamp(2.5rem,7vw,5rem);font-weight:600;letter-spacing:-.02em;margin:.4rem 0 0}" +
      ".fadi-pf h2{font-size:clamp(1.4rem,3vw,2rem);font-weight:600;margin:3rem 0 1.25rem}" +
      ".fadi-pf .fadi-sub{color:#a1a1aa;font-size:.95rem;margin-top:.75rem}" +
      ".fadi-pf a{color:var(--gold);text-decoration:none}.fadi-pf a:hover{text-decoration:underline}" +
      ".fadi-pf .fadi-wrap{max-width:920px;margin:0 auto}" +
      ".fadi-pf .fadi-card{display:grid;grid-template-columns:1fr;border:1px solid #26262b;border-radius:14px;overflow:hidden;background:#141416;margin-bottom:14px;transition:border-color .2s}" +
      ".fadi-pf .fadi-card:hover{border-color:rgba(201,168,76,.6)}" +
      "@media(min-width:640px){.fadi-pf .fadi-card{grid-template-columns:2fr 3fr}}" +
      ".fadi-pf .fadi-cover{min-height:170px;background:linear-gradient(135deg,rgba(201,168,76,.25),transparent)}" +
      ".fadi-pf .fadi-cover img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".fadi-pf .fadi-body{padding:22px}" +
      ".fadi-pf .fadi-tag{font-family:ui-monospace,monospace;font-size:12px;color:var(--gold)}" +
      ".fadi-pf .fadi-title{font-size:1.4rem;font-weight:600;margin:.4rem 0}" +
      ".fadi-pf .fadi-meta{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#71717a}" +
      ".fadi-pf .fadi-row{border-top:1px solid #26262b;padding:18px 0}" +
      ".fadi-pf .fadi-chip{display:inline-block;border:1px solid #26262b;border-radius:999px;padding:4px 12px;font-size:13px;margin:0 6px 6px 0;color:#c7c7cc}" +
      ".fadi-pf footer{margin-top:56px;border-top:1px solid #26262b;padding-top:22px;font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#71717a}";
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  var SECTION_ORDER = ["project", "experience", "education", "certification", "skill", "custom"];
  var SECTION_LABEL = {
    project: "Selected work",
    experience: "Experience",
    education: "Education",
    certification: "Certifications",
    skill: "Skills",
    custom: "More",
  };

  function renderHTML(data) {
    var site = data.site || {};
    var profile = site.profile || {};
    var items = data.items || [];
    var groups = {};
    items.forEach(function (i) {
      (groups[i.section] = groups[i.section] || []).push(i);
    });

    var out = '<div class="fadi-pf"><div class="fadi-wrap">';
    out +=
      '<header><p class="fadi-eyebrow">' +
      esc(site.headline || "Portfolio") +
      "</p><h1>" +
      esc(profile.name || site.title || "") +
      "</h1>";
    var bits = [];
    if (profile.location) bits.push(esc(profile.location));
    if (site.resumeLinks && site.resumeLinks.default)
      bits.push('<a href="' + esc(site.resumeLinks.default) + '" target="_blank">Download CV</a>');
    if (bits.length) out += '<p class="fadi-sub">' + bits.join(" &middot; ") + "</p>";
    out += "</header>";

    SECTION_ORDER.forEach(function (sec) {
      var rows = groups[sec];
      if (!rows || !rows.length) return;
      out += "<section><h2>" + esc(SECTION_LABEL[sec] || sec) + "</h2>";
      if (sec === "project") {
        rows.forEach(function (it) {
          out += '<div class="fadi-card">';
          out +=
            '<div class="fadi-cover">' +
            (it.imageUrl ? '<img src="' + esc(safeUrl(it.imageUrl)) + '" alt="">' : "") +
            "</div>";
          out += '<div class="fadi-body">';
          if (it.tag) out += '<span class="fadi-tag">' + esc(it.tag) + "</span>";
          out += '<div class="fadi-title">' + esc(it.title) + "</div>";
          var meta = [it.subtitle, it.location, it.dateRange].filter(Boolean).map(esc).join(" · ");
          if (meta) out += '<div class="fadi-meta">' + meta + "</div>";
          if (it.description)
            out += '<p style="color:#a1a1aa;margin-top:10px">' + esc(it.description) + "</p>";
          if (it.url)
            out +=
              '<p style="margin-top:12px"><a href="' +
              esc(safeUrl(it.url)) +
              '" target="_blank" rel="noopener noreferrer nofollow">View source &rarr;</a></p>';
          out += "</div></div>";
        });
      } else if (sec === "skill") {
        rows.forEach(function (it) {
          out += '<span class="fadi-chip">' + esc(it.title) + "</span>";
        });
      } else {
        rows.forEach(function (it) {
          out += '<div class="fadi-row"><strong>' + esc(it.title) + "</strong>";
          var meta = [it.subtitle, it.location, it.dateRange].filter(Boolean).map(esc).join(" · ");
          if (meta) out += '<div class="fadi-sub">' + meta + "</div>";
          if (it.description) out += '<p class="fadi-sub">' + esc(it.description) + "</p>";
          out += "</div>";
        });
      }
      out += "</section>";
    });

    out +=
      "<footer>" + esc(profile.name || site.title || "") + " &middot; Powered by Fadi</footer>";
    out += "</div></div>";
    return out;
  }

  function mount(handle, target, opts) {
    opts = opts || {};
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return Promise.reject(new Error("Fadi: target element not found: " + target));
    injectStyles();
    el.innerHTML = '<div class="fadi-pf"><div class="fadi-wrap">Loading portfolio…</div></div>';
    return get(handle, opts).then(
      function (data) {
        el.innerHTML = renderHTML(data);
        return data;
      },
      function (err) {
        el.innerHTML =
          '<div class="fadi-pf"><div class="fadi-wrap">Could not load portfolio.</div></div>';
        throw err;
      },
    );
  }

  // Render from already-fetched data (no network) — used by static snapshots so
  // a self-contained index.html works offline / on GitHub Pages with no server.
  function mountData(data, target) {
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;
    injectStyles();
    el.innerHTML = renderHTML(data);
  }

  window.FadiPortfolio = { get: get, mount: mount, mountData: mountData, apiUrl: apiUrl };

  // Auto-mount when the script tag carries data-handle + data-target.
  if (selfScript) {
    var h = selfScript.getAttribute("data-handle");
    var t = selfScript.getAttribute("data-target");
    if (h && t) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          mount(h, t);
        });
      } else {
        mount(h, t);
      }
    }
  }
})();
