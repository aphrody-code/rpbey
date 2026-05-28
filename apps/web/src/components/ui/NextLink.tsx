"use client";

// Re-export client de next/link — pattern officiel MUI + Next.js v16.
// Permet d'utiliser `component={NextLink}` sur un composant MUI DEPUIS un
// server component sans l'erreur RSC "Functions cannot be passed directly to
// Client Components" (la frontière client est franchie par ce module).
// cf. https://mui.com/material-ui/integrations/nextjs/#nextjs-v16-client-component-restriction
import Link from "next/link";

export default Link;
