"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupsIcon from "@mui/icons-material/Groups";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import PersonIcon from "@mui/icons-material/Person";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SendIcon from "@mui/icons-material/Send";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import type { Tier, TierListDetail, TierListSubject } from "@rpbey/api-contract";
import { useToast } from "@/components/ui";
import {
  formatSubmissions,
  pollsFetcher,
  pollsMutate,
  seasonLabel,
  TIER_COLORS,
  TIER_LIST_KIND_LABELS,
  TIER_ORDER,
} from "./shared";

interface Props {
  slug: string;
  initialTierList: TierListDetail;
}

type View = "mine" | "community";

/** Pastille d'un sujet (image + label), cliquable. */
function SubjectChip({
  subject,
  selected,
  onClick,
  size = 56,
}: {
  subject: TierListSubject;
  selected?: boolean;
  onClick?: () => void;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <Tooltip title={subject.label} arrow>
      <Box
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        sx={{
          width: size,
          height: size,
          borderRadius: 2,
          overflow: "hidden",
          position: "relative",
          cursor: onClick ? "pointer" : "default",
          border: "2px solid",
          borderColor: selected ? "primary.main" : "transparent",
          boxShadow: selected ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.35)}` : "none",
          transition: "transform .12s, box-shadow .12s",
          "&:hover": onClick ? { transform: "scale(1.06)" } : undefined,
          bgcolor: alpha(theme.palette.text.primary, 0.06),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {subject.imageUrl ? (
          <Avatar src={subject.imageUrl} variant="square" sx={{ width: "100%", height: "100%" }} />
        ) : (
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textAlign: "center",
              px: 0.5,
              lineHeight: 1.1,
              wordBreak: "break-word",
            }}
          >
            {subject.label}
          </Typography>
        )}
        {/* Bandeau label en bas pour les sujets avec image. */}
        {subject.imageUrl && (
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              px: 0.5,
              py: 0.25,
              bgcolor: alpha("#000000", 0.6),
            }}
          >
            <Typography
              noWrap
              sx={{ fontSize: 9, fontWeight: 700, color: "#fff", textAlign: "center" }}
            >
              {subject.label}
            </Typography>
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}

export function TierListBuilder({ slug, initialTierList }: Props) {
  const theme = useTheme();
  const { showToast } = useToast();

  const { data, mutate } = useSWR<TierListDetail>(`/api/v1/tier-lists/${slug}`, pollsFetcher, {
    fallbackData: initialTierList,
    revalidateOnFocus: false,
  });
  const tierList = data ?? initialTierList;

  const subjectsById = useMemo(
    () => new Map(tierList.subjects.map((s) => [s.id, s])),
    [tierList.subjects],
  );

  // Placement local : subjectId → tier (initialisé sur le vote existant).
  const [placements, setPlacements] = useState<Record<string, Tier>>(tierList.myPlacements);
  // Sujet sélectionné en attente d'être posé dans un tier (click-to-tier).
  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState<View>("mine");
  const [submitting, setSubmitting] = useState(false);

  const hasSubmitted = Object.keys(tierList.myPlacements).length > 0;

  // Répartition des sujets par tier (vue perso).
  const byTier = useMemo(() => {
    const map: Record<Tier, TierListSubject[]> = { S: [], A: [], B: [], C: [], D: [], F: [] };
    for (const [subjectId, tier] of Object.entries(placements)) {
      const subj = subjectsById.get(subjectId);
      if (subj) map[tier].push(subj);
    }
    return map;
  }, [placements, subjectsById]);

  const unranked = useMemo(
    () => tierList.subjects.filter((s) => !placements[s.id]),
    [tierList.subjects, placements],
  );

  // Communauté : sujets groupés par tier, triés par score décroissant.
  const communityByTier = useMemo(() => {
    const map: Record<Tier, { subject: TierListSubject; score: number; placements: number }[]> = {
      S: [],
      A: [],
      B: [],
      C: [],
      D: [],
      F: [],
    };
    for (const agg of tierList.community) {
      const subj = subjectsById.get(agg.subjectId);
      if (subj)
        map[agg.communityTier].push({
          subject: subj,
          score: agg.averageScore,
          placements: agg.placements,
        });
    }
    for (const t of TIER_ORDER) map[t].sort((a, b) => b.score - a.score);
    return map;
  }, [tierList.community, subjectsById]);

  const place = (subjectId: string, tier: Tier) => {
    setPlacements((prev) => ({ ...prev, [subjectId]: tier }));
    setPicked(null);
  };

  const unplace = (subjectId: string) => {
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[subjectId];
      return next;
    });
  };

  const onTierClick = (tier: Tier) => {
    if (picked) place(picked, tier);
  };

  const onSubjectClick = (subjectId: string) => {
    setPicked((prev) => (prev === subjectId ? null : subjectId));
  };

  const reset = () => {
    setPlacements({});
    setPicked(null);
  };

  const submit = async () => {
    const list = Object.entries(placements).map(([subjectId, tier]) => ({ subjectId, tier }));
    if (list.length === 0) {
      showToast("Classe au moins un sujet avant de soumettre.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await pollsMutate<{ tierList: TierListDetail | null }>(
        `/api/tier-lists/${slug}/submit`,
        "POST",
        { placements: list },
      );
      if (updated.tierList) {
        await mutate(updated.tierList, { revalidate: false });
        setPlacements(updated.tierList.myPlacements);
      }
      showToast("Ton classement a été enregistré !", "success");
      setView("community");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur lors de la soumission.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Button
        component={Link}
        href="/sondages"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3, borderRadius: 3, textTransform: "none", fontWeight: 600 }}
      >
        Tous les sondages
      </Button>

      {/* En-tête */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{
          mb: 3,
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
        }}
      >
        <Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.75, mb: 1 }}>
            <Chip
              size="small"
              icon={<LeaderboardIcon />}
              label={TIER_LIST_KIND_LABELS[tierList.kind]}
              color="secondary"
              sx={{ fontWeight: 700 }}
            />
            {tierList.season && (
              <Chip size="small" variant="outlined" label={seasonLabel(tierList.season)} />
            )}
            <Chip
              size="small"
              variant="outlined"
              icon={<GroupsIcon />}
              label={formatSubmissions(tierList.totalSubmissions)}
            />
          </Stack>
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
            {tierList.title}
          </Typography>
          {tierList.description && (
            <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: 400, mt: 0.5 }}>
              {tierList.description}
            </Typography>
          )}
        </Box>

        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_e, v: View | null) => v && setView(v)}
          size="small"
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 2 } }}
        >
          <ToggleButton value="mine">
            <PersonIcon sx={{ mr: 0.75, fontSize: 18 }} /> Mon classement
          </ToggleButton>
          <ToggleButton value="community">
            <GroupsIcon sx={{ mr: 0.75, fontSize: 18 }} /> Communauté
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {view === "mine" ? (
        <>
          {/* Aide click-to-tier */}
          <Box
            sx={{
              mb: 2,
              px: 2,
              py: 1.25,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: alpha(theme.palette.primary.main, picked ? 0.1 : 0.04),
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {picked ? (
                <>
                  <Box component="span" sx={{ fontWeight: 800, color: "primary.main" }}>
                    {subjectsById.get(picked)?.label}
                  </Box>{" "}
                  sélectionné — clique un tier (S → F) pour le placer.
                </>
              ) : (
                "Clique un sujet, puis clique le tier où le placer. Reclique un sujet déjà classé pour le retirer."
              )}
            </Typography>
          </Box>

          {/* Lignes de tiers */}
          <Stack spacing={1} sx={{ mb: 4 }}>
            {TIER_ORDER.map((tier) => {
              const color = TIER_COLORS[tier];
              return (
                <Stack
                  key={tier}
                  direction="row"
                  spacing={0}
                  sx={{
                    borderRadius: 3,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                    minHeight: 76,
                  }}
                >
                  {/* Étiquette du tier (cliquable pour poser le sujet sélectionné) */}
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => onTierClick(tier)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onTierClick(tier);
                      }
                    }}
                    sx={{
                      width: 76,
                      flexShrink: 0,
                      bgcolor: color.bg,
                      color: color.on,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: picked ? "pointer" : "default",
                      transition: "filter .12s",
                      "&:hover": picked ? { filter: "brightness(1.08)" } : undefined,
                    }}
                  >
                    <Typography variant="h4" sx={{ fontWeight: 900 }}>
                      {tier}
                    </Typography>
                  </Box>
                  {/* Zone de dépôt */}
                  <Box
                    onClick={() => onTierClick(tier)}
                    sx={{
                      flex: 1,
                      p: 1,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 1,
                      alignItems: "center",
                      bgcolor: "background.paper",
                      cursor: picked ? "pointer" : "default",
                    }}
                  >
                    {byTier[tier].map((s) => (
                      <SubjectChip key={s.id} subject={s} onClick={() => unplace(s.id)} />
                    ))}
                  </Box>
                </Stack>
              );
            })}
          </Stack>

          {/* Pool des sujets non classés */}
          <Box
            sx={{
              p: 2.5,
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              backdropFilter: "blur(12px)",
              mb: 4,
            }}
          >
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                À classer ({unranked.length})
              </Typography>
              {Object.keys(placements).length > 0 && (
                <Button
                  size="small"
                  startIcon={<RestartAltIcon />}
                  onClick={reset}
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  Tout réinitialiser
                </Button>
              )}
            </Stack>
            {unranked.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Tous les sujets sont classés. Tu peux soumettre ton classement.
              </Typography>
            ) : (
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                {unranked.map((s) => (
                  <SubjectChip
                    key={s.id}
                    subject={s}
                    selected={picked === s.id}
                    onClick={() => onSubjectClick(s.id)}
                  />
                ))}
              </Stack>
            )}
          </Box>

          {/* Soumission */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Button
              variant="contained"
              disabled={submitting || Object.keys(placements).length === 0}
              onClick={submit}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              sx={{
                borderRadius: 3,
                px: 4,
                py: 1,
                fontWeight: 800,
                textTransform: "none",
                boxShadow: `0 8px 16px ${alpha(theme.palette.secondary.main, 0.25)}`,
              }}
            >
              {hasSubmitted ? "Mettre à jour mon classement" : "Soumettre mon classement"}
            </Button>
            {hasSubmitted && (
              <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                Classement déjà soumis — modifiable à tout moment.
              </Typography>
            )}
          </Stack>
        </>
      ) : (
        <CommunityView byTier={communityByTier} totalSubmissions={tierList.totalSubmissions} />
      )}
    </Container>
  );
}

/** Vue communautaire : chaque sujet dans son tier moyen, trié par score. */
function CommunityView({
  byTier,
  totalSubmissions,
}: {
  byTier: Record<Tier, { subject: TierListSubject; score: number; placements: number }[]>;
  totalSubmissions: number;
}) {
  const theme = useTheme();
  const isEmpty = TIER_ORDER.every((t) => byTier[t].length === 0);

  if (isEmpty || totalSubmissions === 0) {
    return (
      <Box
        sx={{
          py: 8,
          textAlign: "center",
          borderRadius: 4,
          border: "1px dashed",
          borderColor: "divider",
        }}
      >
        <GroupsIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Aucune soumission pour le moment
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Sois le premier à composer ton classement depuis l'onglet « Mon classement ».
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Classement moyen sur {formatSubmissions(totalSubmissions)}. Au sein d'un tier, les sujets
        sont triés par score moyen décroissant.
      </Typography>
      <Stack spacing={1}>
        {TIER_ORDER.map((tier) => {
          const color = TIER_COLORS[tier];
          const items = byTier[tier];
          return (
            <Stack
              key={tier}
              direction="row"
              sx={{
                borderRadius: 3,
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                minHeight: 76,
              }}
            >
              <Box
                sx={{
                  width: 76,
                  flexShrink: 0,
                  bgcolor: color.bg,
                  color: color.on,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 900 }}>
                  {tier}
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  p: 1,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  alignItems: "center",
                  bgcolor: "background.paper",
                }}
              >
                {items.length === 0 ? (
                  <Typography variant="caption" sx={{ color: "text.disabled", pl: 1 }}>
                    —
                  </Typography>
                ) : (
                  items.map(({ subject, score, placements }) => (
                    <Tooltip
                      key={subject.id}
                      arrow
                      title={`${subject.label} · score ${score.toFixed(2)} · ${placements} placement${placements > 1 ? "s" : ""}`}
                    >
                      <Box>
                        <SubjectChip subject={subject} />
                      </Box>
                    </Tooltip>
                  ))
                )}
              </Box>
            </Stack>
          );
        })}
      </Stack>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Chip
          label={`${TIER_ORDER.reduce((n, t) => n + byTier[t].length, 0)} sujets classés par la communauté`}
          variant="outlined"
          sx={{ fontWeight: 600, bgcolor: alpha(theme.palette.secondary.main, 0.06) }}
        />
      </Box>
    </>
  );
}
