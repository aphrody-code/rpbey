/**
 * Libellés FR partagés entre l'édition et l'affichage du profil (saisons,
 * niveaux d'expérience, types favoris, visibilité, thème). Source unique pour
 * éviter la divergence entre les selects du formulaire et le rendu public.
 */

export const FAVORITE_SEASONS = [
  { value: "ORIGINAL", label: "Bakuten / Saga originale" },
  { value: "METAL", label: "Metal" },
  { value: "BURST", label: "Burst" },
  { value: "X", label: "X" },
] as const;

export const BEYBLADE_TYPES = [
  { value: "ATTACK", label: "Attaque" },
  { value: "DEFENSE", label: "Défense" },
  { value: "STAMINA", label: "Endurance" },
  { value: "BALANCE", label: "Équilibre" },
] as const;

// ⚠️ Aligné sur l'enum DB `ExperienceLevel` (@rpbey/db) + le contrat
// `ProfileUpdateInputSchema.experience`. Ne PAS ajouter de valeur hors enum
// (ex. "COMPETITIVE") : le PATCH /api/profile renverrait 422 (Zod) et un write
// direct casserait l'enum Postgres.
export const EXPERIENCE_LEVELS = [
  { value: "BEGINNER", label: "Débutant (0-1 ans)" },
  { value: "INTERMEDIATE", label: "Intermédiaire (1-3 ans)" },
  { value: "ADVANCED", label: "Avancé (3+ ans)" },
  { value: "EXPERT", label: "Expert" },
  { value: "LEGEND", label: "Légende" },
] as const;

export const THEME_PREFERENCES = [
  { value: "system", label: "Système (automatique)" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
] as const;

export const PROFILE_VISIBILITIES = [
  {
    value: "PUBLIC",
    label: "Public",
    description: "Tout le monde peut voir ton profil, même sans compte.",
  },
  {
    value: "MEMBERS",
    label: "Membres",
    description: "Seuls les membres connectés de la communauté peuvent voir ton profil.",
  },
  {
    value: "PRIVATE",
    label: "Privé",
    description: "Ton profil et tes informations restent masqués (stats minimales seulement).",
  },
] as const;

function labelFrom(
  list: readonly { value: string; label: string }[],
  value?: string | null,
): string | null {
  if (!value) return null;
  return list.find((entry) => entry.value === value)?.label ?? value;
}

export const seasonLabel = (value?: string | null) => labelFrom(FAVORITE_SEASONS, value);
export const favoriteTypeLabel = (value?: string | null) => labelFrom(BEYBLADE_TYPES, value);
export const experienceLabel = (value?: string | null) => labelFrom(EXPERIENCE_LEVELS, value);

/** Régions françaises (métropole + outre-mer) pour le select de localisation. */
export const FRENCH_REGIONS = [
  "Auvergne-Rhône-Alpes",
  "Bourgogne-Franche-Comté",
  "Bretagne",
  "Centre-Val de Loire",
  "Corse",
  "Grand Est",
  "Hauts-de-France",
  "Île-de-France",
  "Normandie",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Pays de la Loire",
  "Provence-Alpes-Côte d'Azur",
  "Guadeloupe",
  "Martinique",
  "Guyane",
  "La Réunion",
  "Mayotte",
] as const;
