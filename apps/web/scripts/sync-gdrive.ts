#!/usr/bin/env bun
/**
 * Synchronise un dossier Google Drive vers un répertoire local via l'API Drive v3.
 *
 * Auth : token OAuth minté par gcloud (service account du projet, scope drive.readonly).
 * Le token ne transite QUE par une variable d'environnement du sous-process curl/fetch —
 * jamais loggé (politique secrets). Récursif (sous-dossiers), non-destructif (n'efface
 * jamais de fichier local), met à jour seulement si le contenu distant a changé (taille).
 * Les Google-natifs (Docs/Sheets/Slides) sont exportés (pdf/xlsx/pptx) ; le binaire brut
 * (images, pdf, zip…) est téléchargé via alt=media. Bun only.
 *
 * Usage :
 *   bun scripts/sync-gdrive.ts <folderId> <destDir>
 *   bun scripts/sync-gdrive.ts 1GQC0zkN1osJHahcak9rKooUQonb4jJO6 docs/design/google
 */
import { mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const FOLDER = process.argv[2];
const DEST = process.argv[3];
if (!FOLDER || !DEST) {
  console.error("usage: bun scripts/sync-gdrive.ts <folderId> <destDir>");
  process.exit(2);
}

const API = "https://www.googleapis.com/drive/v3";

// Export des formats Google-natifs → MIME + extension.
const EXPORT: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mime: "application/pdf",
    ext: "pdf",
  },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: "pptx",
  },
};

/** Mint un access token Drive via gcloud (jamais loggé, sortie capturée puis effacée). */
async function getToken(): Promise<string> {
  const proc = Bun.spawn(
    [
      "gcloud",
      "auth",
      "print-access-token",
      "--scopes=https://www.googleapis.com/auth/drive.readonly",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const out = (await new Response(proc.stdout).text()).trim();
  const code = await proc.exited;
  if (code !== 0 || !out) {
    const err = (await new Response(proc.stderr).text()).slice(0, 200);
    throw new Error(`gcloud token échec (${code}) : ${err}`);
  }
  return out;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

async function listFolder(token: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${API}/files`);
    url.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,modifiedTime)");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("orderBy", "folder,name");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`list ${folderId} → HTTP ${res.status}`);
    const data = (await res.json()) as {
      files?: DriveFile[];
      nextPageToken?: string;
    };
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

async function downloadTo(token: string, url: string, dest: string): Promise<number> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`download → HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  await mkdir(dirname(dest), { recursive: true });
  await Bun.write(dest, buf);
  return buf.byteLength;
}

async function localSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return -1;
  }
}

let downloaded = 0;
let skipped = 0;
let exported = 0;

async function syncFolder(
  token: string,
  folderId: string,
  destDir: string,
  depth = 0,
): Promise<void> {
  const entries = await listFolder(token, folderId);
  for (const f of entries) {
    const indent = "  ".repeat(depth + 1);
    if (f.mimeType === "application/vnd.google-apps.folder") {
      console.log(`${indent}${f.name}/`);
      await syncFolder(token, f.id, join(destDir, f.name), depth + 1);
      continue;
    }
    const exp = EXPORT[f.mimeType];
    if (exp) {
      const dest = join(destDir, `${f.name}.${exp.ext}`);
      const url = `${API}/files/${f.id}/export?mimeType=${encodeURIComponent(exp.mime)}`;
      const n = await downloadTo(token, url, dest);
      exported++;
      console.log(`${indent}${f.name} → export ${exp.ext} (${(n / 1024).toFixed(0)}ko)`);
      continue;
    }
    // Binaire : skip si la taille locale correspond déjà à la taille distante.
    const dest = join(destDir, f.name);
    const remote = f.size ? Number(f.size) : -1;
    const local = await localSize(dest);
    if (remote >= 0 && local === remote) {
      skipped++;
      console.log(`${indent}${f.name} (à jour, ${(local / 1024).toFixed(0)}ko)`);
      continue;
    }
    const n = await downloadTo(
      token,
      `${API}/files/${f.id}?alt=media&supportsAllDrives=true`,
      dest,
    );
    downloaded++;
    console.log(`${indent}${f.name} ↓ ${(n / 1024).toFixed(0)}ko`);
  }
}

const token = await getToken();
console.log(`sync gdrive ${FOLDER} → ${DEST}`);
await syncFolder(token, FOLDER, DEST);
console.log(
  `\n✓ ${downloaded} téléchargé(s), ${exported} exporté(s), ${skipped} déjà à jour → ${DEST}`,
);
