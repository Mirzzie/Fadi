import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type AuthShellProps = {
  mode: "sign-in" | "sign-up";
};

export function AuthShell({ mode }: AuthShellProps) {
  const isSignUp = mode === "sign-up";

  return (
    <div className="mx-auto flex min-h-screen max-w-shell items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignUp ? "Create your account" : "Welcome back"}</CardTitle>
          <CardDescription>
            {isSignUp
              ? "Start your first Career Intelligence Report."
              : "Return to your CareerOS AI workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Button className="w-full" variant="outline" type="button">
            Continue with Google
          </Button>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="********" />
            </div>
            <Button className="w-full" type="button">
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "New to CareerOS AI?"}{" "}
            <Link
              href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {isSignUp ? "Sign in" : "Create one"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
