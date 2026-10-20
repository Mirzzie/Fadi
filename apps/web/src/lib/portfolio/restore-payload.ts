import { z } from "zod";

/**
 * WHAT A RESTORE FILE IS ALLOWED TO CONTAIN.
 *
 * The first version parsed remote JSON and handed it straight to the importer: no schema, no row
 * cap, no string cap. `fromExportItem(null)` throws, nested objects flowed into text columns
 * until the database complained, and a large valid payload could be inserted unbounded
 * (Codex C15-04). A file fetched from outside the process is input, not data.
 *
 * The caps are deliberately generous for a real portfolio and far below anything that could hurt:
 * a person with 500 entries has other problems, and no single field of a CMS entry is a megabyte.
 */
export const MAX_RESTORE_BYTES = 2_000_000;
const MAX_ITEMS = 500;
const MAX_TEXT = 20_000;
const MAX_LIST = 100;

const url = z
  .string()
  .max(2_048)
  .refine((v) => /^https?:\/\//i.test(v), "only http(s) links are restored");

const text = z.string().max(MAX_TEXT);

const item = z
  .object({
    section: text,
    title: text,
    subtitle: text.nullish(),
    location: text.nullish(),
    date_range: text.nullish(),
    description: text.nullish(),
    bullets: z.array(text).max(MAX_LIST).nullish(),
    roles: z.array(text).max(MAX_LIST).nullish(),
    tag: text.nullish(),
    url: url.nullish(),
    image_url: url.nullish(),
    gallery: z.array(url).max(MAX_LIST).nullish(),
    sort_order: z.number().finite().nullish(),
    is_published: z.boolean().nullish(),
  })
  // Unknown keys are dropped rather than rejected: a file written by a newer Fadi should still
  // restore the parts this one understands.
  .passthrough();

export const restorePayloadSchema = z.object({
  version: z.literal(1),
  exported_at: z.string().max(64).optional(),
  items: z.array(item).max(MAX_ITEMS),
});

export type RestorePayload = z.infer<typeof restorePayloadSchema>;

/** Parse a restore file, saying plainly why it is refused. */
export function readRestorePayload(
  raw: string
): { ok: true; payload: RestorePayload } | { ok: false; message: string } {
  if (raw.length > MAX_RESTORE_BYTES) {
    return { ok: false, message: "That backup file is too large to restore." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "That file isn't valid JSON — it may not be a Fadi backup." };
  }
  const result = restorePayloadSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      message: first
        ? `That backup doesn't look right (${first.path.join(".") || "file"}: ${first.message}).`
        : "That backup doesn't look like a Fadi portfolio file.",
    };
  }
  return { ok: true, payload: result.data };
}
