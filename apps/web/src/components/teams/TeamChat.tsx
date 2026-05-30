"use client";

import SendIcon from "@mui/icons-material/Send";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type { TeamMessage, TeamMessagesResponse } from "@rpbey/api-contract";
import { useToast } from "@/components/ui";
import { formatTimeFr, initials, teamsFetcher, teamsMutate } from "./shared";

const POLL_INTERVAL = 5000;

/** Espace de discussion d'équipe : polling 5s, envoi, charger plus (curseur). */
export function TeamChat({ teamId, currentUserId }: { teamId: string; currentUserId: string }) {
  const theme = useTheme();
  const { showError } = useToast();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [older, setOlder] = useState<TeamMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLatestRef = useRef<string | null>(null);

  // Page la plus récente, rafraîchie en continu.
  const { data, isLoading, mutate } = useSWR<TeamMessagesResponse>(
    `/api/teams/${teamId}/messages?limit=40`,
    teamsFetcher,
    { refreshInterval: POLL_INTERVAL, revalidateOnFocus: true },
  );

  const recent = data?.messages ?? [];
  // Fusionne les messages plus anciens (chargés via curseur) sans doublon.
  const recentIds = new Set(recent.map((m) => m.id));
  const messages = [...older.filter((m) => !recentIds.has(m.id)), ...recent];
  const latestId = recent[recent.length - 1]?.id ?? null;

  // Curseur de pagination : exposé par la page la plus récente au 1er chargement.
  useEffect(() => {
    if (data?.nextCursor !== undefined && cursor === null) {
      setCursor(data.nextCursor ?? null);
    }
  }, [data?.nextCursor, cursor]);

  // Autoscroll en bas quand un nouveau message arrive.
  useEffect(() => {
    if (latestId && latestId !== prevLatestRef.current) {
      prevLatestRef.current = latestId;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [latestId]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await teamsFetcher<TeamMessagesResponse>(
        `/api/teams/${teamId}/messages?limit=40&before=${encodeURIComponent(cursor)}`,
      );
      setOlder((prev) => [...page.messages, ...prev]);
      setCursor(page.nextCursor ?? null);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, teamId, showError]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await teamsMutate(`/api/teams/${teamId}/messages`, "POST", { content });
      setDraft("");
      await mutate();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 5,
        border: "1px solid",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        height: { xs: 520, md: 620 },
        overflow: "hidden",
      }}
    >
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto", px: { xs: 2, md: 3 }, py: 2 }}>
        {isLoading && messages.length === 0 ? (
          <Stack sx={{ alignItems: "center", py: 6 }}>
            <CircularProgress size={24} />
          </Stack>
        ) : (
          <>
            {cursor && (
              <Stack sx={{ alignItems: "center", mb: 2 }}>
                <Button size="small" onClick={loadMore} disabled={loadingMore} variant="text">
                  {loadingMore ? "Chargement…" : "Charger les messages précédents"}
                </Button>
              </Stack>
            )}
            {messages.length === 0 && (
              <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
                Aucun message. Lance la conversation !
              </Typography>
            )}
            <Stack spacing={1.5}>
              {messages.map((m) => {
                const mine = m.userId === currentUserId;
                const author = m.authorBladerName || m.authorName || "Blader";
                return (
                  <Stack
                    key={m.id}
                    direction="row"
                    spacing={1.5}
                    sx={{ flexDirection: mine ? "row-reverse" : "row" }}
                  >
                    <Avatar
                      src={m.authorImage ?? undefined}
                      sx={{
                        width: 34,
                        height: 34,
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: "primary.main",
                        fontSize: 13,
                      }}
                    >
                      {initials(author)}
                    </Avatar>
                    <Box sx={{ maxWidth: "78%" }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          alignItems: "baseline",
                          flexDirection: mine ? "row-reverse" : "row",
                          mb: 0.25,
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {mine ? "Moi" : author}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimeFr(m.createdAt)}
                        </Typography>
                      </Stack>
                      <Box
                        sx={{
                          px: 1.75,
                          py: 1,
                          borderRadius: 3,
                          bgcolor: mine
                            ? alpha(theme.palette.primary.main, 0.16)
                            : alpha(theme.palette.text.primary, 0.05),
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        <Typography variant="body2">{m.content}</Typography>
                      </Box>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </>
        )}
      </Box>

      <Box
        sx={{
          p: 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(theme.palette.background.default, 0.4),
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder="Écris un message… (Entrée pour envoyer)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
          />
          <IconButton
            color="primary"
            onClick={send}
            disabled={sending || draft.trim() === ""}
            sx={{
              bgcolor: "primary.main",
              color: "primary.contrastText",
              "&:hover": { bgcolor: "primary.dark" },
              "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Card>
  );
}
