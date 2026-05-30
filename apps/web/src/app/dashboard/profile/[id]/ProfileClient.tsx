/**
 * RPB - Profile Page (dashboard privé)
 * Vue de profil blader complète. Le markup est factorisé dans `ProfileView`
 * (partagé avec la page marketing publique `/profile/[id]`).
 */

"use client";

import { use } from "react";
import { ProfileView } from "@/components/profile";
import { useAuth } from "@/hooks";

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function ProfileClient({ params }: ProfilePageProps) {
  const { id } = use(params);
  const { user: currentUser } = useAuth();

  // "me" → profil de l'utilisateur connecté.
  const userId = id === "me" ? currentUser?.id : id;
  const isOwnProfile = currentUser?.id === userId;

  return <ProfileView userId={userId} isOwnProfile={isOwnProfile} showDiscordRoles />;
}
