import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Modifier mon Profil",
};

export const dynamic = "force-dynamic";

export default function EditProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
