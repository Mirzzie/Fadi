// Public surface of the shared portfolio presentation layer. Both the Fadi app and the
// static export site import from "@careeros/portfolio" — one source of truth, no drift, and
// no app reaching across into another app's src/.

// View contract + mapper (pure).
export * from "./view";
export * from "./work-index";
export * from "./identity";
export * from "./integrity";
export * from "./themes";
export * from "./portfolio-theme";
export * from "./media";
export * from "./persona";

// Render components (client where they use framer-motion).
export * from "./reveal";
export * from "./site-chrome";
export * from "./welcome-gate";
export * from "./tune-the-story";
export * from "./resume-button";
export * from "./gallery-lightbox";
export * from "./portfolio-template";
export * from "./work-template";
export * from "./skill-filter";
export * from "./feedback-form";
export * from "./analytics-client";
export * from "./case-study-template";
