import { type Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mon Deck",
};

export default function DeckRedirectPage() {
  redirect("/builder");
}
