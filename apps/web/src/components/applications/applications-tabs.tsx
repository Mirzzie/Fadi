"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { KanbanSquare, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** One URL-owned view, with mounted panels so switching does not discard a local draft. */
export function ApplicationsTabs({ board, library }: { board: ReactNode; library: ReactNode }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("view") === "documents" ? "documents" : "pipeline";
  function changeView(value: unknown) {
    if ((value !== "documents" && value !== "pipeline") || value === tab) return;
    const url = new URL(window.location.href);
    if (value === "documents") url.searchParams.set("view", "documents");
    else url.searchParams.delete("view");
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
  }
  return (
    <Tabs value={tab} onValueChange={changeView} className="space-y-4">
      <TabsList
        variant="line"
        aria-label="Application workspace views"
        className="h-auto w-fit max-w-full p-1"
      >
        <TabsTrigger value="pipeline" className="min-h-10 px-3">
          <KanbanSquare aria-hidden="true" />
          Pipeline
        </TabsTrigger>
        <TabsTrigger value="documents" className="min-h-10 px-3">
          <FileText aria-hidden="true" />
          Documents
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pipeline" keepMounted>
        {board}
      </TabsContent>
      <TabsContent value="documents" keepMounted>
        {library}
      </TabsContent>
    </Tabs>
  );
}
