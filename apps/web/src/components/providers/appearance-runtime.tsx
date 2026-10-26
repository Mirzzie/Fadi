"use client";

import { useEffect } from "react";
import { observeAppearanceChanges } from "../../lib/appearance/browser";

/** One listener for the whole app, regardless of how many controls project the preference. */
export function AppearanceRuntime() {
  useEffect(observeAppearanceChanges, []);
  return null;
}
