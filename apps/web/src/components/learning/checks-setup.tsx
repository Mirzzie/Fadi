"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  checksSetupAction,
  checksStateAction,
  type ChecksState,
} from "@/app/dashboard/learning/checks-actions";
import { conductorAction } from "@/app/dashboard/learning/conductor-actions";
import { typeIntoLab, useCanTypeIntoLab } from "@/lib/learning/lab-typing";

/**
 * Set up "Check it for me" in the person's own Windows VMware machine: Fadi types one line of
 * PowerShell into the machine (its SSH server, Fadi's key, a firewall rule for this computer
 * only); the person presses Enter there. No password is asked for or kept.
 */
export function ChecksSetup({ runId, tick }: { runId: string; tick: number }) {
  const [state, setState] = useState<ChecksState | null>(null);
  const [account, setAccount] = useState("Administrator");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canType = useCanTypeIntoLab();

  useEffect(() => {
    let alive = true;
    void checksStateAction({ runId }).then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, [runId, Math.floor(tick / 4)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state?.applicable) return null;

  const setUp = () =>
    startTransition(async () => {
      const result = await checksSetupAction({ runId, account });
      if (!result.ok) return setNote(result.message);
      if (!typeIntoLab(result.script)) {
        return setNote("Open the machine's screen first, then try again.");
      }
      // Chosen, not proven: the line has only been typed. Proof comes from signing in.
      setState({ ...state!, user: account, proven: null });
      setOpen(false);
      setNote(
        "Typed into the machine. In an Administrator PowerShell window there, press Enter — then “Test it now”."
      );
    });

  const test = () =>
    startTransition(async () => {
      await conductorAction({ runId, recheck: ["channel"] });
      const next = await checksStateAction({ runId });
      setState(next);
      setNote(next.proven?.verdict === "pass" ? null : (next.proven?.seen ?? null));
    });

  const proven = state.proven?.verdict === "pass";

  return (
    <div className="border-b border-border/70 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-muted-foreground">
          {!state.user
            ? "“Check it for me” needs one setup line in this machine — no password."
            : proven
              ? `Checks work: ${state.proven!.seen ?? `Fadi signs in as ${state.user}.`}`
              : `Account ${state.user} chosen — not working yet. Fadi hasn't been able to sign in.`}
        </span>
        {state.user && !proven ? (
          <Button size="sm" className="h-7" disabled={pending} onClick={test}>
            Test it now
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="h-7" onClick={() => setOpen((v) => !v)}>
          {state.user ? "Set up again" : "Set up checks"}
        </Button>
      </div>
      {open ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-muted-foreground" htmlFor="checks-account">
            Windows account in the machine
          </label>
          <input
            id="checks-account"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            className="h-7 w-40 rounded-md border border-border bg-background px-2"
          />
          <Button size="sm" className="h-7" disabled={pending || !canType} onClick={setUp}>
            Type setup into the machine
          </Button>
          <span className="w-full text-muted-foreground">
            Click into an Administrator PowerShell window in the machine first. Fadi types one line
            — it starts Windows&apos; SSH server, lets Fadi&apos;s key in, and opens SSH to this
            computer only.
          </span>
        </div>
      ) : null}
      {note ? <p className="mt-2 text-warning">{note}</p> : null}
    </div>
  );
}
