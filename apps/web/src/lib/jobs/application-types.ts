/** Client-safe shared types for applications + document kinds (no server deps). */

export type ApplicationStatus =
  | "interested"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export type DocKind = "resume" | "cover_letter" | "email" | "value_proposition";
