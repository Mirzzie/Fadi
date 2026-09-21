/**
 * WHERE A PROJECT'S LAB ACTUALLY RUNS — one answer, used by every action.
 *
 * Planning could name a registered machine (a Proxmox server, say) while "Prepare lab" quietly
 * ran `docker run` on this laptop, because every action decided for itself and the fallback was
 * always local. A project named one machine and used another. (Codex review, A07.)
 *
 * The target is resolved from stored identity — the run's resource and that resource's
 * endpoint — never from a label or the project text. Fadi can act on exactly two kinds today:
 * this computer's Docker, and a VMware guest registered by its .vmx path. Anything else is
 * `unconnected`, and actions refuse with a way forward instead of running somewhere else.
 */

export type LabTarget =
  | { kind: "local-docker"; resourceId: string | null; label: string }
  | { kind: "vmware"; resourceId: string; label: string }
  | { kind: "unconnected"; resourceId: string; label: string };

export type TargetResource = { id: string; label: string; endpoint: string | null };

export const THIS_COMPUTER = "This computer";

export function resolveTarget(
  run: { resourceId: string | null },
  resource: TargetResource | null
): LabTarget {
  if (!run.resourceId) return { kind: "local-docker", resourceId: null, label: THIS_COMPUTER };
  // The run points at a machine that no longer exists (removed from the registry). Say so
  // rather than treat "missing" as "this computer".
  if (!resource || resource.id !== run.resourceId) {
    return { kind: "unconnected", resourceId: run.resourceId, label: "A removed machine" };
  }
  if (resource.endpoint?.startsWith("vmware://local")) {
    return { kind: "vmware", resourceId: resource.id, label: resource.label };
  }
  if (resource.endpoint === "local://docker") {
    return { kind: "local-docker", resourceId: resource.id, label: resource.label };
  }
  return { kind: "unconnected", resourceId: resource.id, label: resource.label };
}

/** Whether Fadi can place and run a lab on this resource at all. */
export function isConnected(resource: TargetResource): boolean {
  return resolveTarget({ resourceId: resource.id }, resource).kind !== "unconnected";
}

export function unconnectedMessage(target: LabTarget): string {
  return `This project is placed on ${target.label}, which Fadi can't reach yet. Connect it in Machines, or run the project on this computer instead. Nothing was started anywhere else.`;
}
