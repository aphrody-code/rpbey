"use client";

import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import MailIcon from "@mui/icons-material/Mail";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import type { TeamInvite } from "@rpbey/api-contract";
import { useToast } from "@/components/ui";
import { formatDateFr, initials, teamsMutate } from "./shared";

/** Liste des invitations reçues par l'utilisateur, avec Accepter / Refuser. */
export function MyInvitesPanel({
  invites,
  onResponded,
}: {
  invites: TeamInvite[];
  onResponded: (acceptedSlug?: string) => void;
}) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const respond = async (invite: TeamInvite, accept: boolean) => {
    setPendingId(invite.id);
    try {
      const data = await teamsMutate<{ teamSlug?: string }>(
        `/api/teams/invites/${invite.id}`,
        "POST",
        { accept },
      );
      showSuccess(accept ? `Tu as rejoint ${invite.team.name} !` : "Invitation refusée.");
      onResponded(accept ? data?.teamSlug : undefined);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setPendingId(null);
    }
  };

  if (invites.length === 0) {
    return (
      <Card elevation={0} sx={{ borderRadius: 5, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          <MailIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">Aucune invitation en attente.</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={0} sx={{ borderRadius: 5, border: "1px solid", borderColor: "divider" }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <MailIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Invitations reçues ({invites.length})
          </Typography>
        </Stack>
        <Stack spacing={2}>
          {invites.map((invite) => {
            const accent = invite.team.accentColor || theme.palette.primary.main;
            const busy = pendingId === invite.id;
            return (
              <Box
                key={invite.id}
                sx={{
                  p: 2,
                  borderRadius: 4,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: alpha(accent, 0.04),
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ alignItems: { xs: "stretch", sm: "center" } }}
                >
                  <Avatar
                    src={invite.team.logoUrl ?? undefined}
                    sx={{ bgcolor: alpha(accent, 0.2), color: accent, fontWeight: 800 }}
                  >
                    {initials(invite.team.name)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }}>
                      [{invite.team.tag}] {invite.team.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {invite.invitedByName ? `Invité par ${invite.invitedByName} · ` : ""}
                      {formatDateFr(invite.createdAt)}
                    </Typography>
                    {invite.message && (
                      <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic" }}>
                        « {invite.message} »
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      disabled={busy}
                      startIcon={<CheckIcon />}
                      onClick={() => respond(invite, true)}
                      sx={{ borderRadius: 2.5, fontWeight: 700 }}
                    >
                      Accepter
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      size="small"
                      disabled={busy}
                      startIcon={<CloseIcon />}
                      onClick={() => respond(invite, false)}
                      sx={{ borderRadius: 2.5 }}
                    >
                      Refuser
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
