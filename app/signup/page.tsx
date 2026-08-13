import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up | MiniBoard",
};

export default function SignupPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <SignupForm />
    </main>
  );
}