import "server-only";

import { createLabResourcesRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";

import { assessReadiness, type Readiness } from "./readiness";

/** The readiness of one project's lab: its machine (VMware or Fadi's own) and its services. */
export async function readinessFor(
  userId: string,
  run: { id: string; title: string; detail: string | null; resourceId: string | null }
): Promise<Readiness> {
  const { vmxPathOf } = await import("./vmware");
  const resource = run.resourceId
    ? await createLabResourcesRepository(getDatabase()).get(userId, run.resourceId)
    : null;
  const vmxPath = vmxPathOf(resource?.endpoint);

  let fresh: { label: string; ramMb: number; running: boolean } | null = null;
  if (!vmxPath) {
    const { templateForProject } = await import("./spec-from-project");
    const template = templateForProject({ title: run.title, detail: run.detail });
    if (template) {
      const { LAB_TEMPLATES } = await import("./templates");
      const { observeProjectRuntime } = await import("./runtime-observer");
      const runtime = await observeProjectRuntime(userId, run.id);
      fresh = {
        label: LAB_TEMPLATES[template].label,
        ramMb: LAB_TEMPLATES[template].ramMb,
        running: Boolean(runtime && ["ready", "booting", "installing"].includes(runtime.phase)),
      };
    }
  }

  const { gatherReadinessFacts } = await import("./readiness-facts");
  return assessReadiness(
    await gatherReadinessFacts({
      userId,
      runId: run.id,
      title: run.title,
      detail: run.detail,
      vmware: resource && vmxPath ? { label: resource.label, vmxPath } : null,
      fresh,
    })
  );
}
