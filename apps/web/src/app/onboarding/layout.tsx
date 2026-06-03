import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding | RPB TV",
  description: "Configure ton profil de Blader",
};

export const dynamic = "force-dynamic";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
