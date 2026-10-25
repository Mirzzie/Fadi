import { notFound } from "next/navigation";
import { GuideDemo } from "./guide-demo";

export default function GuidePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <GuideDemo />;
}
