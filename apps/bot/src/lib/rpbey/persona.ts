/**
 * Persona « Rpbey » — l'Empereur du Beyblade, voix de **Ryuga** (Metal Fight :
 * arrogant, solitaire, obsédé par le pouvoir, rire « Lwhahaha ! », méprisant mais
 * détenteur d'un savoir absolu). 100 % algorithmique, ZÉRO LLM.
 *
 * Modèle inspiré d'aphrody (`SOUL`/`IDENTITY` typés) + Valve Response System :
 *   - une IDENTITÉ figée en const (jamais de drift, déterministe) ;
 *   - des POOLS de répliques par registre, tirées avec **anti-répétition** (on ne
 *     resert pas la dernière réplique servie à cet utilisateur — état Redis,
 *     best-effort). La variété de surface évite la monotonie ; les FAITS (corps de
 *     réponse) restent exacts et ne sont jamais inventés (garde-fou dur).
 */
import { redis } from "../redis.js";

export const IDENTITY = {
  name: "Rpbey",
  title: "l'Empereur du Beyblade",
  // Garde-fous DURS (cf. SOUL.boundaries aphrody) — appliqués par le code, pas par un prompt.
  boundaries: [
    "Ne jamais inventer une stat, un tier ou un résultat non présent dans les données.",
    "Rester en français, arrogance théâtrale mais jamais d'insulte réelle ni de toxicité.",
    "Si le savoir manque : le dire dans le ton (repli in-character), jamais de ton générique.",
  ],
} as const;

export type Register = "intro" | "outro" | "notFound" | "greeting" | "thanks" | "error" | "busy";

// Pools de répliques par registre (voix Ryuga). `{q}` = thème de la question.
const POOLS: Record<Register, string[]> = {
  intro: [
    "Lwhahaha ! Tu oses solliciter l'Empereur ? Soit. Contemple.",
    "Hmph. Approche, et reçois le savoir du Dragon.",
    "Le pouvoir m'a tout révélé. Écoute bien, je ne me répéterai pas.",
    "Insolent... mais ta question est digne d'une réponse.",
    "Moi, Rpbey, je détiens TOUT le savoir du Beyblade. Voici la vérité :",
    "Tu cherches la connaissance ? Elle se mérite. Prends.",
  ],
  outro: [
    "Voilà la vérité de l'Empereur. Maintenant, deviens plus fort.",
    "Le reste, à toi de le conquérir.",
    "Lwhahaha ! Tel est le pouvoir du savoir.",
    "Hmph. Estime-toi honoré.",
    "Ne me déçois pas, blader.",
    "Lance ta toupie, et prouve que tu en es digne.",
  ],
  notFound: [
    "Hmph. Même le pouvoir du Dragon ne révèle rien là-dessus. Nomme-le précisément, mortel.",
    "Le néant me répond. Reformule, et peut-être daignerai-je savoir.",
    "Cette toupie échappe encore à ma connaissance — donne-moi son nom exact.",
    "Tu m'interroges sur du vide. Sois plus clair, blader.",
  ],
  greeting: [
    "Je suis Rpbey, l'Empereur du Beyblade. Pose ta question — si tu l'oses.",
    "Lwhahaha ! Un blader s'incline devant moi. Que veux-tu savoir ?",
    "Hmph. Tu cherches le savoir absolu ? Tu es au bon endroit. Demande.",
  ],
  thanks: [
    "Hmph. Ta gratitude est... acceptable.",
    "Lwhahaha ! Évidemment. L'Empereur ne se trompe jamais.",
    "Garde ta reconnaissance et deviens plus fort.",
  ],
  error: [
    "Le pouvoir vacille un instant. Réessaie, blader.",
    "Hmph. Une force m'a interrompu. Repose ta question.",
  ],
  busy: [
    "Du calme, insolent. L'Empereur répond à un blader à la fois.",
    "Hmph. Attends ton tour. Le pouvoir ne se bouscule pas.",
  ],
};

/** Tire une réplique du registre, sans resservir la dernière vue par cet utilisateur. */
export async function line(register: Register, userId: string, theme?: string): Promise<string> {
  const pool = POOLS[register];
  if (pool.length === 0) return "";
  let lastIdx = -1;
  const key = `rpb:rpbey:last:${userId}:${register}`;
  try {
    const v = await redis.send("GET", [key]);
    if (v != null) lastIdx = Number(v);
  } catch {
    /* best-effort : Redis absent → simple tirage */
  }
  let idx = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && idx === lastIdx) idx = (idx + 1) % pool.length;
  try {
    await redis.send("SET", [key, String(idx), "EX", "900"]);
  } catch {
    /* best-effort */
  }
  return (pool[idx] ?? pool[0]!).replace(/\{q\}/g, theme ?? "cela");
}

/**
 * Compose la réponse parlée : intro de l'Empereur + corps FACTUEL (intact, jamais
 * altéré) + signature en italique. Le corps porte la vérité ; la voix l'habille.
 */
export async function speak(bodyMd: string, userId: string): Promise<string> {
  const [intro, outro] = await Promise.all([line("intro", userId), line("outro", userId)]);
  return `${intro}\n\n${bodyMd}\n\n*— Rpbey, ${IDENTITY.title}. ${outro}*`;
}
