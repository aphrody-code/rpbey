"use client";

import { Close, OpenInNew, SwapHoriz } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Link as MuiLink,
  Slide,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { BxOffer, BxProductGroup } from "../types";
import { fmtEur, fmtNative, savingPct } from "./fmt";
import { REGION_LABEL, MAX_COMPARE } from "./constants";

interface CompareTrayProps {
  selected: BxProductGroup[];
  onRemove: (key: string) => void;
  onClear: () => void;
}

function OfferCell({ offer, isCheapest }: { offer: BxOffer; isCheapest: boolean }) {
  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 2,
        border: "1px solid",
        borderColor: isCheapest ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.07)",
        bgcolor: isCheapest ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          noWrap
          sx={{
            fontWeight: 700,
            fontSize: "0.78rem",
            color: isCheapest ? "#22c55e" : "text.primary",
          }}
        >
          {offer.shop}
        </Typography>
        <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
          {REGION_LABEL[offer.region] ?? offer.region}
        </Typography>
      </Box>
      <Stack sx={{ alignItems: "flex-end", flexShrink: 0 }}>
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: "0.9rem",
            color: isCheapest ? "#22c55e" : "text.primary",
          }}
        >
          {fmtEur(offer.priceEur)}
        </Typography>
        {offer.currency !== "EUR" && (
          <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
            {fmtNative(offer.price, offer.currency)}
          </Typography>
        )}
      </Stack>
      <MuiLink
        href={offer.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        sx={{ color: "text.disabled", "&:hover": { color: "var(--rpb-primary)" } }}
      >
        <OpenInNew sx={{ fontSize: 14 }} />
      </MuiLink>
    </Box>
  );
}

function ProductColumn({
  group,
  allGroups,
  onRemove,
}: {
  group: BxProductGroup;
  allGroups: BxProductGroup[];
  onRemove: (key: string) => void;
}) {
  // cheapest across ALL selected groups — reference price for savings column
  const globalMin = Math.min(
    ...allGroups.map((g) => g.cheapestEur).filter((n): n is number => n != null),
  );
  const pct = savingPct(group.cheapestEur, group.offers);
  const vsGlobal =
    group.cheapestEur != null && globalMin > 0 && group.cheapestEur !== globalMin
      ? Math.round(((group.cheapestEur - globalMin) / globalMin) * 100)
      : null;

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 200,
        maxWidth: 320,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 0.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          {group.cheapest?.image && (
            <Box
              component="img"
              src={group.cheapest.image}
              alt={group.name}
              loading="lazy"
              sx={{ width: 48, height: 48, objectFit: "contain", mb: 0.5 }}
            />
          )}
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: "0.82rem",
              lineHeight: 1.3,
              mb: 0.25,
            }}
          >
            {group.name}
          </Typography>
          {group.code && (
            <Chip
              size="small"
              label={group.code}
              sx={{
                height: 18,
                fontSize: "0.6rem",
                fontWeight: 900,
                bgcolor: "rgba(255,255,255,0.06)",
              }}
            />
          )}
        </Box>
        <IconButton
          size="small"
          onClick={() => onRemove(group.key)}
          sx={{ flexShrink: 0, mt: -0.5 }}
        >
          <Close sx={{ fontSize: 14 }} />
        </IconButton>
      </Stack>

      {/* Summary price row */}
      <Stack direction="row" sx={{ alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontWeight: 900, fontSize: "1.15rem", color: "#22c55e" }}>
          {fmtEur(group.cheapestEur)}
        </Typography>
        {pct > 0 && (
          <Chip
            size="small"
            label={`-${pct}% vs max`}
            sx={{
              height: 18,
              fontSize: "0.6rem",
              fontWeight: 900,
              bgcolor: "rgba(34,197,94,0.12)",
              color: "#22c55e",
            }}
          />
        )}
        {vsGlobal != null && vsGlobal > 0 && (
          <Chip
            size="small"
            label={`+${vsGlobal}% vs moins cher`}
            sx={{
              height: 18,
              fontSize: "0.6rem",
              fontWeight: 900,
              bgcolor: "rgba(239,68,68,0.12)",
              color: "#f87171",
            }}
          />
        )}
      </Stack>

      {/* Availability */}
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: group.offers.some((o) => o.available) ? "#22c55e" : "#f59e0b",
          }}
        />
        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
          {group.offers.filter((o) => o.available).length}/{group.offers.length} boutiques en stock
        </Typography>
      </Stack>

      {/* Top 4 offers */}
      <Stack spacing={0.75} sx={{ mt: 0.5 }}>
        {group.offers.slice(0, 4).map((o, i) => (
          <OfferCell key={`${o.domain}-${i}`} offer={o} isCheapest={i === 0} />
        ))}
        {group.offers.length > 4 && (
          <Typography sx={{ fontSize: "0.68rem", color: "text.disabled", pl: 0.5 }}>
            +{group.offers.length - 4} autres boutiques
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export function CompareTray({ selected, onRemove, onClear }: CompareTrayProps) {
  const show = selected.length >= 2;

  return (
    <Slide direction="up" in={show} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          bgcolor: "surface.high",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
          backdropFilter: "blur(16px)",
          maxHeight: "55vh",
          overflowY: "auto",
        }}
      >
        {/* Tray header */}
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            px: { xs: 2, md: 4 },
            py: 1,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            position: "sticky",
            top: 0,
            bgcolor: "surface.high",
            zIndex: 1,
          }}
        >
          <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
            <SwapHoriz sx={{ color: "var(--rpb-primary)", fontSize: 20 }} />
            <Typography sx={{ fontWeight: 900, fontSize: "0.9rem" }}>
              Comparaison multi-sites
            </Typography>
            <Chip
              size="small"
              label={`${selected.length}/${MAX_COMPARE}`}
              sx={{
                height: 20,
                fontSize: "0.68rem",
                fontWeight: 900,
                bgcolor: "color-mix(in srgb, var(--rpb-primary) 18%, transparent)",
                color: "var(--rpb-primary)",
              }}
            />
            {selected.length < MAX_COMPARE && (
              <Typography sx={{ fontSize: "0.72rem", color: "text.disabled" }}>
                + Ajoute jusqu&apos;a {MAX_COMPARE - selected.length} produit(s)
              </Typography>
            )}
          </Stack>
          <Tooltip title="Vider la comparaison">
            <Button
              size="small"
              variant="text"
              startIcon={<Close sx={{ fontSize: 14 }} />}
              onClick={onClear}
              sx={{ fontSize: "0.75rem", color: "text.secondary", textTransform: "none" }}
            >
              Vider
            </Button>
          </Tooltip>
        </Stack>

        {/* Columns */}
        <Stack
          direction="row"
          sx={{
            px: { xs: 2, md: 4 },
            py: 2,
            gap: 2,
            overflowX: "auto",
            alignItems: "flex-start",
          }}
        >
          {selected.map((g) => (
            <ProductColumn key={g.key} group={g} allGroups={selected} onRemove={onRemove} />
          ))}
        </Stack>
      </Box>
    </Slide>
  );
}
