import "server-only";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Stockage persistant des images uploadées (avatars, bannières, deck box, contenu
 * RichText) sur le **CDN** servi par nginx.
 *
 * Backend de stockage **serverless-first** :
 * - **Vercel / prod** (`BLOB_READ_WRITE_TOKEN` présent) : **Vercel Blob**. C'est
 *   le seul stockage persistant en serverless (FS lambda éphémère, read-only hors
 *   `/tmp`). L'URL Blob CDN est renvoyée telle quelle.
 * - **Fallback dev / sans Blob** : écriture **best-effort** dans `os.tmpdir()`
 *   (le seul chemin writable d'une lambda) — éphémère, jamais source de vérité.
 *   Overridable par env `CDN_UPLOAD_ROOT` + `CDN_UPLOAD_BASE_URL`. Aucun chemin
 *   `/var/www/...` ni hôte `cdn.rpbey.fr` codé en dur (décommissionnés).
 *
 * Toutes les images sont traitées par **sharp** (libvips, résolu depuis le repo
 * `node_modules`) : resize/crop selon le scope, conversion **WebP**, strip des
 * metadata. Aucune dépendance `@rpbey/db` ici — la persistance de l'URL en base
 * passe par la DAL (`dal/users`), pas par ce service.
 */

import os from "node:os";

/**
 * Racine disque du fallback (writable). Défaut : `os.tmpdir()/rpbey-uploads`
 * (éphémère, serverless-safe). Override possible via `CDN_UPLOAD_ROOT`.
 */
const CDN_UPLOAD_ROOT = process.env.CDN_UPLOAD_ROOT ?? path.join(os.tmpdir(), "rpbey-uploads");

/**
 * Base URL publique du fallback. Défaut : chemin same-origin `/uploads`. Override
 * via `CDN_UPLOAD_BASE_URL` (jamais `cdn.rpbey.fr`, décommissionné).
 */
const CDN_UPLOAD_BASE_URL = (process.env.CDN_UPLOAD_BASE_URL ?? "/uploads").replace(/\/$/, "");

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
 * Traite un buffer image en WebP selon le scope, le stocke et renvoie l'URL
 * publique absolue. Strip metadata (pas de `.withMetadata()`).
 *
 * Backend de stockage :
 * - **Vercel** (`BLOB_READ_WRITE_TOKEN` présent) : **Vercel Blob** — pas de FS
 *   writable sur Vercel, l'URL Blob CDN est renvoyée telle quelle.
 * - **Fallback dev / sans Blob** : écriture best-effort dans `os.tmpdir()`
 *   (éphémère), URL `CDN_UPLOAD_BASE_URL` (défaut `/uploads`).
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

  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `${safeUser}-${crypto.randomUUID()}.webp`;

  // Vercel : pas de FS writable → Vercel Blob (import dynamique pour ne pas
  // peser sur les builds VPS et rester tree-shakeable).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const { url } = await put(`uploads/${scope}/${filename}`, webp, {
      access: "public",
      contentType: "image/webp",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return url;
  }

  const dir = path.join(CDN_UPLOAD_ROOT, scope);
  await mkdir(dir, { recursive: true });
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
