import "server-only";

import { getLaborMarketSnapshot } from "@/lib/labor-market/bls";
import type { KaiTool, KaiToolResult } from "./types";

/** Real US labor-market data (BLS) so Kai grounds "how's the market" in facts. */
export const getLaborMarket: KaiTool = {
  name: "get_labor_market",
  description:
    "Get real US labor-market data from the Bureau of Labor Statistics: unemployment rate, total job openings (JOLTS), and quits rate, each with month-over-month trend. Use for 'how's the job market', 'is hiring slowing down', 'market conditions', or to ground morale/strategy context.",
  parameters: { type: "object", properties: {} },

  async execute(): Promise<KaiToolResult> {
    const snap = await getLaborMarketSnapshot();
    if (!snap.summary) {
      return { summary: "Live labor-market data isn't available right now.", view: "none" };
    }
    return { summary: snap.summary, view: "labor", data: snap };
  },
};
