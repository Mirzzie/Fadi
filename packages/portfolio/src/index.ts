// Public surface of the shared portfolio presentation layer. Both the Fadi app and the
// static export site import from "@careeros/portfolio" — one source of truth, no drift, and
// no app reaching across into another app's src/.

// View contract + mapper (pure).
export * from "./view";
export * from "./integrity";
export * from "./themes";
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
export * from "./case-study-template";
