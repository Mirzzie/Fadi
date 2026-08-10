"use client";

import { useState } from "react";

/** Read-only connection code with a copy button. */
export function ConnectCode({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the user can still select the text manually */
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      <input
        readOnly
        value={token}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Extension connection code"
        style={{
          flex: 1,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #8884",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
          background: "transparent",
          color: "inherit",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      />
      <button
        type="button"
        onClick={copy}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: 0,
          fontWeight: 600,
          cursor: "pointer",
          background: "#0f766e",
          color: "#fff",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "Copied ✓" : "Copy code"}
      </button>
    </div>
  );
}
