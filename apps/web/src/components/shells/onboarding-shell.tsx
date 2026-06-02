import { Upload, UserRoundCheck, WandSparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const steps = [
  {
    title: "CV upload",
    description: "Capture experience, skills, education, and achievements.",
    icon: Upload,
  },
  {
    title: "Profile context",
    description: "Add LinkedIn text or confirm details manually.",
    icon: UserRoundCheck,
  },
  {
    title: "Career report",
    description: "Generate the first Career Intelligence Report.",
    icon: WandSparkles,
  },
];

export function OnboardingShell() {
  return (
    <div className="mx-auto grid max-w-shell gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <Badge variant="secondary">Onboarding shell</Badge>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Build your career profile</h1>
          <p className="text-muted-foreground">
            This foundation captures the MVP onboarding structure without parsing files, importing
            LinkedIn, or generating AI output yet.
          </p>
        </div>
        <div className="grid gap-3">
          {steps.map((step) => (
            <Card key={step.title}>
              <CardContent className="flex gap-4 p-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <step.icon className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-medium">{step.title}</h2>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Profile foundation</CardTitle>
          <CardDescription>Static form shell for the first onboarding pass.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="target-role">Target role</Label>
              <Input id="target-role" placeholder="Product Analyst" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Preferred location</Label>
              <Input id="location" placeholder="Ireland, UK, remote" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn profile text</Label>
            <Textarea id="linkedin" placeholder="Paste LinkedIn context here..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goals">Career goal</Label>
            <Textarea
              id="goals"
              placeholder="Describe what you want CareerOS AI to optimize for."
            />
          </div>
          <Button type="button" className="w-full">
            Continue to report preview
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
