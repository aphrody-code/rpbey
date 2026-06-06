"use client";

import { Close, WarningAmber } from "@mui/icons-material";
import { Avatar, Box, Chip, IconButton, Typography } from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";
import { StatRadar } from "@/components/ui/StatRadar";
import { type Part } from "@/lib/types";
import { type BuilderStep, isCXBlade, isSlotComplete, useBuilder } from "./BuilderContext";

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(var(--rpb-primary-rgb), 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(var(--rpb-primary-rgb), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--rpb-primary-rgb), 0); }
`;

function parseStat(stat: string | number | null | undefined): number {
  if (typeof stat === "number") return stat;
  if (!stat) return 0;
  const match = String(stat).match(/^(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

function calculateStats(
  blade: Part | null,
  overBlade: Part | null,
  ratchet: Part | null,
  bit: Part | null,
  lockChip: Part | null,
  assistBlade: Part | null,
) {
  const parts = [blade, overBlade, ratchet, bit, lockChip, assistBlade].filter(Boolean) as Part[];
  return parts.reduce(
    (acc, part) => ({
      attack: acc.attack + parseStat(part.attack),
      defense: acc.defense + parseStat(part.defense),
      stamina: acc.stamina + parseStat(part.stamina),
      dash: acc.dash + parseStat(part.dash),
      burst: acc.burst + parseStat(part.burst),
      weight: acc.weight + (part.weight || 0),
    }),
    { attack: 0, defense: 0, stamina: 0, dash: 0, burst: 0, weight: 0 },
  );
}

interface BeySlotCardProps {
  slotIndex: number;
}

interface PartRow {
  key: "blade" | "overBlade" | "ratchet" | "bit" | "lockChip" | "assistBlade";
  label: string;
  step: BuilderStep;
  color: string;
}

const BASE_ROWS: PartRow[] = [
  { key: "blade", label: "Blade", step: "BLADE", color: "#ef4444" },
  { key: "ratchet", label: "Ratchet", step: "RATCHET", color: "#fbbf24" },
  { key: "bit", label: "Bit", step: "BIT", color: "#3b82f6" },
];

const CX_ROWS: PartRow[] = [
  { key: "blade", label: "Core Blade", step: "BLADE", color: "#ef4444" },
  {
    key: "overBlade",
    label: "Over Blade",
    step: "OVER_BLADE",
    color: "#ec4899",
  },
  { key: "lockChip", label: "Lock Chip", step: "LOCK_CHIP", color: "#f97316" },
  {
    key: "assistBlade",
    label: "Assist Blade",
    step: "ASSIST_BLADE",
    color: "#8b5cf6",
  },
  { key: "ratchet", label: "Ratchet", step: "RATCHET", color: "#fbbf24" },
  { key: "bit", label: "Bit", step: "BIT", color: "#3b82f6" },
];

export function BeySlotCard({ slotIndex }: BeySlotCardProps) {
  const { state, dispatch } = useBuilder();
  const bey = state.beys[slotIndex as 0 | 1 | 2];
  const isActive = state.activeSlotIndex === slotIndex;
  const isCX = isCXBlade(bey);
  const rows = isCX ? CX_ROWS : BASE_ROWS;

  const filledCount = rows.filter((r) => !!bey[r.key]).length;
  const isComplete = isSlotComplete(bey);

  const stats = calculateStats(
    bey.blade,
    bey.overBlade,
    bey.ratchet,
    bey.bit,
    bey.lockChip,
    bey.assistBlade,
  );

  const handleSlotClick = () => {
    dispatch({ type: "SET_ACTIVE_SLOT", slotIndex });
    if (window.innerWidth < 900) {
      dispatch({ type: "SET_MOBILE_TAB", tab: "catalog" });
    }
  };

  const handleRemove = (partType: BuilderStep, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: "REMOVE_PART", slotIndex, partType });
  };

  const handleRowClick = (step: BuilderStep) => {
    dispatch({ type: "SET_ACTIVE_SLOT", slotIndex });
    dispatch({ type: "SET_ACTIVE_STEP", step });
    if (window.innerWidth < 900) {
      dispatch({ type: "SET_MOBILE_TAB", tab: "catalog" });
    }
  };

  return (
    <Box
      onClick={handleSlotClick}
      sx={{
        p: 2.5,
        borderRadius: 5,
        border: "2px solid",
        borderColor: isActive ? "error.main" : "divider",
        bgcolor: isActive ? (theme) => alpha(theme.palette.error.main, 0.02) : "background.paper",
        boxShadow: isActive ? "0 10px 30px rgba(var(--rpb-primary-rgb),0.08)" : "none",
        animation: isActive ? `${pulse} 2s infinite` : "none",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        "&:hover": {
          borderColor: isActive ? "error.main" : "text.disabled",
          transform: isActive ? "none" : "translateY(-2px)",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              bgcolor: isActive ? "error.main" : "text.disabled",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "900",
              fontSize: "0.9rem",
            }}
          >
            {slotIndex + 1}
          </Box>
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: "900",
                lineHeight: 1,
              }}
            >
              BEYBLADE
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: "bold",
              }}
            >
              {filledCount}/{rows.length} PIÈCES
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {isCX && (
            <Chip
              label="CUSTOM"
              size="small"
              sx={{
                fontWeight: "900",
                fontSize: "0.6rem",
                height: 20,
                borderRadius: 1,
                bgcolor: alpha("#8b5cf6", 0.1),
                color: "#8b5cf6",
                border: "1px solid",
                borderColor: alpha("#8b5cf6", 0.2),
              }}
            />
          )}
          {isComplete ? (
            <Chip
              label="PRÊT"
              size="small"
              sx={{
                fontWeight: "900",
                fontSize: "0.65rem",
                height: 22,
                borderRadius: 1.5,
                bgcolor: alpha("#22c55e", 0.1),
                color: "#22c55e",
              }}
            />
          ) : (
            <Chip
              icon={<WarningAmber sx={{ fontSize: "12px !important" }} />}
              label="INCOMPLET"
              size="small"
              sx={{
                fontWeight: "900",
                fontSize: "0.65rem",
                height: 22,
                borderRadius: 1.5,
                bgcolor: alpha("#f59e0b", 0.1),
                color: "#f59e0b",
              }}
            />
          )}
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {rows.map(({ key, label, step, color }) => {
          const part = bey[key];
          const isActiveRow = isActive && state.activeStep === step;
          return (
            <Box
              key={key}
              onClick={(e) => {
                e.stopPropagation();
                handleRowClick(step);
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                py: 1,
                px: 1.5,
                borderRadius: 3,
                cursor: "pointer",
                bgcolor: isActiveRow
                  ? (theme) => alpha(theme.palette.error.main, 0.08)
                  : alpha("#000", 0.02),
                border: "1px solid",
                borderColor: isActiveRow ? "error.main" : "transparent",
                transition: "all 0.2s",
                "&:hover": {
                  bgcolor: isActiveRow
                    ? (theme) => alpha(theme.palette.error.main, 0.12)
                    : alpha("#000", 0.05),
                  transform: "translateX(4px)",
                },
              }}
            >
              <Avatar
                src={part?.imageUrl || undefined}
                variant="rounded"
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: part ? "#fff" : alpha(color, 0.1),
                  color: color,
                  p: part ? 0.5 : 0,
                  boxShadow: part ? "0 4px 10px rgba(0,0,0,0.08)" : "none",
                  borderRadius: 2.5,
                  "& img": { objectFit: "contain" },
                }}
              >
                {label[0]}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  color={isActiveRow ? "error.main" : "text.secondary"}
                  sx={{
                    fontSize: "0.6rem",
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {label}
                </Typography>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    fontWeight: "900",
                    color: part ? "text.primary" : "text.disabled",
                    fontStyle: part ? "normal" : "italic",
                  }}
                >
                  {part ? part.name : "Choisir..."}
                </Typography>
              </Box>
              {part && (
                <IconButton
                  size="small"
                  onClick={(e) => handleRemove(step, e)}
                  sx={{
                    p: 0.5,
                    opacity: 0.5,
                    "&:hover": {
                      opacity: 1,
                      color: "error.main",
                      bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                    },
                  }}
                >
                  <Close sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Box>
          );
        })}
      </Box>
      {isComplete && (
        <Box
          sx={{
            mt: 3,
            p: 2.5,
            bgcolor: (theme) => alpha(theme.palette.divider, 0.05),
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: "center",
              gap: 3,
            }}
          >
            <Box
              sx={{
                width: 140,
                height: 140,
                flexShrink: 0,
                display: "flex",
                justifyContent: "center",
                filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.1))",
              }}
            >
              <StatRadar stats={stats} size={140} />
            </Box>

            <Box
              sx={{
                flex: 1,
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
              }}
            >
              <StatBar label="ATTAQUE" value={stats.attack} color="#ef4444" />
              <StatBar label="DÉFENSE" value={stats.defense} color="#3b82f6" />
              <StatBar label="ENDURANCE" value={stats.stamina} color="#22c55e" />
              <StatBar label="DASH" value={stats.dash} color="#fbbf24" />
            </Box>
          </Box>

          <Box
            sx={{
              pt: 2,
              borderTop: "1px dashed",
              borderColor: "divider",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: "900",
                color: "text.secondary",
                letterSpacing: 1,
              }}
            >
              POIDS TOTAL COMBINÉ
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: "900",
                color: "error.main",
              }}
            >
              {stats.weight.toFixed(1)}g
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography
          sx={{
            fontSize: "0.65rem",
            fontWeight: "900",
            color: "text.secondary",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontSize: "0.65rem", fontWeight: "900", color: color }}>
          {value}
        </Typography>
      </Box>
      <Box
        sx={{
          height: 6,
          width: "100%",
          bgcolor: alpha("#000", 0.05),
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${Math.min(value, 100)}%`,
            bgcolor: color,
            borderRadius: 3,
            boxShadow: `0 0 10px ${alpha(color, 0.4)}`,
            transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </Box>
    </Box>
  );
}
