import { redirect } from "next/navigation";

// The Documents library was merged into Applications (the whole apply flow lives in one
// place now: paste a JD → create the application → generate its documents). The library
// is the "Documents" tab there. The per-document EDITOR route (/dashboard/documents/[id])
// stays exactly where it was — every link to it still works. This just retires the old
// standalone list page so a bookmark lands somewhere real instead of 404-ing.
export default function DocumentsLibraryRedirect() {
  redirect("/dashboard/applications");
}
