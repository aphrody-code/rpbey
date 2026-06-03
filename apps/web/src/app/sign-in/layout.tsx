import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion | RPB",
  description: "Se connecter à la République Populaire du Beyblade",
};

export const dynamic = "force-dynamic";

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
