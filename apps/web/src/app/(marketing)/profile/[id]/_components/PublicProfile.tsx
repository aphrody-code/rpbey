"use client";

import { ProfileView } from "@/components/profile";

interface PublicProfileProps {
  id: string;
}

/**
 * Profil blader public (marketing). Markup factorisé dans `ProfileView` (partagé
 * avec le dashboard) — ici en mode lecture seule, sans rôles Discord, enveloppé
 * dans un `<Container>`.
 */
export default function PublicProfile({ id }: PublicProfileProps) {
  return <ProfileView userId={id} withContainer />;
}
