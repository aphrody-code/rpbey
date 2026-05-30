"use client";

import { m, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

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
}

export function SectionFrameBg({
  series,
  intensity = 0.95,
  focus = "center",
  contentVeil = 0.86,
  dim = 0.34,
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
        const url = arr[Math.floor(Math.random() * arr.length)]!.imageUrl;
        const img = new Image();
        img.onload = () => {
          if (alive) {
            setSrc(url);
            setShown(true);
          }
        };
        img.src = url; // CDN direct, jamais le proxy
      } catch {
        /* décoratif : le fond de marque reste */
      }
    })();
    return () => {
      alive = false;
    };
  }, [series]);

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
    </div>
  );
}
