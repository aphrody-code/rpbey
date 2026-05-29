"use client";

import dynamic from "next/dynamic";

import { BracketsLoader } from "./BracketsLoader";

import type { BracketsViewerClientProps } from "./BracketsViewerClient";

const BracketsViewerClient = dynamic(
  () => import("./BracketsViewerClient").then((m) => m.BracketsViewerClient),
  {
    ssr: false,
    loading: () => <BracketsLoader />,
  },
);

/**
 * Wrapper React du viewer DOM `@rose-griffon/challonge-core` (UMD).
 *
 * - Charge le script et le CSS depuis `/vendor/brackets/` (copies en `prebuild`).
 * - Rendu strictement client (`ssr: false`) — la lib appelle `document.createElement`.
 * - Fallback `BracketsLoader` (Skeleton MUI) pendant le download du bundle.
 */
export function BracketsViewer(props: BracketsViewerClientProps): React.ReactElement {
  return <BracketsViewerClient {...props} />;
}

export default BracketsViewer;
