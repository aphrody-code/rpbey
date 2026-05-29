"use client";

import { useTransition } from "react";
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import type { TransactionType } from "@/lib/types";
import { TRANSACTION_LABELS } from "@/lib/gacha-helpers";

export interface TransactionRow {
  id: string;
  amount: number;
  type: TransactionType;
  note: string | null;
  createdAt: Date | string;
}

interface HistoryClientProps {
  transactions: TransactionRow[];
  typeFilter: string;
}

const ALL_TYPES: TransactionType[] = [
  "DAILY_CLAIM",
  "GACHA_PULL",
  "MULTI_PULL",
  "ADMIN_GIVE",
  "ADMIN_TAKE",
  "TOURNAMENT_REWARD",
  "SELL_CARD",
  "STREAK_BONUS",
  "BADGE_REWARD",
  "DUEL_REWARD",
];

export function HistoryClient({ transactions, typeFilter }: HistoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function buildUrl(type: string | null) {
    const sp = new URLSearchParams(searchParams.toString());
    if (type) {
      sp.set("type", type);
    } else {
      sp.delete("type");
    }
    return `/dashboard/gacha/history?${sp.toString()}`;
  }

  function handleTypeChange(e: SelectChangeEvent) {
    startTransition(() => {
      router.push(buildUrl(e.target.value || null));
    });
  }

  function formatDate(raw: Date | string): string {
    return new Date(raw).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <>
      {/* Filter */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Type de transaction</InputLabel>
          <Select value={typeFilter} label="Type de transaction" onChange={handleTypeChange}>
            <MenuItem value="">Tous</MenuItem>
            {ALL_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {TRANSACTION_LABELS[t].label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {transactions.length === 0 ? (
        <Box
          sx={{
            py: 8,
            textAlign: "center",
            color: "text.secondary",
            bgcolor: "background.paper",
            borderRadius: 3,
            border: "1px dashed",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            Aucune transaction
          </Typography>
          <Typography variant="body2">Lance /pull ou /daily sur Discord pour commencer.</Typography>
        </Box>
      ) : (
        <TableContainer
          sx={{
            bgcolor: "background.paper",
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  Montant
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Note</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((tx) => {
                const meta = TRANSACTION_LABELS[tx.type];
                const isPositive = tx.amount > 0;
                return (
                  <TableRow key={tx.id} sx={{ "&:last-child td": { border: 0 } }}>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {formatDate(tx.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={meta.label}
                        size="small"
                        sx={{
                          bgcolor: meta.color,
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: "0.7rem",
                          height: 22,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: isPositive ? "success.main" : "error.main",
                        }}
                      >
                        {isPositive ? "+" : ""}
                        {tx.amount.toLocaleString("fr-FR")}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {tx.note ?? "—"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
