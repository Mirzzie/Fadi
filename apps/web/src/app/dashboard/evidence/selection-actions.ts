"use server";
import { z } from "zod";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { buildCareerContext, saveCareerSelection } from "@/lib/career/context";

const scopeSchema = z
  .object({
    directionId: z.string().uuid().nullable().optional(),
    applicationId: z.string().uuid().nullable().optional(),
    jobId: z.string().uuid().nullable().optional(),
  })
  .strict();
const selectionSchema = z
  .object({
    factId: z.string().uuid(),
    mode: z.enum(["auto", "include", "exclude", "inherit"]),
    keepWording: z.boolean(),
    sortOrder: z.number().int().min(0).max(10000),
  })
  .strict();
export async function loadCareerSelectionAction(input: z.infer<typeof scopeSchema>) {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Please sign in again.");
  const context = await buildCareerContext(user.id, scopeSchema.parse(input));
  return {
    scope: {
      directionId: context.payload.directionId,
      applicationId: context.payload.applicationId,
      jobId: context.payload.jobId,
    },
    label: context.payload.applicationId
      ? `This application · ${context.payload.job?.title ?? "Selected job"}`
      : (context.payload.direction?.role ?? "Choose a direction"),
    available: context.available,
    selected: context.payload.records.map((r) => r.factId),
    overrides: context.preferences
      .filter((p) => p.scope === (context.applicationScope ?? context.directionScope))
      .map((p) => p.factId),
  };
}
export async function saveCareerSelectionAction(
  scope: z.infer<typeof scopeSchema>,
  selection: z.infer<typeof selectionSchema>
) {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Please sign in again.");
  const validated = scopeSchema.parse(scope);
  if (!validated.directionId && !validated.applicationId)
    throw new Error("Choose a direction first.");
  await saveCareerSelection(user.id, validated, selectionSchema.parse(selection));
  return loadCareerSelectionAction(validated);
}
