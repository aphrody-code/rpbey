import "server-only";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Stockage persistant des images uploadées (avatars, bannières, deck box, contenu
 * RichText) sur le **CDN** servi par nginx.
 *
 * Pourquoi un service dédié : en prod le standalone Next a `public/` symlinké vers
 * le CDN (éphémère / non-writable) → tout `Bun.write(process.cwd()/public/...)`
 * échouait en 500 (« Erreur lors du téléchargement de l'image »). On écrit donc
 * directement dans `/var/www/cdn/static/data/rpb/uploads/<scope>/` (dir
 * `ubuntu:www-data`, writable par le service `rpbey-web` qui tourne en `ubuntu`)
 * et on renvoie l'URL CDN absolue `https://cdn.rpbey.fr/static/data/rpb/uploads/...`.
 *
 * Toutes les images sont traitées par **sharp** (libvips, résolu depuis le repo
 * `node_modules`) : resize/crop selon le scope, conversion **WebP**, strip des
 * metadata. Aucune dépendance `@rpbey/db` ici — la persistance de l'URL en base
 * passe par la DAL (`dal/users`), pas par ce service.
 */

/** Racine disque (writable par `ubuntu`) + base URL publique (nginx). */
const CDN_UPLOAD_ROOT = "/var/www/cdn/static/data/rpb/uploads";
const CDN_UPLOAD_BASE_URL = "https://cdn.rpbey.fr/static/data/rpb/uploads";

export type UploadScope = "avatars" | "banners" | "deckboxes" | "content";

interface ScopeConfig {
  /** Octets max acceptés en entrée (avant traitement). */
  maxBytes: number;
  /** Transformation sharp à appliquer (sortie WebP). */
  transform(input: sharp.Sharp): sharp.Sharp;
}

const SCOPES: Record<UploadScope, ScopeConfig> = {
  // Avatar : crop carré centré, 512px, WebP qualité 82.
  avatars: {
    maxBytes: 8 * 1024 * 1024,
    transform: (img) => img.resize(512, 512, { fit: "cover", position: "centre" }),
  },
  // Bannière : largeur 1280, hauteur libre (max 720 pour borner le poids).
  banners: {
    maxBytes: 8 * 1024 * 1024,
    transform: (img) => img.resize(1280, 720, { fit: "inside", withoutEnlargement: true }),
  },
  // Deck box : 1024 de large max (photo de mallette), proportions conservées.
  deckboxes: {
    maxBytes: 10 * 1024 * 1024,
    transform: (img) => img.resize(1024, 1024, { fit: "inside", withoutEnlargement: true }),
  },
  // Contenu RichText (bio) : 1280 de large max.
  content: {
    maxBytes: 8 * 1024 * 1024,
    transform: (img) => img.resize(1280, 1280, { fit: "inside", withoutEnlargement: true }),
  },
};

export class UploadValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "UploadValidationError";
    this.status = status;
  }
}

/** Type MIME image accepté (sharp décode aussi avif/gif/tiff, on reste large). */
function assertImage(file: File, maxBytes: number) {
  if (!file.type.startsWith("image/")) {
    throw new UploadValidationError("Le fichier doit être une image.");
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    throw new UploadValidationError(`Fichier trop volumineux (max ${mb} Mo).`);
  }
}

/**
 * Traite un buffer image en WebP selon le scope, l'écrit sur le CDN et renvoie
 * l'URL publique absolue. Strip metadata (pas de `.withMetadata()`).
 */
async function processAndStore(
  scope: UploadScope,
  userId: string,
  buffer: Buffer,
): Promise<string> {
  const config = SCOPES[scope];

  const webp = await config
    .transform(sharp(buffer, { failOn: "none" }).rotate())
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  const dir = path.join(CDN_UPLOAD_ROOT, scope);
  await mkdir(dir, { recursive: true });

  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `${safeUser}-${crypto.randomUUID()}.webp`;
  const filepath = path.join(dir, filename);

  await writeFile(filepath, webp, { mode: 0o644 });

  return `${CDN_UPLOAD_BASE_URL}/${scope}/${filename}`;
}

/**
 * Valide + traite + stocke un `File` (FormData). Renvoie l'URL CDN absolue.
 * Lève `UploadValidationError` (status 4xx) pour les entrées invalides.
 */
export async function storeUploadedImage(
  scope: UploadScope,
  userId: string,
  file: File,
): Promise<string> {
  assertImage(file, SCOPES[scope].maxBytes);
  const buffer = Buffer.from(await file.arrayBuffer());
  return processAndStore(scope, userId, buffer);
}

/**
 * Re-héberge une image distante (ex. avatar Discord) sur le CDN. Fetch → sharp →
 * WebP → CDN. Lève `UploadValidationError` si le fetch échoue ou n'est pas une image.
 */
export async function storeRemoteImage(
  scope: UploadScope,
  userId: string,
  sourceUrl: string,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(sourceUrl, { redirect: "follow" });
  } catch {
    throw new UploadValidationError("Impossible de récupérer l'image distante.", 502);
  }
  if (!res.ok) {
    throw new UploadValidationError(
      `Récupération de l'image distante échouée (HTTP ${res.status}).`,
      502,
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new UploadValidationError("La ressource distante n'est pas une image.", 415);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > SCOPES[scope].maxBytes) {
    throw new UploadValidationError("Image distante trop volumineuse.", 413);
  }
  return processAndStore(scope, userId, buffer);
}
