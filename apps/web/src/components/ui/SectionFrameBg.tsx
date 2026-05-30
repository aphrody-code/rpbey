"use client";

import { m, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Fond d'une **section** de page : une frame d'animé (un « meilleur moment » d'une
 * saison) en `background-image` plein-cadre, avec **parallaxe + scale au scroll** et
 * fondu d'apparition. Pensé pour empiler plusieurs sections, chacune dans sa saison —
 * l'effet de scroll fait défiler les moments d'une génération à l'autre.
 *
 * - Frame chargée **directement depuis le CDN** (background CSS décoratif = zéro CORS) :
 *   JAMAIS via `/api/img` (détourage produit + `cdn.rpbey.fr` hors allowlist → 403).
 * - Parallaxe désactivée en `prefers-reduced-motion` (frame statique).
 * - Aucun état vide : tant que la frame n'est pas prête, le fond de marque reste.
 *
 * À poser en `position:absolute; inset:0` DANS une section `position:relative; overflow:hidden`,
 * le contenu au-dessus en `position:relative; zIndex:1`.
 */

const AMBIENT_API = "/api/v1/anime/frames/ambient";

export interface SectionFrameBgProps {
  /** Slug de saison (= fichier `data/anime-frames/<slug>.json`). */
  series: string;
  /** Opacité crête de la frame (0..1). Défaut 0.6. */
  intensity?: number;
  /** Opacité du voile de lisibilité (0..1). Défaut 0.72. Monte-le si la section a beaucoup de texte. */
  scrim?: number;
  /** Point de focalisation vertical du cadrage. Défaut "center". */
  focus?: "top" | "center" | "bottom";
}

export function SectionFrameBg({
  series,
  intensity = 0.6,
  scrim = 0.72,
  focus = "center",
}: SectionFrameBgProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  // Progression du scroll de la section : 0 quand son haut touche le bas du viewport,
  // 1 quand son bas touche le haut. Sert à la parallaxe.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-14%", "14%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [1.18, 1.1, 1.18]);

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

  const sc = (pct: number) =>
    `color-mix(in srgb, var(--rpb-bg, #0f0f0f) ${Math.round(Math.min(100, scrim * pct))}%, transparent)`;

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background:
          "radial-gradient(130% 100% at 70% 0%, rgba(var(--rpb-primary-rgb),0.14), transparent 60%)," +
          "var(--rpb-bg, #0f0f0f)",
      }}
    >
      {src && (
        <m.div
          style={{
            position: "absolute",
            inset: "-16% 0",
            y,
            scale,
            backgroundImage: `url("${src}")`,
            backgroundSize: "cover",
            backgroundPosition:
              focus === "top" ? "center top" : focus === "bottom" ? "center bottom" : "center",
            opacity: shown ? intensity : 0,
            transition: "opacity 1000ms cubic-bezier(0.05,0.7,0.1,1)",
            filter: "saturate(1.06)",
            willChange: "transform",
          }}
        />
      )}
      {/* Voile de lisibilité : plus dense aux jointures (haut/bas), plus clair au centre
          (la frame y respire) → fondu propre d'une section à l'autre au scroll. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${sc(100)} 0%, ${sc(74)} 48%, ${sc(100)} 100%)`,
        }}
      />
    </div>
  );
}
