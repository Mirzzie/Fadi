"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  listPendingActions,
  type PendingActionView,
} from "@/app/dashboard/learning/permission-actions";

/**
 * WHO OWNS THE QUEUE OF THINGS WAITING FOR YOU.
 *
 * This exists because of a hole Codex named in review and I had suspected: the approval
 * panel polled for pending actions *itself*, and only on the Learning page. A model that
 * proposed a container while the user was reading job applications got no answer, because
 * the question was drawn on a screen nobody was looking at.
 *
 * A decision that only exists where you happen to be standing is not a decision you were
 * offered. So the queue is owned once, at the shell, and every surface renders from it:
 * the indicator in the menu bar, the panel in Learning, and later the project workspace.
 * One request id, one state, no chance of two surfaces disagreeing about what is waiting.
 *
 * It deliberately does NOT own approve/deny. Those are server actions with their own
 * consequences, and a context that could execute them would make "the queue" a thing that
 * can change your machine. It holds what is waiting and how to ask again.
 */

type PendingActionsState = {
  pending: PendingActionView[];
  /** True until the first fetch resolves, so nothing renders "0 waiting" before it knows. */
  loading: boolean;
  refresh: () => void;
};

const PendingActionsContext = createContext<PendingActionsState>({
  pending: [],
  loading: true,
  refresh: () => {},
});

export function usePendingActions(): PendingActionsState {
  return useContext(PendingActionsContext);
}

/** How often the shell asks. Slow enough to be free, fast enough that a prompt is not missed. */
const POLL_MS = 15_000;

export function PendingActionsProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingActionView[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await listPendingActions();
      if (res.ok) setPending(res.pending ?? []);
    } catch {
      // A failed poll leaves the previous queue standing rather than emptying it. Showing
      // "nothing waiting" because a request failed would be a lie in the one direction
      // that matters.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Only while someone is looking. Every open tab polled forever, hidden or not.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);

    // A surface that just approved or denied something should not wait out the interval to
    // show it gone.
    const onChanged = () => void refresh();
    window.addEventListener("fadi:actions-changed", onChanged);

    // Coming back to the tab is exactly when someone wants to know what is waiting.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      window.removeEventListener("fadi:actions-changed", onChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ pending, loading, refresh: () => void refresh() }),
    [pending, loading, refresh],
  );

  return (
    <PendingActionsContext.Provider value={value}>{children}</PendingActionsContext.Provider>
  );
}

/** Tell every surface the queue moved. Called after an approval, denial or new proposal. */
export function announceActionsChanged() {
  window.dispatchEvent(new Event("fadi:actions-changed"));
}
