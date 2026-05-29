/**
 * RPB - Public Profile Page
 * Publicly accessible blader profile with dynamic metadata
 */

import { type Metadata } from "next";
import { db, schema, eq } from "@/lib/db";
import PublicProfile from "./_components/PublicProfile";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  const userRow = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    columns: { name: true, image: true },
    with: {
      profiles: {
        columns: {
          bladerName: true,
          rankingPoints: true,
          wins: true,
          losses: true,
          tournamentWins: true,
        },
      },
    },
  });
  const user = userRow ? { ...userRow, profile: userRow.profiles[0] ?? null } : null;

  if (!user) {
    return {
      title: "Profil introuvable",
      description: "Ce profil de blader est introuvable sur RPB.",
    };
  }

  const bladerName = user.profile?.bladerName ?? user.name ?? "Blader";
  const wins = user.profile?.wins ?? 0;
  const losses = user.profile?.losses ?? 0;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const points = user.profile?.rankingPoints ?? 0;
  const tournamentWins = user.profile?.tournamentWins ?? 0;

  // Build a rich description
  const descriptionParts: string[] = [`Profil de ${bladerName} sur RPB.`];

  if (totalMatches > 0) {
    descriptionParts.push(`${wins}V/${losses}D (${winRate}% de victoires).`);
  }

  if (points > 0) {
    descriptionParts.push(`${points} points au classement.`);
  }

  if (tournamentWins > 0) {
    descriptionParts.push(
      `${tournamentWins} tournoi${tournamentWins > 1 ? "s" : ""} remporté${tournamentWins > 1 ? "s" : ""}.`,
    );
  }

  const description = descriptionParts.join(" ");
  const avatarUrl = user.image;

  return {
    title: `${bladerName} - Profil`,
    description,
    keywords: [bladerName, "Beyblade X", "profil blader", "RPB", "classement", "tournoi Beyblade"],
    alternates: {
      canonical: `https://rpbey.fr/profile/${id}`,
    },
    openGraph: {
      title: `${bladerName} - Profil | RPB`,
      description,
      type: "profile",
      ...(avatarUrl && {
        images: [
          {
            url: avatarUrl,
            width: 256,
            height: 256,
            alt: `Avatar de ${bladerName}`,
          },
        ],
      }),
    },
    twitter: {
      card: "summary",
      title: `${bladerName} - Profil | RPB`,
      description,
      ...(avatarUrl && { images: [avatarUrl] }),
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { id } = await params;

  return <PublicProfile id={id} />;
}
