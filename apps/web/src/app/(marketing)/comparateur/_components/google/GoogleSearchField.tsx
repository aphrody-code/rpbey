"use client";

import { Add, AutoAwesome, Close, History, Mic, PhotoCamera, Search } from "@mui/icons-material";
import {
  Box,
  ClickAwayListener,
  Divider,
  IconButton,
  InputBase,
  Link as MuiLink,
  Paper,
  Typography,
} from "@mui/material";
import * as React from "react";
import type { GlobalSearchItem } from "@rpbey/api-contract";
import {
  BORDER,
  BORDER_FOCUS,
  FIELD_BORDER_RADIUS,
  FIELD_HEIGHT,
  GRADIENT_AI,
  ICON_HOVER_BG,
  ON_GRADIENT,
  SURFACE,
  SURFACE_HOVER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
} from "./tokens";

// Historique local — max 8 entrées
const HISTORY_KEY = "rpb-search-history";
function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveHistory(q: string) {
  const prev = loadHistory().filter((h) => h !== q);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...prev].slice(0, 8)));
}

// Sous-composant : une ligne de suggestion dans le dropdown
function SuggestionRow({
  item,
  fromHistory,
  onSelect,
}: {
  item: GlobalSearchItem | string;
  fromHistory: boolean;
  onSelect: (label: string) => void;
}) {
  const label = typeof item === "string" ? item : item.title;
  return (
    <Box
      component="button"
      onClick={() => onSelect(label)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        width: "100%",
        px: 2,
        py: 1.5,
        bgcolor: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        color: TEXT_PRIMARY,
        "&:hover": { bgcolor: SURFACE_HOVER },
        transition: "background-color 0.15s",
      }}
    >
      {fromHistory ? (
        <History sx={{ fontSize: 18, color: TEXT_TERTIARY, flexShrink: 0 }} />
      ) : (
        // Cercle gradient sparkle — icone sur fond coloré, couleur sémantique on-primary
        <Box
          sx={{
            width: 18,
            height: 18,
            flexShrink: 0,
            background: GRADIENT_AI,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AutoAwesome sx={{ fontSize: 11, color: ON_GRADIENT }} />
        </Box>
      )}
      <Typography
        component="span"
        sx={{
          fontSize: "0.9rem",
          color: TEXT_PRIMARY,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
      {typeof item !== "string" && item.badge && (
        <Typography
          component="span"
          sx={{ fontSize: "0.72rem", color: TEXT_TERTIARY, flexShrink: 0 }}
        >
          {item.badge}
        </Typography>
      )}
    </Box>
  );
}

interface GoogleSearchFieldProps {
  value: string;
  suggestions: GlobalSearchItem[];
  aiMode: boolean;
  placeholder?: string;
  maxWidth?: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onToggleAi: () => void;
  onFocus?: () => void;
}

export function GoogleSearchField({
  value,
  suggestions,
  aiMode,
  placeholder = "Rechercher une toupie, piece, blader...",
  maxWidth,
  onChange,
  onSubmit,
  onToggleAi,
  onFocus,
}: GoogleSearchFieldProps) {
  const [focused, setFocused] = React.useState(false);
  const [history, setHistory] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Chargement de l'historique uniquement cote client
  React.useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const showDropdown =
    focused && (value.length === 0 ? history.length > 0 : suggestions.length > 0);

  function handleSelect(label: string) {
    onChange(label);
    setFocused(false);
    saveHistory(label);
    setHistory(loadHistory());
    onSubmit(label);
  }

  function handleSubmit() {
    if (!value.trim()) return;
    saveHistory(value.trim());
    setHistory(loadHistory());
    setFocused(false);
    onSubmit(value.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") setFocused(false);
  }

  const resolvedMaxWidth = maxWidth ?? (aiMode ? "760px" : "584px");

  const pillBg = aiMode
    ? `color-mix(in srgb, var(--rpb-primary) 18%, ${SURFACE_HOVER})`
    : SURFACE_HOVER;

  return (
    <ClickAwayListener onClickAway={() => setFocused(false)}>
      <Box
        sx={{
          width: "100%",
          maxWidth: resolvedMaxWidth,
          mx: "auto",
          position: "relative",
        }}
      >
        {/* Barre principale */}
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            alignItems: "center",
            height: FIELD_HEIGHT,
            borderRadius: showDropdown
              ? `${FIELD_BORDER_RADIUS} ${FIELD_BORDER_RADIUS} 0 0`
              : FIELD_BORDER_RADIUS,
            bgcolor: SURFACE,
            border: "1px solid",
            borderColor: focused ? BORDER_FOCUS : "transparent",
            borderBottom: showDropdown ? "none" : undefined,
            px: 1,
            gap: 0.5,
            transition: "border-color 0.2s, border-radius 0.15s",
            "&:hover": { bgcolor: focused ? SURFACE : SURFACE_HOVER },
          }}
        >
          {/* Icone + (ajout de contexte / filtres) */}
          <IconButton
            size="small"
            aria-label="Ajouter un filtre"
            onClick={() => inputRef.current?.focus()}
            sx={{
              color: TEXT_SECONDARY,
              "&:hover": { bgcolor: ICON_HOVER_BG },
            }}
          >
            <Add fontSize="small" />
          </IconButton>

          {/* Champ de saisie */}
          <InputBase
            inputRef={inputRef}
            value={value}
            placeholder={focused ? "" : placeholder}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => {
              setFocused(true);
              onFocus?.();
            }}
            onKeyDown={handleKeyDown}
            sx={{
              flex: 1,
              fontSize: "1rem",
              color: TEXT_PRIMARY,
              "& input": {
                padding: 0,
                "&::placeholder": { color: TEXT_TERTIARY, opacity: 1 },
              },
            }}
            inputProps={{ "aria-label": "Champ de recherche comparateur" }}
          />

          {/* Clear */}
          {value && (
            <IconButton
              size="small"
              aria-label="Effacer la recherche"
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
              sx={{
                color: TEXT_SECONDARY,
                "&:hover": { bgcolor: ICON_HOVER_BG },
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          )}

          {/* Micro (decoratif) */}
          <IconButton
            size="small"
            aria-label="Recherche vocale (non disponible)"
            disabled
            sx={{ color: TEXT_SECONDARY, opacity: 0.6 }}
          >
            <Mic fontSize="small" />
          </IconButton>

          {/* Lens (decoratif) */}
          {!aiMode && (
            <IconButton
              size="small"
              aria-label="Recherche par image (non disponible)"
              disabled
              sx={{ color: TEXT_SECONDARY, opacity: 0.6 }}
            >
              <PhotoCamera fontSize="small" />
            </IconButton>
          )}

          {/* Divider */}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: BORDER }} />

          {/* Pilule Mode IA */}
          <Box
            component="button"
            onClick={onToggleAi}
            aria-pressed={aiMode}
            aria-label={aiMode ? "Desactiver le mode synthese" : "Activer le mode synthese"}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.5,
              py: 0.5,
              borderRadius: "20px",
              bgcolor: pillBg,
              border: aiMode
                ? "1px solid color-mix(in srgb, var(--rpb-primary) 40%, transparent)"
                : "1px solid transparent",
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap",
              transition: "all 0.2s",
              "&:hover": {
                bgcolor: `color-mix(in srgb, var(--rpb-primary) 22%, ${SURFACE_HOVER})`,
              },
            }}
          >
            {/* Cercle sparkle gradient — icone sur fond colore, couleur semantique on-primary */}
            <Box
              sx={{
                width: 16,
                height: 16,
                background: GRADIENT_AI,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AutoAwesome sx={{ fontSize: 10, color: ON_GRADIENT }} />
            </Box>
            <Typography
              component="span"
              sx={{
                fontSize: "0.82rem",
                fontWeight: 500,
                color: aiMode ? "var(--rpb-primary)" : TEXT_SECONDARY,
              }}
            >
              {value && aiMode ? "Mode IA →" : "Mode IA"}
            </Typography>
          </Box>

          {/* Loupe submit — visible hors AI mode */}
          {!aiMode && (
            <IconButton
              size="small"
              aria-label="Lancer la recherche"
              onClick={handleSubmit}
              sx={{
                color: TEXT_SECONDARY,
                "&:hover": { bgcolor: ICON_HOVER_BG },
                ml: 0.25,
              }}
            >
              <Search fontSize="small" />
            </IconButton>
          )}
        </Paper>

        {/* Dropdown autocompletion */}
        {showDropdown && (
          <Paper
            elevation={0}
            sx={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              bgcolor: SURFACE,
              border: "1px solid",
              borderColor: BORDER_FOCUS,
              borderTop: "none",
              borderRadius: `0 0 ${FIELD_BORDER_RADIUS} ${FIELD_BORDER_RADIUS}`,
              zIndex: 1300,
              overflow: "hidden",
            }}
          >
            <Divider sx={{ borderColor: BORDER, mx: 2 }} />

            {value.length === 0
              ? history.map((h) => (
                  <SuggestionRow key={h} item={h} fromHistory onSelect={handleSelect} />
                ))
              : suggestions
                  .slice(0, 8)
                  .map((s) => (
                    <SuggestionRow
                      key={s.id}
                      item={s}
                      fromHistory={false}
                      onSelect={handleSelect}
                    />
                  ))}

            {/* Footer */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 2,
                px: 2,
                py: 1,
              }}
            >
              <Typography
                component="button"
                onClick={() => {}}
                sx={{
                  fontSize: "0.75rem",
                  color: TEXT_TERTIARY,
                  textDecoration: "none",
                  border: "none",
                  bgcolor: "transparent",
                  cursor: "pointer",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Signaler
              </Typography>
              <MuiLink
                href="/comparateur"
                sx={{
                  fontSize: "0.75rem",
                  color: TEXT_SECONDARY,
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                En savoir plus
              </MuiLink>
            </Box>
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
}
