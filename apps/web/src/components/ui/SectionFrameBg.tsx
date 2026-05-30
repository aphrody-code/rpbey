"use client";

import { m, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { SEASON_COLORS } from "@/lib/season-colors.generated";

/**
 * Fond d'une **section** plein-cadre : une frame d'animé (un « meilleur moment » d'une
 * saison) **nette et lisible** (l'image EST le sujet, pas un fond mort), avec parallaxe +
 * scale au scroll. Le voile n'apparaît qu'aux **bords** (raccord de section en haut,
 * lisibilité du contenu en bas) — le **centre reste net**.
 *
 * - Frame chargée **directement depuis le CDN** (background CSS décoratif = zéro CORS) :
 *   JAMAIS via `/api/img` (détourage produit + `cdn.rpbey.fr` hors allowlist → 403).
 * - Parallaxe coupée en `prefers-reduced-motion`.
 * - Aucun flou sur l'image ; léger boost contraste/saturation pour le « pop ».
 *
 * À poser en `position:absolute; inset:0` DANS une section `position:relative; overflow:hidden`,
 * le contenu au-dessus en `position:relative; zIndex:1`.
 */

const AMBIENT_API = "/api/v1/anime/frames/ambient";

// Images d'ambiance CURÉES (HD, vérifiées à l'œil), servies par NOTRE CDN :
// - beyblade-x : frames fancaps déjà reverse-proxiées par cdn.rpbey.fr ;
// - metal / burst / bakuten : uploadées sous /static/data/rpb/seasons/.
// Une saison curée n'appelle PAS l'échantillon aléatoire (qui tombe sur des caps
// watermarkés/flous) — on sert la bonne image directement.
const CDN = "https://cdn.rpbey.fr";
const CURATED: Record<string, readonly string[]> = {
  "beyblade-x": [
    `${CDN}/fancaps-anime-full/29133604.jpg`,
    `${CDN}/fancaps-anime-full/29131028.jpg`,
    `${CDN}/fancaps-anime-full/29132373.jpg`,
  ],
  "metal-fight-beyblade": [
    `${CDN}/static/data/rpb/seasons/metal-champion.png`,
    `${CDN}/static/data/rpb/seasons/metal-team.png`,
  ],
  "beyblade-burst-chouzetsu": [
    `${CDN}/static/data/rpb/seasons/burst-clash.png`,
    `${CDN}/static/data/rpb/seasons/burst-valt.png`,
    `${CDN}/static/data/rpb/seasons/burst-aura.png`,
  ],
  "bakuten-shoot-beyblade": [
    `${CDN}/static/data/rpb/seasons/bakuten-team.png`,
    `${CDN}/static/data/rpb/seasons/bakuten-team2.png`,
  ],
};

// Grain argentique (SVG fractalNoise) — texture/atmosphère, anti-aplat numérique.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export interface SectionFrameBgProps {
  /** Slug de saison (= fichier `data/anime-frames/<slug>.json`). */
  series: string;
  /** Opacité de la frame (0..1). Défaut 0.95 — l'image doit ressortir. */
  intensity?: number;
  /** Cadrage vertical. Défaut "center". */
  focus?: "top" | "center" | "bottom";
  /** Densité du voile bas (zone de contenu lisible), 0..1. Défaut 0.86. */
  contentVeil?: number;
  /** Voile de base au centre (lisibilité du texte) sans tuer l'image, 0..1. Défaut 0.34. */
  dim?: number;
  /** URL d'image explicite (prioritaire sur la curation et l'échantillon). */
  image?: string;
}

export function SectionFrameBg({
  series,
  intensity = 0.95,
  focus = "center",
  contentVeil = 0.86,
  dim = 0.34,
  image,
}: SectionFrameBgProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-9%", "9%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [1.14, 1.06, 1.14]);

  useEffect(() => {
    let alive = true;
    const preload = (url: string) => {
      const img = new Image();
      img.onload = () => {
        if (alive) {
          setSrc(url);
          setShown(true);
        }
      };
      img.src = url; // CDN direct, jamais le proxy /api/img
    };

    // 1) image explicite  2) saison curée (HD)  → on sert directement, sans aléatoire.
    const pool = CURATED[series];
    const direct = image ?? (pool ? pool[Math.floor(Math.random() * pool.length)] : undefined);
    if (direct) {
      // Couleur dynamique : pose l'accent/teinte dérivés de l'image sur la SECTION
      // parente → texte/cartes/chips s'y adaptent (cf. season-colors.generated).
      const color = SEASON_COLORS[direct];
      const section = ref.current?.parentElement;
      if (section && color) {
        section.style.setProperty("--rpb-frame-accent", color.accent);
        section.style.setProperty("--rpb-frame-accent-soft", color.accentSoft);
        section.style.setProperty("--rpb-frame-tint", color.tint);
      }
      preload(direct);
      return () => {
        alive = false;
      };
    }

    // 3) Repli : échantillon ambient (séries non curées).
    const params = new URLSearchParams({ series, count: "24" });
    (async () => {
      try {
        const res = await fetch(`${AMBIENT_API}?${params}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(7_000),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: { imageUrl: string }[] };
        const arr = json.data ?? [];
        if (arr.length === 0 || !alive) return;
        preload(arr[Math.floor(Math.random() * arr.length)]!.imageUrl);
      } catch {
        /* décoratif : le fond de marque reste */
      }
    })();
    return () => {
      alive = false;
    };
  }, [series, image]);

  const bg = (pct: number) =>
    `color-mix(in srgb, var(--rpb-bg, #0f0f0f) ${Math.round(Math.min(100, pct))}%, transparent)`;

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: "var(--rpb-bg, #0f0f0f)",
      }}
    >
      {src && (
        <m.div
          style={{
            position: "absolute",
            inset: "-10% 0",
            y,
            scale,
            backgroundImage: `url("${src}")`,
            backgroundSize: "cover",
            backgroundPosition:
              focus === "top" ? "center top" : focus === "bottom" ? "center bottom" : "center",
            opacity: shown ? intensity : 0,
            transition: "opacity 900ms cubic-bezier(0.05,0.7,0.1,1)",
            filter: "saturate(1.12) contrast(1.05)",
            willChange: "transform",
          }}
        />
      )}
      {/* Voile aux BORDS uniquement : raccord haut + lisibilité bas. Centre net. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            `linear-gradient(180deg,` +
            ` ${bg(82)} 0%,` +
            ` ${bg(dim * 100)} 16%,` +
            ` ${bg(dim * 100)} 46%,` +
            ` ${bg(Math.max(dim, contentVeil * 0.64) * 100)} 72%,` +
            ` ${bg(contentVeil * 100)} 100%)`,
        }}
      />
      {/* Lueur d'accent (coin haut) — couleur DYNAMIQUE dérivée de l'image (repli marque) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(80% 55% at 12% 0%, var(--rpb-frame-accent-soft, rgba(var(--rpb-primary-rgb),0.5)), transparent 62%)",
          opacity: 0.3,
          mixBlendMode: "screen",
        }}
      />
      {/* Grain argentique */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: GRAIN,
          backgroundSize: "160px 160px",
          opacity: 0.07,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}
