"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BarChartIcon from "@mui/icons-material/BarChart";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import LockIcon from "@mui/icons-material/Lock";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import type { PollDetail } from "@rpbey/api-contract";
import { useToast } from "@/components/ui";
import {
  AWARDS_CATEGORY,
  formatVotes,
  POLL_KIND_LABELS,
  pollsFetcher,
  pollsMutate,
  seasonLabel,
} from "./shared";

interface Props {
  slug: string;
  initialPoll: PollDetail;
}

export function PollVote({ slug, initialPoll }: Props) {
  const theme = useTheme();
  const { showToast } = useToast();

  const { data: poll, mutate } = useSWR<PollDetail>(`/api/v1/polls/${slug}`, pollsFetcher, {
    fallbackData: initialPoll,
    revalidateOnFocus: false,
  });

  const current = poll ?? initialPoll;
  const isMultiple = current.kind === "MULTIPLE";
  const isAward = current.category === AWARDS_CATEGORY;

  // Sélection locale, initialisée sur le vote existant.
  const [selected, setSelected] = useState<string[]>(initialPoll.votedOptionIds);
  const [submitting, setSubmitting] = useState(false);
  // Affiche les résultats si déjà voté (ou clôturé), sinon le formulaire.
  const [showResults, setShowResults] = useState(
    initialPoll.votedOptionIds.length > 0 || initialPoll.isClosed,
  );

  const hasVoted = current.votedOptionIds.length > 0;
  const winningId = useMemo(() => {
    if (current.options.length === 0) return null;
    return [...current.options].sort((a, b) => b.voteCount - a.voteCount)[0]?.id ?? null;
  }, [current.options]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (isMultiple) {
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      }
      return [id];
    });
  };

  const submit = async () => {
    if (selected.length === 0) {
      showToast("Sélectionne au moins une option.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await pollsMutate<{ poll: PollDetail | null }>(
        `/api/polls/${slug}/vote`,
        "POST",
        { optionIds: selected },
      );
      if (updated.poll) {
        await mutate(updated.poll, { revalidate: false });
        setSelected(updated.poll.votedOptionIds);
      }
      setShowResults(true);
      showToast("Ton vote a été enregistré !", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur lors du vote.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const accent = isAward ? "#ffca28" : theme.palette.primary.main;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Button
        component={Link}
        href="/sondages"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3, borderRadius: 3, textTransform: "none", fontWeight: 600 }}
      >
        Tous les sondages
      </Button>

      <Box
        sx={{
          borderRadius: 5,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.6)} 100%)`,
          backdropFilter: "blur(20px)",
        }}
      >
        {/* En-tête */}
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            background: `linear-gradient(135deg, ${alpha(accent, 0.14)} 0%, transparent 70%)`,
          }}
        >
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
            {isAward && (
              <Chip
                size="small"
                icon={<EmojiEventsIcon />}
                label="Beyblade Awards France 2025"
                sx={{
                  fontWeight: 800,
                  bgcolor: alpha(accent, 0.2),
                  "& .MuiChip-icon": { color: accent },
                }}
              />
            )}
            <Chip
              size="small"
              icon={current.isClosed ? <LockIcon /> : <HowToVoteIcon />}
              label={current.isClosed ? "Clôturé" : POLL_KIND_LABELS[current.kind]}
              color={current.isClosed ? "default" : "primary"}
              variant={current.isClosed ? "outlined" : "filled"}
              sx={{ fontWeight: 700 }}
            />
            {current.season && (
              <Chip size="small" variant="outlined" label={seasonLabel(current.season)} />
            )}
          </Stack>

          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
            {current.question}
          </Typography>
          {current.description && (
            <Typography variant="body1" sx={{ color: "text.secondary", mt: 1 }}>
              {current.description}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 2 }}>
            {formatVotes(current.totalVotes)}
            {isMultiple && !showResults ? " · Plusieurs choix possibles" : ""}
          </Typography>
        </Box>

        {/* Corps : formulaire ou résultats */}
        <Box sx={{ p: { xs: 2.5, md: 4 } }}>
          {showResults ? (
            <Results poll={current} winningId={winningId} accent={accent} />
          ) : (
            <PollForm
              poll={current}
              selected={selected}
              isMultiple={isMultiple}
              onToggle={toggle}
            />
          )}

          {/* Actions */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ mt: 3, justifyContent: "space-between", alignItems: "center" }}
          >
            {current.isClosed ? (
              <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                Ce sondage est clôturé — vote indisponible.
              </Typography>
            ) : showResults ? (
              <Button
                variant="outlined"
                onClick={() => setShowResults(false)}
                sx={{ borderRadius: 3, textTransform: "none", fontWeight: 700 }}
              >
                {hasVoted ? "Modifier mon vote" : "Voter"}
              </Button>
            ) : (
              <Button
                variant="contained"
                disabled={submitting || selected.length === 0}
                onClick={submit}
                startIcon={
                  submitting ? <CircularProgress size={18} color="inherit" /> : <HowToVoteIcon />
                }
                sx={{
                  borderRadius: 3,
                  px: 4,
                  py: 1,
                  fontWeight: 800,
                  textTransform: "none",
                  boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.25)}`,
                }}
              >
                {hasVoted ? "Mettre à jour mon vote" : "Voter"}
              </Button>
            )}

            {!current.isClosed && !showResults && current.totalVotes > 0 && (
              <Button
                variant="text"
                startIcon={<BarChartIcon />}
                onClick={() => setShowResults(true)}
                sx={{ borderRadius: 3, textTransform: "none", fontWeight: 600 }}
              >
                Voir les résultats
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
    </Container>
  );
}

/** Formulaire de vote (Radio pour SINGLE/RATING, Checkbox pour MULTIPLE). */
function PollForm({
  poll,
  selected,
  isMultiple,
  onToggle,
}: {
  poll: PollDetail;
  selected: string[];
  isMultiple: boolean;
  onToggle: (id: string) => void;
}) {
  const theme = useTheme();

  const optionRow = (id: string, label: string, imageUrl?: string | null) => {
    const checked = selected.includes(id);
    const control = isMultiple ? (
      <Checkbox checked={checked} onChange={() => onToggle(id)} />
    ) : (
      <Radio checked={checked} value={id} />
    );
    return (
      <FormControlLabel
        key={id}
        value={id}
        control={control}
        onClick={isMultiple ? undefined : () => onToggle(id)}
        label={
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            {imageUrl && <Avatar src={imageUrl} variant="rounded" sx={{ width: 36, height: 36 }} />}
            <Typography sx={{ fontWeight: checked ? 700 : 500 }}>{label}</Typography>
          </Stack>
        }
        sx={{
          m: 0,
          px: 2,
          py: 1.25,
          borderRadius: 3,
          border: "1px solid",
          borderColor: checked ? "primary.main" : "divider",
          bgcolor: checked ? alpha(theme.palette.primary.main, 0.08) : "transparent",
          transition: "background-color .15s, border-color .15s",
          "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.05) },
        }}
      />
    );
  };

  if (isMultiple) {
    return (
      <Stack spacing={1.25}>{poll.options.map((o) => optionRow(o.id, o.label, o.imageUrl))}</Stack>
    );
  }

  return (
    <RadioGroup value={selected[0] ?? ""}>
      <Stack spacing={1.25}>{poll.options.map((o) => optionRow(o.id, o.label, o.imageUrl))}</Stack>
    </RadioGroup>
  );
}

/** Affichage des résultats : barre de progression + pourcentage par option. */
function Results({
  poll,
  winningId,
  accent,
}: {
  poll: PollDetail;
  winningId: string | null;
  accent: string;
}) {
  const theme = useTheme();
  const sorted = [...poll.options].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <Stack spacing={1.75}>
      {sorted.map((o) => {
        const voted = poll.votedOptionIds.includes(o.id);
        const isWinner = o.id === winningId && poll.totalVotes > 0;
        return (
          <Box key={o.id}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                {o.imageUrl && (
                  <Avatar src={o.imageUrl} variant="rounded" sx={{ width: 28, height: 28 }} />
                )}
                <Typography
                  noWrap
                  sx={{
                    fontWeight: voted || isWinner ? 800 : 600,
                    color: voted ? "primary.main" : "text.primary",
                  }}
                >
                  {o.label}
                </Typography>
                {voted && (
                  <CheckCircleIcon sx={{ fontSize: 18, color: "primary.main", flexShrink: 0 }} />
                )}
                {isWinner && (
                  <EmojiEventsIcon sx={{ fontSize: 18, color: accent, flexShrink: 0 }} />
                )}
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                {o.percent}% · {o.voteCount}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={o.percent}
              sx={{
                height: 10,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.text.primary, 0.08),
                "& .MuiLinearProgress-bar": {
                  borderRadius: 999,
                  backgroundColor: voted ? theme.palette.primary.main : alpha(accent, 0.7),
                },
              }}
            />
          </Box>
        );
      })}
    </Stack>
  );
}
