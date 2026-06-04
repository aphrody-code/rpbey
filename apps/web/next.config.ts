import type { NextConfig } from "next";
import path from "node:path";

const IS_VERCEL = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  turbopack: {
    resolveAlias: {
      react: "../../node_modules/react",
      "react-dom": "../../node_modules/react-dom",
    },
  },

  // Output standalone pour systemd VPS — Vercel package son runtime, pas de standalone.
  ...(IS_VERCEL
    ? {}
    : {
        output: "standalone" as const,
        // Monorepo : trace les deps depuis la racine ~/vps (Bun isolated stocke sous .bun/).
        outputFileTracingRoot: path.resolve(__dirname, "../../"),
      }),

  typescript: {
    ignoreBuildErrors: false,
  },
  // Trace dynamic requires that static analysis misses (tiktok-api-dl loads signature.js/webmssdk.js at runtime)
  // Bun's isolated install stores packages under node_modules/.bun/<pkg>@<ver>+<hash>/ — both layouts included.
  //
  // + Données runtime self-contained (cf. `lib/data-cache.ts`) : on TRACE les
  // fichiers `data/*` lus au runtime dans la lambda Vercel (plus aucun fetch
  // `cdn.rpbey.fr`). On cible précisément les fichiers consommés pour ne PAS
  // re-bundler tout `data/` (qui dépasse 250 MB — cf. exclusions plus bas).
  outputFileTracingIncludes: {
    // Un SEUL glob `/**/*` (les clés dupliquées s'écrasent) : on liste ici TOUS
    // les fichiers `data/*` lus au runtime (data-cache.ts, bts.ts, ambient route,
    // rankings) + le helper tiktok. Cible précise → pas de re-bundle du `data/`
    // complet (>250 MB, cf. exclusions plus bas).
    "/**/*": [
      "./node_modules/@tobyg74/tiktok-api-dl/helper/**",
      "./data/bbx-weekly.json",
      "./data/beyblade-knowledge.json",
      "./data/bx-catalog.json",
      "./data/wbo-combos-enriched.json",
      "./data/exports/participants_map.json",
      "./data/bey-library/bey-library-complete.json",
      "./data/pools/*.json",
      "./data/anime-frames/*.json",
      "./data/wb_champions.json",
      "./data/satr_champions.json",
    ],
  },

  // Exclut les GROS sous-dossiers `data/*` du tracing Next (cause
  // `function_size_exceeded` 250 MB sinon — bey-library 170 MB + discord-full-scan
  // + exports BTS dépassent la limite). Les FEW fichiers réellement lus au runtime
  // sont au contraire FORCÉS dans la lambda via `outputFileTracingIncludes`
  // ci-dessus (un include précis l'emporte sur un exclude large) — le site est donc
  // **self-contained** sur Vercel, sans aucun fetch `cdn.rpbey.fr`.
  outputFileTracingExcludes: {
    "*": [
      "data/bey-library/**/*",
      "data/exports/**/*",
      "data/satr_history/**/*",
      "data/wb_history/**/*",
      "data/scrapes/**/*",
      "data/cleaned/**/*",
      "data/backups/**/*",
      "data/pools/**/*",
      "data/planner/**/*",
      "data/discord-*.json",
      "data/all_image_assets.json",
      "data/lighthouse-trends.db",
      "**/data/bey-library/**/*",
      "**/data/exports/**/*",
    ],
  },

  // @vidstack/react ship du JSX non-transpilé dans ses chunks .js : Turbopack
  // ne transforme pas node_modules par défaut → panic `Expected ';', got '{'`
  // (`<SlotClone>`). Le forcer dans le pipeline de transpilation le corrige.
  transpilePackages: [
    "@vidstack/react",
    "@rose-griffon/challonge",
    "@rose-griffon/challonge-core",
    "@aphrody/challonge",
    "@aphrody/bxc"
  ],

  // Disable Node.js compression — Nginx handles gzip
  compress: false,

  // Cache Components (Next.js 16+)
  cacheComponents: false, // Disabled due to instability with external scraping

  // External packages for server — packages listed in Next.js' built-in
  // server-external-packages.jsonc (puppeteer, pg, jsdom, sharp, canvas, etc.)
  // are auto-externalized and don't need to be repeated here.
  serverExternalPackages: [
    "postgres",
    // Libs server-only lourdes : externalize = pas de bundling/analyse webpack
    // → compile build nettement plus rapide (googleapis surtout est énorme).
    "puppeteer",
    "googleapis",
    "google-auth-library",
    "xlsx",
    "cheerio",
    "sharp",
    "puppeteer-extra",
    "puppeteer-extra-plugin",
    "puppeteer-extra-plugin-stealth",
    // Transitives de puppeteer-extra-plugin — Turbopack ne les bundle pas
    // correctement quand le parent est externalize, donc on doit les
    // forcer dans le tracing Vercel pour eviter MODULE_NOT_FOUND
    // (cf. log Vercel : Cannot find module 'is-plain-object' digest 1470021154).
    "merge-deep",
    "clone-deep",
    "is-plain-object",
    "crawlee",
    "turndown",
    "@tobyg74/tiktok-api-dl",
  ],

  // Experimental features
  experimental: {
    cpus: 2,
    // Cache Turbopack persistant entre builds (gain 2-5x sur incremental).
    // Réactivé sur Next 16.3 canary (le panic JSX radix <SlotClone> de 16.2.6
    // est corrigé upstream). Combiné à `next build --turbopack`.
    turbopackFileSystemCacheForBuild: true,
    // Minification CSS via Lightning CSS (Rust).
    optimizeCss: true,
    optimizePackageImports: [
      "@mui/material",
      "@mui/icons-material",
      "@mui/x-charts",
      "@mui/x-data-grid",
      "@mui/x-date-pickers",
      "@mui/x-tree-view",
      "framer-motion",
    ],
    serverActions: {
      allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL?.replace("https://", "").replace("http://", "") ||
          "localhost:3000",
        "rpbey.fr",
        "rpbey.vercel.app",
        "*.vercel.app",
        "localhost:3000",
        "localhost:3001",
        "localhost:8000",
        "127.0.0.1:3000",
        "127.0.0.1:3001",
        "51.77.147.152",
      ],
    },
  },

  // Dev origins
  allowedDevOrigins: [
    process.env.NEXT_PUBLIC_APP_URL?.replace("https://", "").replace("http://", "").split(":")[0] ||
      "localhost",
    "rpbey.fr",
    "rpbey.vercel.app",
    "*.vercel.app",
    "127.0.0.1",
    "51.77.147.152",
  ],

  // Image optimization
  images: {
    // Vercel renvoie `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` sur
    // `/_next/image?...` (plan Hobby : l'optimiseur d'images est facturé/quota
    // épuisé) → TOUTES les `<Image>` optimisées tombaient en 402, donc rien ne
    // s'affichait. Les assets locaux sont DÉJÀ en .webp pré-optimisé (public/)
    // et servis par l'edge CDN Vercel en 200 ; les distants sont des miniatures.
    // On bypasse donc l'optimiseur : `<Image>` émet le `src` d'origine, servi
    // tel quel (200, gratuit, déterministe). `remotePatterns` reste validé pour
    // l'allowlisting des hôtes distants.
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      {
        protocol: "https",
        hostname: "media.discordapp.net",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net",
      },
      {
        protocol: "https",
        hostname: "*.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ibb.co",
      },
      {
        protocol: "https",
        hostname: "s4.anilist.co",
      },
      {
        protocol: "https",
        hostname: "cdn.myanimelist.net",
      },
      {
        protocol: "https",
        hostname: "media.kitsu.app",
      },
      {
        protocol: "https",
        hostname: "static.wikia.nocookie.net",
      },
      {
        protocol: "https",
        hostname: "beyblade.takaratomy.co.jp",
      },
      {
        protocol: "https",
        hostname: "user-assets.challonge.com",
      },
      {
        protocol: "https",
        hostname: "secure.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "beybladeplanner.com",
      },
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      // `cdn.rpbey.fr` retiré : assets rapatriés dans `public/` (Vercel edge) ou
      // proxifiés same-origin via `/api/assets/...` (cf. lib/asset-url.ts). Plus
      // aucune dépendance image au runtime sur l'hôte CDN.
      {
        protocol: "https",
        hostname: "cdn.rosegriffon.fr",
      },
      {
        // Vercel Blob (uploads avatars/bannières/deckboxes/contenu en prod Vercel).
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-Accel-Buffering",
            value: "no",
          },
          // Indexation maximale (Google + LLM crawlers : aperçus/snippets illimités)
          {
            key: "X-Robots-Tag",
            value: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
          },
          // Cross-origin ouvert (lecture) — permet aux LLM / outils de fetch le
          // contenu public. Sans Allow-Credentials → aucun cookie cross-origin
          // n'est exposé (les routes authentifiées restent protégées).
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, HEAD, OPTIONS",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
