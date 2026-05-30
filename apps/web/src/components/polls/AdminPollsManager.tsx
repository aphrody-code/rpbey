"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import LaunchIcon from "@mui/icons-material/Launch";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PollIcon from "@mui/icons-material/Poll";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import {
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import type { AdminContentResponse, PollSummary, TierListSummary } from "@rpbey/api-contract";
import { useConfirmDialog, useToast } from "@/components/ui";
import { AdminPollForm } from "./AdminPollForm";
import { AdminTierListForm } from "./AdminTierListForm";
import {
  AWARDS_GOOGLE_FORM_URL,
  formatSubmissions,
  formatVotes,
  POLL_KIND_LABELS,
  pollsFetcher,
  pollsMutate,
  seasonLabel,
  TIER_LIST_KIND_LABELS,
} from "./shared";

/** Carte de gestion d'un sondage (featurer / clôturer / supprimer / ouvrir). */
function PollRow({ poll, onChange }: { poll: PollSummary; onChange: () => void }) {
  const theme = useTheme();
  const { showToast } = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await pollsMutate(`/api/admin/polls/${poll.slug}`, "PATCH", body);
      onChange();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Supprimer ce sondage ?",
      message: `« ${poll.question} » et tous ses votes seront définitivement supprimés.`,
      confirmText: "Supprimer",
      confirmColor: "error",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await pollsMutate(`/api/admin/polls/${poll.slug}`, "DELETE");
      showToast("Sondage supprimé.", "success");
      onChange();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: alpha(theme.palette.background.paper, 0.6),
      }}
    >
      {ConfirmDialogComponent}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.5, mb: 0.5 }}>
            <Chip size="small" label={POLL_KIND_LABELS[poll.kind]} variant="outlined" />
            {poll.category && (
              <Chip size="small" label={poll.category} color="primary" variant="outlined" />
            )}
            {poll.season && (
              <Chip size="small" label={seasonLabel(poll.season)} variant="outlined" />
            )}
            {poll.isFeatured && (
              <Chip size="small" icon={<StarIcon />} label="En avant" color="warning" />
            )}
            {poll.isClosed && (
              <Chip size="small" icon={<LockIcon />} label="Clôturé" variant="outlined" />
            )}
          </Stack>
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {poll.question}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {formatVotes(poll.totalVotes)} · {poll.optionCount} option
            {poll.optionCount > 1 ? "s" : ""}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
          {busy && <CircularProgress size={18} sx={{ mr: 0.5 }} />}
          <Tooltip title="Voir la page publique">
            <IconButton
              component={Link}
              href={`/sondages/${poll.slug}`}
              target="_blank"
              size="small"
            >
              <LaunchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={poll.isFeatured ? "Retirer de la une" : "Mettre en avant"}>
            <IconButton
              size="small"
              disabled={busy}
              onClick={() => patch({ isFeatured: !poll.isFeatured })}
            >
              {poll.isFeatured ? (
                <StarIcon fontSize="small" color="warning" />
              ) : (
                <StarBorderIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={poll.isClosed ? "Rouvrir le vote" : "Clôturer le vote"}>
            <IconButton
              size="small"
              disabled={busy}
              onClick={() => patch({ isClosed: !poll.isClosed })}
            >
              {poll.isClosed ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Supprimer">
            <IconButton size="small" color="error" disabled={busy} onClick={remove}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}

/** Carte de gestion d'une tier list (supprimer / ouvrir). */
function TierListRow({ tierList, onChange }: { tierList: TierListSummary; onChange: () => void }) {
  const theme = useTheme();
  const { showToast } = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    const ok = await confirm({
      title: "Supprimer cette tier list ?",
      message: `« ${tierList.title} » et toutes ses soumissions seront définitivement supprimées.`,
      confirmText: "Supprimer",
      confirmColor: "error",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await pollsMutate(`/api/admin/tier-lists/${tierList.slug}`, "DELETE");
      showToast("Tier list supprimée.", "success");
      onChange();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: alpha(theme.palette.background.paper, 0.6),
      }}
    >
      {ConfirmDialogComponent}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.5, mb: 0.5 }}>
            <Chip
              size="small"
              label={TIER_LIST_KIND_LABELS[tierList.kind]}
              color="secondary"
              variant="outlined"
            />
            {tierList.season && (
              <Chip size="small" label={seasonLabel(tierList.season)} variant="outlined" />
            )}
            {tierList.isFeatured && (
              <Chip size="small" icon={<StarIcon />} label="En avant" color="warning" />
            )}
          </Stack>
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {tierList.title}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {formatSubmissions(tierList.totalSubmissions)} · {tierList.subjectCount} sujet
            {tierList.subjectCount > 1 ? "s" : ""}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
          {busy && <CircularProgress size={18} sx={{ mr: 0.5 }} />}
          <Tooltip title="Voir la page publique">
            <IconButton
              component={Link}
              href={`/sondages/tier-list/${tierList.slug}`}
              target="_blank"
              size="small"
            >
              <LaunchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Supprimer">
            <IconButton size="small" color="error" disabled={busy} onClick={remove}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}

export function AdminPollsManager() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);

  const { data, isLoading, mutate } = useSWR<AdminContentResponse>(
    "/api/admin/polls",
    pollsFetcher,
  );
  const reload = () => mutate();

  const polls = data?.polls ?? [];
  const tierLists = data?.tierLists ?? [];

  return (
    <Box>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <PollIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
            Sondages & Tier Lists
          </Typography>
        </Stack>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Crée et gère les sondages (dont les Beyblade Awards) et les tier lists communautaires.
        </Typography>
      </Stack>

      {/* Contexte : Google Form d'origine des Awards */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 3,
          border: "1px solid",
          borderColor: alpha(theme.palette.warning.main, 0.3),
          bgcolor: alpha(theme.palette.warning.main, 0.06),
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Les Beyblade Awards France 2025 sont issus d'un formulaire Google. Référence d'origine :
        </Typography>
        <Button
          component="a"
          href={AWARDS_GOOGLE_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          variant="outlined"
          color="warning"
          endIcon={<OpenInNewIcon />}
          sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700 }}
        >
          Form Google d'origine
        </Button>
      </Box>

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        sx={{ mb: 3, "& .MuiTab-root": { fontWeight: 700, textTransform: "none" } }}
      >
        <Tab label={`Sondages (${polls.length})`} />
        <Tab label={`Tier Lists (${tierLists.length})`} />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <AdminPollForm onCreated={reload} />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Stack spacing={1.5}>
              {isLoading && <CircularProgress size={22} />}
              {!isLoading && polls.length === 0 && (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Aucun sondage. Crée le premier avec le formulaire.
                </Typography>
              )}
              {polls.map((p) => (
                <PollRow key={p.id} poll={p} onChange={reload} />
              ))}
            </Stack>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <AdminTierListForm onCreated={reload} />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Stack spacing={1.5}>
              {isLoading && <CircularProgress size={22} />}
              {!isLoading && tierLists.length === 0 && (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Aucune tier list. Crée la première avec le formulaire.
                </Typography>
              )}
              {tierLists.map((t) => (
                <TierListRow key={t.id} tierList={t} onChange={reload} />
              ))}
            </Stack>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
