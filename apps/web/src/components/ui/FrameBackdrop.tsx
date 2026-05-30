"use client";

import { domAnimation, LazyMotion, m, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Fond d'ambiance par page : une frame d'animé (corpus RAG `anime_frames`) servie
 * en arrière-plan plein écran, derrière le contenu. L'ambiance est choisie par le
 * topic (`series`/`character`/`q`) ; la TEINTE s'adapte au thème actif via la
 * variable CSS `--rpb-primary-rgb` (rouge marque / bleu tournoi). 100 % décoratif :
 * `aria-hidden`, `pointer-events:none`, fetch paresseux (zéro coût SSR, ne rend pas
 * la page dynamique), fondu à l'apparition, Ken Burns lent coupé si
 * `prefers-reduced-motion`. Un voile (scrim) en `color-mix` garantit le contraste
 * AA du texte par-dessus.
 *
 * Placement : à déposer comme premier élément d'une page (le `position:fixed` +
 * `zIndex:0` le pose derrière le contenu, qui vit dans la couche `zIndex:1` du
 * layout marketing — aucun wrapper ni edit de layout nécessaire).
 */

interface AnimeFrame {
  imageUrl: string;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface FrameBackdropProps {
  /** Slug de série (ex. "beyblade-x", "metal-fight-beyblade"). Vide → échantillon diversifié. */
  series?: string;
  /** Opacité crête du fond (0..1). Défaut: 0.22. */
  intensity?: number;
  /** Zone de lisibilité renforcée. Défaut: "top" (sous le header). */
  focus?: "top" | "center";
}

const API = "/api/v1/anime/frames/ambient";

export function FrameBackdrop({ series, intensity = 0.22, focus = "top" }: FrameBackdropProps) {
  const reduce = useReducedMotion();
  const [src, setSrc] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ count: "30" });
    if (series) params.set("series", series);

    (async () => {
      try {
        const res = await fetch(`${API}?${params}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(7_000),
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: AnimeFrame[] | { data?: AnimeFrame[] };
        };
        const arr = Array.isArray(json.data) ? json.data : (json.data?.data ?? []);
        // On privilégie les frames paysage (16:9) pour un fond plein écran propre.
        const wide = arr.filter(
          (f) => f.imageUrl && (!f.width || !f.height || f.width >= f.height),
        );
        const pool = wide.length > 0 ? wide : arr.filter((f) => f.imageUrl);
        if (pool.length === 0 || !alive) return;
        const pick = pool[Math.floor(Math.random() * pool.length)]!;
        // Frame en background CSS (décoratif) : URL CDN directe, jamais le proxy
        // /api/img (détourage de fond + cdn.rpbey.fr hors allowlist → 403).
        const img = new Image();
        img.onload = () => {
          if (alive) {
            setSrc(pick.imageUrl);
            setShown(true);
          }
        };
        img.src = pick.imageUrl;
      } catch {
        /* décoratif : on ignore l'échec, la page reste nette */
      }
    })();

    return () => {
      alive = false;
    };
  }, [series]);

  if (!src) return null;

  // Voile : opaque sous le header + en bas, plus clair au centre → texte lisible (AA).
  const scrim =
    focus === "top"
      ? `linear-gradient(180deg,
          color-mix(in srgb, var(--rpb-bg, #0f0f0f) 94%, transparent) 0%,
          color-mix(in srgb, var(--rpb-bg, #0f0f0f) 70%, transparent) 26%,
          color-mix(in srgb, var(--rpb-bg, #0f0f0f) 62%, transparent) 55%,
          color-mix(in srgb, var(--rpb-bg, #0f0f0f) 90%, transparent) 100%)`
      : `radial-gradient(120% 90% at 50% 40%,
          color-mix(in srgb, var(--rpb-bg, #0f0f0f) 55%, transparent) 0%,
          color-mix(in srgb, var(--rpb-bg, #0f0f0f) 82%, transparent) 60%,
          color-mix(in srgb, var(--rpb-bg, #0f0f0f) 96%, transparent) 100%)`;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: shown ? 1 : 0 }}
        transition={{ duration: 1.1, ease: [0.2, 0, 0, 1] }}
        style={{
          // z-index NÉGATIF : le backdrop est un descendant de la couche zIndex:1
          // du layout marketing. Un positionné z-index:0 peindrait AU-DESSUS du
          // contenu non-positionné (CSS Appendix E) ; -1 le pose derrière.
          position: "fixed",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
          overflow: "hidden",
          contain: "strict",
        }}
      >
        {/* Image + Ken Burns (transform/opacity only — GPU, pas de layout). */}
        <m.div
          initial={false}
          animate={reduce ? { scale: 1.04 } : { scale: [1.06, 1.16], x: [0, -14], y: [0, -10] }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 36, ease: "linear", repeat: Infinity, repeatType: "reverse" }
          }
          style={{
            position: "absolute",
            inset: "-4%",
            backgroundImage: `url("${src}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: intensity,
            filter: "saturate(1.05)",
            willChange: "transform",
          }}
        />
        {/* Teinte de marque (s'adapte au thème via --rpb-primary-rgb). */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(80% 60% at 70% 18%,
              rgba(var(--rpb-primary-rgb, 220,38,38), 0.14),
              transparent 70%)`,
            mixBlendMode: "screen",
          }}
        />
        {/* Voile de lisibilité. */}
        <div style={{ position: "absolute", inset: 0, background: scrim }} />
      </m.div>
    </LazyMotion>
  );
}
