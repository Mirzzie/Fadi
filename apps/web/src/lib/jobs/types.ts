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
  matchScore: number;
  matchReason: string;
  matchedKeywords: string[];
  isSaved: boolean;
  applicationStatus: ApplicationStatus | null;
};
