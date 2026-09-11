import { specForProject } from "@/lib/lab/spec-from-project";

/**
 * DOES THIS ACTUALLY NEED A MACHINE?
 *
 * Fadi already derives what a project requires — it just used to print the derivation onto
 * every card, along with three buttons for registering hardware, before the person had
 * committed to anything. Ten suggestions meant ten copies of the provisioning apparatus and
 * a page you could not read.
 *
 * The same derivation, used instead of displayed. A card says at most one short phrase, and
 * the machinery appears after you commit, only for the items that need it.
 *
 * A certification or a course needs no lab however much hardware vocabulary its description
 * happens to contain — the kind of the item settles that before any text matching starts.
 */

export type LabNeed =
  | { needed: false }
  | { needed: true; kind: "containers" | "vms"; phrase: string };

export function labNeedFor(item: {
  kind: string;
  title: string;
  detail?: string | null;
}): LabNeed {
  // Reading about a thing is not running it.
  if (item.kind !== "project" && item.kind !== "practice") return { needed: false };

  const spec = specForProject({ title: item.title, detail: item.detail });
  if (spec.spec.needs === "vms") {
    return {
      needed: true,
      kind: "vms",
      // Said in one clause, because the card has room for one clause.
      phrase: "needs a virtual machine",
    };
  }
  if (spec.spec.needs === "containers") {
    return { needed: true, kind: "containers", phrase: "needs a container" };
  }
  return { needed: false };
}

/**
 * IS THIS WORTH A REPOSITORY?
 *
 * Not everything is. A certification is a thing you sit; a course is a thing you watch.
 * Making a repo for either leaves someone's GitHub full of empty folders that say nothing
 * about them, which is worse than having no repo at all — a profile of abandoned husks
 * reads as someone who starts things.
 *
 * A build produces files. That is the whole test.
 */
export function worthARepo(item: { kind: string }): boolean {
  return item.kind === "project";
}
