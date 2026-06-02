import type { Metadata } from "next";

import { AuthShell } from "@/components/shells/auth-shell";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignUpPage() {
  return <AuthShell mode="sign-up" />;
}
