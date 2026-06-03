import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inscription | RPB",
  description: "Créer un compte RPB",
};

export const dynamic = "force-dynamic";

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
