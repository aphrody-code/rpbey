"use client";

import PersonAddIcon from "@mui/icons-material/PersonAdd";
import {
  alpha,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui";
import { initials, teamsFetcher, teamsMutate } from "./shared";

interface InvitableUser {
  id: string;
  name: string | null;
  image: string | null;
  bladerName: string | null;
}

/** Onglet recrutement : recherche de joueurs sans équipe + invitation. */
export function TeamRecruitPanel({ teamId }: { teamId: string }) {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<InvitableUser | null>(null);
  const [message, setMessage] = useState("");
  const [options, setOptions] = useState<InvitableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const debounced = useDebounce(input, 350);

  useEffect(() => {
    let active = true;
    const q = debounced.trim();
    if (q.length < 1) {
      setOptions([]);
      return;
    }
    setLoading(true);
    teamsFetcher<{ users: InvitableUser[] }>(`/api/teams/search-users?q=${encodeURIComponent(q)}`)
      .then((data) => {
        if (active) setOptions(data.users ?? []);
      })
      .catch(() => {
        if (active) setOptions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debounced]);

  const invite = async () => {
    if (!selected) return;
    setInviting(true);
    try {
      await teamsMutate(`/api/teams/${teamId}/invite`, "POST", {
        userId: selected.id,
        message: message.trim() === "" ? undefined : message.trim(),
      });
      showSuccess(`Invitation envoyée à ${selected.bladerName || selected.name || "ce joueur"}.`);
      setSelected(null);
      setInput("");
      setMessage("");
      setOptions([]);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Invitation impossible.");
    } finally {
      setInviting(false);
    }
  };

  const label = useMemo(() => (u: InvitableUser) => u.bladerName || u.name || "Blader inconnu", []);

  return (
    <Card elevation={0} sx={{ borderRadius: 5, border: "1px solid", borderColor: "divider" }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
          <PersonAddIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Recruter un joueur
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Recherche un Blader sans équipe et envoie-lui une invitation.
        </Typography>

        <Stack spacing={2.5}>
          <Autocomplete<InvitableUser>
            value={selected}
            onChange={(_e, v) => setSelected(v)}
            inputValue={input}
            onInputChange={(_e, v) => setInput(v)}
            options={options}
            loading={loading}
            filterOptions={(x) => x}
            getOptionLabel={label}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText={input.trim() ? "Aucun joueur disponible" : "Tape un nom…"}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id}>
                <Avatar
                  src={option.image ?? undefined}
                  sx={{
                    width: 28,
                    height: 28,
                    mr: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                    color: "primary.main",
                    fontSize: 12,
                  }}
                >
                  {initials(option.bladerName ?? option.name)}
                </Avatar>
                {label(option)}
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Joueur à inviter"
                placeholder="Nom de Blader…"
                slotProps={{
                  ...params.slotProps,
                  input: {
                    ...params.slotProps.input,
                    endAdornment: (
                      <>
                        {loading ? <CircularProgress size={18} /> : null}
                        {params.slotProps.input.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
          <TextField
            label="Message (facultatif)"
            multiline
            minRows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              disabled={!selected || inviting}
              onClick={invite}
              sx={{ borderRadius: 3, px: 3, fontWeight: 700 }}
            >
              {inviting ? "Envoi…" : "Inviter"}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
