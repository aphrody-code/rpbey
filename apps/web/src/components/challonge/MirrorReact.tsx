"use client";

import React, { useEffect, useRef } from "react";
import parse, { domToReact, Element, attributesToProps } from "html-react-parser";
import type { DOMNode } from "html-react-parser";
import { BracketsViewer } from "@rose-griffon/challonge-core/viewer";
import type { ViewerData } from "@rose-griffon/challonge-core/viewer";
import { useTheme } from "@mui/material/styles";

interface MirrorReactProps {
  html: string;
  tournamentData?: ViewerData;
  baseUrl?: string;
}

/**
 * Composant hybride qui affiche le HTML mirroré de Challonge
 * mais remplace dynamiquement le bracket par notre BracketsViewer unifié.
 *
 * L'UI est synchronisée avec le thème Material Design 3 du site.
 */
export const MirrorReact: React.FC<MirrorReactProps> = ({
  html,
  tournamentData,
  baseUrl = "https://challonge.com",
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<BracketsViewer | null>(null);
  const muiTheme = useTheme();

  useEffect(() => {
    if (viewerRef.current && tournamentData) {
      if (!viewerInstance.current) {
        viewerInstance.current = new BracketsViewer();
      }

      viewerInstance.current.render(tournamentData, {
        selector: `#${viewerRef.current.id}`,
      });
    }
  }, [tournamentData]);

  const options = {
    replace: (domNode: DOMNode) => {
      if (domNode instanceof Element && domNode.attribs) {
        // 1. Remplacement du bracket original par le nôtre
        if (
          domNode.attribs.class?.includes("tournament-bracket") ||
          domNode.attribs.id === "tournament-bracket"
        ) {
          return (
            <div
              id="rpb-unified-viewer"
              ref={viewerRef}
              className="rpb-bracket-host min-h-[600px] w-full overflow-auto rounded-2xl border border-white/5"
            />
          );
        }

        // 2. Nettoyage des éléments publicitaires ou trackers
        if (
          domNode.name === "script" ||
          domNode.name === "ins" ||
          domNode.attribs.class?.includes("ads")
        ) {
          return <></>;
        }

        // 3. Transformation des liens relatifs en absolus
        if (domNode.name === "a" && domNode.attribs.href?.startsWith("/")) {
          const props = attributesToProps(domNode.attribs);
          return (
            <a
              {...props}
              href={`${baseUrl}${domNode.attribs.href}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline transition-colors"
            >
              {domToReact(domNode.children as DOMNode[], options)}
            </a>
          );
        }
      }
    },
  };

  // On extrait les couleurs du thème MUI pour les injecter dans le viewer
  type PaletteWithSurface = typeof muiTheme.palette & {
    surface?: { low?: string; high?: string };
  };
  const palette = muiTheme.palette as PaletteWithSurface;
  const primaryMain = palette.primary.main;
  const surfaceLow = palette.surface?.low ?? "#1e293b";
  const surfaceHigh = palette.surface?.high ?? "#334155";

  const globalCss = `
    .challonge-mirror-wrapper .rpb-bracket-host .brackets-viewer {
      --md-sys-color-primary: ${primaryMain};
      --md-sys-color-surface: transparent;
      --md-sys-color-surface-container-low: ${surfaceLow};
      --md-sys-color-surface-container-high: ${surfaceHigh};
      --md-sys-color-outline-variant: rgba(255, 255, 255, 0.1);
      background-color: transparent !important;
      font-family: inherit;
    }
    .rpb-bracket-host .brackets-viewer {
      color-scheme: dark;
    }
    .rpb-bracket-host .match {
      background-color: color-mix(in srgb, ${surfaceLow} 80%, transparent) !important;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.05) !important;
      transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease;
    }
    .rpb-bracket-host .match:hover {
      transform: translateY(-2px) scale(1.01);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      border-color: ${primaryMain}44 !important;
    }
  `;

  return (
    <div className="challonge-mirror-wrapper prose dark:prose-invert max-w-none">
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      {parse(html, options)}
    </div>
  );
};
