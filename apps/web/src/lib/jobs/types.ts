export type ApplicationStatus =
  | "interested"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export type RecommendedJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remoteMode: string | null;
  employmentType: string | null;
  seniority: string | null;
  salaryText: string | null;
  description: string | null;
  url: string | null;
  /** When the source says it was posted — null when the source didn't disclose it. */
  postedAt: Date | null;
  /** When OUR system first ingested it — drives "new since your last visit". */
  firstSeenAt: Date;
  matchScore: number;
  matchReason: string;
  matchedKeywords: string[];
  /** Whether the job is the right KIND of role for the user (drives relevance filtering). */
  onRole: boolean;
  /** Same field as the user but a different role — shown only when nothing is on-role. */
  fieldRelated: boolean;
  /** The role needs well above the user's experience level (e.g. 8–10 yrs for an early-career profile). */
  overLevel: boolean;
  isSaved: boolean;
  applicationStatus: ApplicationStatus | null;
};
