"use client";

import { useState } from "react";
import Link from "next/link";
import { PageIntro } from "@/components/layout/page-intro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { CommandBlock } from "@/components/learning/step-text";

/** Actual shared primitives with local-only examples, not copied account screens. */
export function SystemReview() {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <header className="fadi-glass sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-between gap-2 border-b px-5 py-3 text-sm">
        <Link href="/" className="font-semibold">
          Fadi
        </Link>
        <nav aria-label="Design review" className="flex gap-4 text-xs">
          <Link href="/design/guide">Moving guide</Link>
          <Link href="/">Landing</Link>
        </nav>
        <span className="text-xs text-muted-foreground">
          Component review · sample content only
        </span>
      </header>
      <main className="workspace-page space-y-8 px-5 pb-16 pt-7 sm:px-8">
        <PageIntro
          eyebrow="Shared design system"
          title="One workspace. A consistent rhythm."
          description="These are the actual heading, form, card, dialog, sheet and tab components used across Fadi. The examples below have no database or AI connection."
        />
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Room to do the work</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setSaved(true);
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="sample-title" className="mb-2 block text-sm font-medium">
                    Working title
                  </label>
                  <Input id="sample-title" placeholder="A note for your next step" required />
                </div>
                <div>
                  <label htmlFor="sample-reflection" className="mb-2 block text-sm font-medium">
                    Your reflection
                  </label>
                  <Textarea
                    id="sample-reflection"
                    placeholder="What did you try, and what would you change?"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Save example</Button>
                  <Button type="button" variant="outline" onClick={() => setSaved(false)}>
                    Reset feedback
                  </Button>
                  <Button type="button" disabled>
                    Unavailable action
                  </Button>
                </div>
                <p role="status" className="min-h-5 text-sm text-success">
                  {saved ? "Example saved locally. Your career record is unchanged." : ""}
                </p>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Clear states in every palette</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="rounded-lg border border-success/30 bg-success/10 p-3 text-success">
                Saved · Your changes are recorded.
              </p>
              <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning">
                Needs review · Check the missing context.
              </p>
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                Could not save · Keep your draft and retry.
              </p>
              <p className="rounded-lg border border-info/30 bg-info/10 p-3 text-info">
                In progress · Return to this step when ready.
              </p>
            </CardContent>
          </Card>
        </div>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-base font-semibold">Details when you need them</h2>
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>Review dialog</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Review the example</DialogTitle>
                  <DialogDescription>
                    This uses the shared dialog. Escape closes it and returns focus.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {Array.from({ length: 18 }, (_, i) => (
                    <p key={i} className="text-sm leading-6">
                      Example detail {i + 1}. Long content should scroll inside the bounded dialog
                      rather than run off the screen.
                    </p>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger render={<Button variant="outline" />}>Open context</SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Context, not another workspace</SheetTitle>
                  <SheetDescription>
                    Supplementary information stays separate from the primary action.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 p-4">
                  {Array.from({ length: 18 }, (_, i) => (
                    <p key={i} className="text-sm leading-6">
                      Context item {i + 1}. This opaque surface remains readable in Light and Dark.
                    </p>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </section>
        <Tabs defaultValue="work">
          <TabsList aria-label="Example work views">
            <TabsTrigger value="work">Your work</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="work" className="py-4">
            One primary work view. Navigation stays in the dock.
          </TabsContent>
          <TabsContent value="history" className="py-4">
            Recorded outcomes belong beside their work.
          </TabsContent>
        </Tabs>
        <AppearanceSettings />
        <section aria-label="Command fallback example">
          <h2 className="mb-3 text-lg font-semibold">Manual command fallback</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Sample text only. Copying does not run it.
          </p>
          <CommandBlock code={'printf "local example"'} lang="sh" typeable={false} />
        </section>
      </main>
    </>
  );
}
