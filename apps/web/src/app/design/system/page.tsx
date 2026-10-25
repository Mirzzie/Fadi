import { notFound } from "next/navigation";
import { SystemReview } from "./system-review";

export default function SystemReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SystemReview />;
}
