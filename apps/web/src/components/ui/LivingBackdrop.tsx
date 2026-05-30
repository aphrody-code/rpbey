"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fond "vivant" du hero : frame d'animé (corpus RAG) en image de fond animée (Ken Burns
 * CSS, toujours présente, zéro CORS) + un calque PixiJS de **braises/poussières
 * procédurales** (textures générées au runtime — aucun asset externe) qui dérivent vers
 * le haut, dans la teinte de marque. Adaptatif et natif mobile : DPR capé à 2, `maxFPS=30`
 * sur mobile, pause sur onglet caché, désactivé si `prefers-reduced-motion`, fallback
 * propre si WebGL absent (l'image Ken Burns reste). Pixi est chargé en `import()` dynamique
 * (hors bundle initial). Aucun loader vide : un dégradé de marque est visible d'emblée,
 * la frame y fond par-dessus.
 *
 * Pensé pour être posé en `position:absolute; inset:0` DANS un conteneur de hero.
 */

const AMBIENT_API = "/api/v1/anime/frames/ambient";

export interface LivingBackdropProps {
  /** Slug de série pour cibler l'ambiance. Vide → échantillon diversifié. */
  series?: string;
  /** Opacité crête de la frame (0..1). Défaut 0.82. */
  intensity?: number;
}

/** Petit disque flou (braise) dessiné sur un canvas — texture procédurale. */
function makeMoteCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return c;
}

export function LivingBackdrop({ series, intensity = 0.82 }: LivingBackdropProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [frameShown, setFrameShown] = useState(false);

  // 1) Récupère une frame d'ambiance + précharge avant d'afficher (pas de flash).
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ count: "24" });
    if (series) params.set("series", series);
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
        const pick = arr[Math.floor(Math.random() * arr.length)]!;
        // Frame en background CSS (décoratif) : pas de CORS, donc URL CDN directe —
        // surtout PAS le proxy /api/img (détourage de fond + cdn.rpbey.fr hors allowlist → 403).
        const src = pick.imageUrl;
        const img = new Image();
        img.onload = () => {
          if (alive) {
            setFrameSrc(src);
            setFrameShown(true);
          }
        };
        img.src = src;
      } catch {
        /* décoratif : le dégradé de marque reste */
      }
    })();
    return () => {
      alive = false;
    };
  }, [series]);

  // 2) Calque PixiJS de braises procédurales (perf-gardé).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let app: import("pixi.js").Application | null = null;
    let onVis: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const PIXI = await import("pixi.js");
        if (cancelled || !hostRef.current) return;

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const isMobile = window.matchMedia("(max-width:768px)").matches;

        app = new PIXI.Application();
        await app.init({
          resizeTo: hostRef.current,
          backgroundAlpha: 0,
          antialias: false,
          resolution: dpr,
          autoDensity: true,
          preference: "webgl",
          webgl: { powerPreference: "low-power" },
          failIfMajorPerformanceCaveat: true,
        });
        if (cancelled) {
          app.destroy(true, { children: true, texture: true });
          app = null;
          return;
        }
        if (isMobile) app.ticker.maxFPS = 30;

        const canvas = app.canvas;
        canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
        hostRef.current.appendChild(canvas);

        const moteTex = PIXI.Texture.from(makeMoteCanvas());
        const dust = new PIXI.ParticleContainer({
          dynamicProperties: { position: true, alpha: true, scale: false },
        });
        app.stage.addChild(dust);

        const W = () => app!.screen.width;
        const H = () => app!.screen.height;
        const COUNT = isMobile ? 26 : 64;
        // Teinte braise : rouge marque → or (chaud, "République Populaire").
        const TINTS = [0xdc2626, 0xfb7185, 0xfbbf24, 0xffffff];
        const motes: { p: import("pixi.js").Particle; vy: number; vx: number; ph: number }[] = [];
        for (let i = 0; i < COUNT; i++) {
          const sc = 0.25 + Math.random() * 0.7;
          const p = new PIXI.Particle({
            texture: moteTex,
            x: Math.random() * W(),
            y: Math.random() * H(),
            scaleX: sc,
            scaleY: sc,
            alpha: 0.05 + Math.random() * 0.18,
            tint: TINTS[Math.floor(Math.random() * TINTS.length)]!,
          });
          dust.addParticle(p);
          motes.push({
            p,
            vy: -(6 + Math.random() * 16),
            vx: (Math.random() - 0.5) * 8,
            ph: Math.random() * Math.PI * 2,
          });
        }

        let t = 0;
        app.ticker.add((ticker) => {
          const s = ticker.deltaMS / 1000;
          t += s;
          for (const m of motes) {
            m.p.y += m.vy * s;
            m.p.x += (m.vx + Math.sin(t * 0.6 + m.ph) * 6) * s;
            // scintillement doux
            m.p.alpha = Math.max(0, m.p.alpha + Math.sin(t * 2 + m.ph) * 0.004);
            if (m.p.y < -24) {
              m.p.y = H() + 24;
              m.p.x = Math.random() * W();
            }
            if (m.p.x < -24) m.p.x = W() + 24;
            else if (m.p.x > W() + 24) m.p.x = -24;
          }
        });

        onVis = () => {
          if (!app) return;
          if (document.hidden) app.stop();
          else app.start();
        };
        document.addEventListener("visibilitychange", onVis);
      } catch {
        /* WebGL absent / bloqué → seul le calque CSS Ken Burns reste (OK) */
      }
    })();

    return () => {
      cancelled = true;
      if (onVis) document.removeEventListener("visibilitychange", onVis);
      app?.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
      app = null;
    };
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        // dégradé de marque toujours visible (jamais d'état vide)
        background:
          "radial-gradient(120% 90% at 70% 10%, rgba(var(--rpb-primary-rgb),0.22), transparent 60%)," +
          "var(--rpb-bg, #0f0f0f)",
      }}
    >
      {/* Frame d'animé en Ken Burns (CSS), fond par-dessus le dégradé */}
      {frameSrc && (
        <div
          style={{
            position: "absolute",
            inset: "-3%",
            backgroundImage: `url("${frameSrc}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: frameShown ? intensity : 0,
            transition: "opacity 1200ms cubic-bezier(0.05,0.7,0.1,1)",
            animation: "rpb-kenburns 32s ease-in-out infinite alternate",
            filter: "saturate(1.08)",
          }}
        />
      )}
      {/* Calque Pixi (braises) */}
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
      {/* Voile léger : la frame ressort (aucun gros titre à protéger), vignette
          basse pour fondre proprement dans la section suivante. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg," +
            "color-mix(in srgb, var(--rpb-bg, #0f0f0f) 26%, transparent) 0%," +
            "color-mix(in srgb, var(--rpb-bg, #0f0f0f) 8%, transparent) 48%," +
            "color-mix(in srgb, var(--rpb-bg, #0f0f0f) 92%, transparent) 100%)",
        }}
      />
      <style>{`
        @keyframes rpb-kenburns {
          0%   { transform: scale(1.06) translate(0, 0); }
          100% { transform: scale(1.14) translate(-1.5%, -1%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-rpb-kenburns] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
