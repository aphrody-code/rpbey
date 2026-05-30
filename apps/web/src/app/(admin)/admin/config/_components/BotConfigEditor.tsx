"use client";

import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore,
  Save as SaveIcon,
} from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Grid as MuiGrid,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import { useState } from "react";
import { useToast } from "@/components/ui";
import type {
  BotConfig,
  ChannelsConfig,
  CooldownsConfig,
  EconomyConfig,
  FeaturesConfig,
  GoodbyeConfig,
  LevelingConfig,
  LoggingConfig,
  ModerationConfig,
  PanelsConfig,
  RolesConfig,
  WelcomeConfig,
} from "@rpbey/api-contract";

// ── Types helpers ─────────────────────────────────────────────────────────────

interface DiscordChannel {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  position: number;
}

interface DiscordRole {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Props {
  initialConfig: BotConfig;
  channels: DiscordChannel[];
  roles: DiscordRole[];
}

// ── Composant champ canal / rôle ──────────────────────────────────────────────

function ChannelSelect({
  label,
  value,
  channels,
  onChange,
}: {
  label: string;
  value: string | null;
  channels: DiscordChannel[];
  onChange: (v: string | null) => void;
}) {
  const textChannels = channels.filter((c) => c.type === "GUILD_TEXT" || c.type === "0");
  return (
    <Select
      size="small"
      fullWidth
      displayEmpty
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      renderValue={(v) => {
        if (!v)
          return (
            <em style={{ color: "var(--md-sys-color-outline, rgba(0,0,0,0.38))" }}>{label}</em>
          );
        const ch = channels.find((c) => c.id === v);
        return ch ? `#${ch.name}` : v;
      }}
    >
      <MenuItem value="">
        <em>— aucun —</em>
      </MenuItem>
      {textChannels.map((c) => (
        <MenuItem key={c.id} value={c.id}>
          #{c.name}
        </MenuItem>
      ))}
    </Select>
  );
}

// Discord assigns this hex to roles with no custom colour — treat as "no colour".
const DISCORD_UNSET_ROLE_COLOR = ["#", "0", "0", "0", "0", "0", "0"].join("");

function RoleSelect({
  label,
  value,
  roles,
  onChange,
}: {
  label: string;
  value: string | null;
  roles: DiscordRole[];
  onChange: (v: string | null) => void;
}) {
  return (
    <Select
      size="small"
      fullWidth
      displayEmpty
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      renderValue={(v) => {
        if (!v)
          return (
            <em style={{ color: "var(--md-sys-color-outline, rgba(0,0,0,0.38))" }}>{label}</em>
          );
        const r = roles.find((r) => r.id === v);
        return r ? `@${r.name}` : v;
      }}
    >
      <MenuItem value="">
        <em>— aucun —</em>
      </MenuItem>
      {roles.map((r) => {
        const roleColor =
          r.color && r.color !== DISCORD_UNSET_ROLE_COLOR
            ? r.color
            : "var(--md-sys-color-outline-variant)";
        return (
          <MenuItem key={r.id} value={r.id}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: roleColor,
                  flexShrink: 0,
                }}
              />
              @{r.name}
            </Box>
          </MenuItem>
        );
      })}
    </Select>
  );
}

// ── Hook de sauvegarde section ────────────────────────────────────────────────

function useSaveSection(showToast: ReturnType<typeof useToast>["showToast"]) {
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (section: string, data: unknown) => {
    setSaving(section);
    try {
      const res = await fetch("/api/admin/guild-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      showToast("Section sauvegardee", "success");
    } catch (err) {
      showToast(`Erreur : ${String(err)}`, "error");
    } finally {
      setSaving(null);
    }
  };

  return { saving, save };
}

// ── Section Canaux ────────────────────────────────────────────────────────────

const CHANNEL_KEYS: { key: keyof ChannelsConfig; label: string }[] = [
  { key: "welcome", label: "Accueil" },
  { key: "rules", label: "Reglement" },
  { key: "roles", label: "Attribution roles" },
  { key: "announcements", label: "Annonces" },
  { key: "tournaments", label: "Tournois" },
  { key: "social", label: "Social" },
  { key: "generalChat", label: "Chat general" },
  { key: "suggestions", label: "Suggestions" },
  { key: "media", label: "Media" },
  { key: "bot", label: "Bot" },
  { key: "log", label: "Logs" },
  { key: "muted", label: "Muted" },
  { key: "classement", label: "Classement" },
  { key: "tournamentReminder", label: "Rappel tournoi" },
];

function ChannelsSection({
  value,
  channels,
  onSave,
  saving,
}: {
  value: ChannelsConfig;
  channels: DiscordChannel[];
  onSave: (data: ChannelsConfig) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ChannelsConfig>({ ...value });

  const set = (key: keyof ChannelsConfig, v: string | null) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  return (
    <Box>
      <MuiGrid container spacing={2}>
        {CHANNEL_KEYS.map(({ key, label }) => (
          <MuiGrid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              {label}
            </Typography>
            {channels.length > 0 ? (
              <ChannelSelect
                label={label}
                value={form[key] ?? null}
                channels={channels}
                onChange={(v) => set(key, v)}
              />
            ) : (
              <TextField
                size="small"
                fullWidth
                placeholder="ID canal"
                value={form[key] ?? ""}
                onChange={(e) => set(key, e.target.value || null)}
              />
            )}
          </MuiGrid>
        ))}
      </MuiGrid>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(form)}
        >
          Sauvegarder Canaux
        </Button>
      </Box>
    </Box>
  );
}

// ── Section Roles ─────────────────────────────────────────────────────────────

const ROLE_KEYS: { key: keyof RolesConfig; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "rh", label: "RH" },
  { key: "modo", label: "Moderation" },
  { key: "staff", label: "Staff" },
  { key: "partenaires", label: "Partenaires" },
  { key: "participant", label: "Participant" },
  { key: "spectateur", label: "Spectateur" },
  { key: "reseaux", label: "Reseaux" },
  { key: "events", label: "Events" },
  { key: "leaks", label: "Leaks" },
  { key: "restock", label: "Restock" },
  { key: "mudae", label: "Mudae" },
  { key: "blader", label: "Blader" },
  { key: "tournoiNotification", label: "Notification tournoi" },
  { key: "mute", label: "Mute" },
];

function RolesSection({
  value,
  roles,
  onSave,
  saving,
}: {
  value: RolesConfig;
  roles: DiscordRole[];
  onSave: (data: RolesConfig) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<RolesConfig>({ ...value });

  const set = (key: keyof RolesConfig, v: string | null) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  return (
    <Box>
      <MuiGrid container spacing={2}>
        {ROLE_KEYS.map(({ key, label }) => (
          <MuiGrid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              {label}
            </Typography>
            {roles.length > 0 ? (
              <RoleSelect
                label={label}
                value={form[key] ?? null}
                roles={roles}
                onChange={(v) => set(key, v)}
              />
            ) : (
              <TextField
                size="small"
                fullWidth
                placeholder="ID role"
                value={form[key] ?? ""}
                onChange={(e) => set(key, e.target.value || null)}
              />
            )}
          </MuiGrid>
        ))}
      </MuiGrid>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(form)}
        >
          Sauvegarder Roles
        </Button>
      </Box>
    </Box>
  );
}

// ── Section Economie ──────────────────────────────────────────────────────────

function EconomySection({
  value,
  onSave,
  saving,
}: {
  value: EconomyConfig;
  onSave: (data: EconomyConfig) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<EconomyConfig>({ ...value });

  const setNum = (key: keyof EconomyConfig, v: string) => {
    const n = Number(v);
    if (!isNaN(n)) setForm((prev) => ({ ...prev, [key]: n }));
  };

  const updateStreakBonus = (i: number, v: string) => {
    const n = Number(v);
    if (isNaN(n)) return;
    const arr = [...(form.streakBonuses ?? [])];
    arr[i] = n;
    setForm((prev) => ({ ...prev, streakBonuses: arr }));
  };

  const addStreakBonus = () =>
    setForm((prev) => ({ ...prev, streakBonuses: [...(prev.streakBonuses ?? []), 0] }));

  const removeStreakBonus = (i: number) =>
    setForm((prev) => ({
      ...prev,
      streakBonuses: (prev.streakBonuses ?? []).filter((_, idx) => idx !== i),
    }));

  return (
    <Box>
      <MuiGrid container spacing={2}>
        <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            size="small"
            fullWidth
            label="Cout pull simple (zeni)"
            type="number"
            value={form.gachaCost}
            onChange={(e) => setNum("gachaCost", e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        </MuiGrid>
        <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            size="small"
            fullWidth
            label="Cout multi-pull (zeni)"
            type="number"
            value={form.multiPullCost}
            onChange={(e) => setNum("multiPullCost", e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        </MuiGrid>
        <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            size="small"
            fullWidth
            label="Cooldown don (ms)"
            type="number"
            value={form.giftCooldownMs}
            onChange={(e) => setNum("giftCooldownMs", e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        </MuiGrid>
        <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            size="small"
            fullWidth
            label="Interet dette (%)"
            type="number"
            value={form.debtInterestPct}
            onChange={(e) => setNum("debtInterestPct", e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        </MuiGrid>
      </MuiGrid>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">Bonus de streak (XP par jour)</Typography>
          <Tooltip title="Ajouter un palier">
            <IconButton size="small" onClick={addStreakBonus}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {(form.streakBonuses ?? []).map((b, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <TextField
                size="small"
                type="number"
                value={b}
                onChange={(e) => updateStreakBonus(i, e.target.value)}
                sx={{ width: 80 }}
                slotProps={{ htmlInput: { min: 0 } }}
              />
              <Tooltip title="Supprimer">
                <IconButton size="small" color="error" onClick={() => removeStreakBonus(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(form)}
        >
          Sauvegarder Economie
        </Button>
      </Box>
    </Box>
  );
}

// ── Section Moderation ────────────────────────────────────────────────────────

const MUTE_DURATION_LABELS: Record<number, string> = {
  300000: "5 min",
  3600000: "1 h",
  21600000: "6 h",
  86400000: "1 j",
  604800000: "7 j",
};

function ModerationSection({
  value,
  onSave,
  saving,
}: {
  value: ModerationConfig;
  onSave: (data: ModerationConfig) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ModerationConfig>({ ...value });

  const setNum = (key: keyof ModerationConfig, v: string) => {
    const n = Number(v);
    if (!isNaN(n)) setForm((prev) => ({ ...prev, [key]: n }));
  };

  const addDuration = () =>
    setForm((prev) => ({
      ...prev,
      muteDurationsMs: [...(prev.muteDurationsMs ?? []), 3600000],
    }));

  const updateDuration = (i: number, v: string) => {
    const n = Number(v);
    if (isNaN(n)) return;
    const arr = [...(form.muteDurationsMs ?? [])];
    arr[i] = n;
    setForm((prev) => ({ ...prev, muteDurationsMs: arr }));
  };

  const removeDuration = (i: number) =>
    setForm((prev) => ({
      ...prev,
      muteDurationsMs: (prev.muteDurationsMs ?? []).filter((_, idx) => idx !== i),
    }));

  return (
    <Box>
      <MuiGrid container spacing={2}>
        <MuiGrid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            size="small"
            fullWidth
            label="Max. avertissements"
            type="number"
            value={form.maxWarnings}
            onChange={(e) => setNum("maxWarnings", e.target.value)}
            slotProps={{ htmlInput: { min: 1 } }}
          />
        </MuiGrid>
        <MuiGrid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            size="small"
            fullWidth
            label="Seuil action auto (warns)"
            type="number"
            value={form.autoActionAtWarns}
            onChange={(e) => setNum("autoActionAtWarns", e.target.value)}
            slotProps={{ htmlInput: { min: 1 } }}
          />
        </MuiGrid>
        <MuiGrid size={{ xs: 12, sm: 6, md: 4 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            Action automatique
          </Typography>
          <Select
            size="small"
            fullWidth
            value={form.autoActionType ?? "mute"}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                autoActionType: e.target.value as ModerationConfig["autoActionType"],
              }))
            }
          >
            <MenuItem value="none">Aucune</MenuItem>
            <MenuItem value="mute">Mute</MenuItem>
            <MenuItem value="kick">Kick</MenuItem>
            <MenuItem value="ban">Ban</MenuItem>
          </Select>
        </MuiGrid>
        <MuiGrid size={{ xs: 12 }}>
          <TextField
            size="small"
            fullWidth
            label="Raison de ban par defaut"
            value={form.defaultBanReason ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, defaultBanReason: e.target.value }))}
          />
        </MuiGrid>
      </MuiGrid>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">Durees de mute disponibles</Typography>
          <Tooltip title="Ajouter une duree">
            <IconButton size="small" onClick={addDuration}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {(form.muteDurationsMs ?? []).map((d, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <TextField
                size="small"
                type="number"
                label="ms"
                value={d}
                onChange={(e) => updateDuration(i, e.target.value)}
                sx={{ width: 120 }}
                slotProps={{ htmlInput: { min: 1 } }}
              />
              {MUTE_DURATION_LABELS[d] && (
                <Chip label={MUTE_DURATION_LABELS[d]} size="small" variant="outlined" />
              )}
              <Tooltip title="Supprimer">
                <IconButton size="small" color="error" onClick={() => removeDuration(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(form)}
        >
          Sauvegarder Moderation
        </Button>
      </Box>
    </Box>
  );
}

// ── Section Cooldowns ─────────────────────────────────────────────────────────

const COOLDOWN_KEYS: { key: keyof CooldownsConfig; label: string }[] = [
  { key: "duelChallengeTimeoutMs", label: "Timeout defi duel (ms)" },
  { key: "duelSelectionTimeoutMs", label: "Timeout selection bey (ms)" },
  { key: "duelRoundDelayMs", label: "Delai entre rounds (ms)" },
  { key: "duelCooldownMs", label: "Cooldown duels (ms)" },
];

function CooldownsSection({
  value,
  onSave,
  saving,
}: {
  value: CooldownsConfig;
  onSave: (data: CooldownsConfig) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CooldownsConfig>({ ...value });

  const setNum = (key: keyof CooldownsConfig, v: string) => {
    const n = Number(v);
    if (!isNaN(n)) setForm((prev) => ({ ...prev, [key]: n }));
  };

  return (
    <Box>
      <MuiGrid container spacing={2}>
        {COOLDOWN_KEYS.map(({ key, label }) => (
          <MuiGrid key={key} size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              size="small"
              fullWidth
              label={label}
              type="number"
              value={form[key] ?? 0}
              onChange={(e) => setNum(key, e.target.value)}
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </MuiGrid>
        ))}
      </MuiGrid>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(form)}
        >
          Sauvegarder Cooldowns
        </Button>
      </Box>
    </Box>
  );
}

// ── Section Welcome / Goodbye ─────────────────────────────────────────────────

function WelcomeSection({
  value,
  channels,
  roles,
  onSave,
  saving,
}: {
  value: WelcomeConfig;
  channels: DiscordChannel[];
  roles: DiscordRole[];
  onSave: (data: WelcomeConfig) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<WelcomeConfig>({ ...value });

  const addAutorole = () =>
    setForm((prev) => ({ ...prev, autoroleIds: [...(prev.autoroleIds ?? []), ""] }));
  const updateAutorole = (i: number, v: string) => {
    const arr = [...(form.autoroleIds ?? [])];
    arr[i] = v;
    setForm((prev) => ({ ...prev, autoroleIds: arr }));
  };
  const removeAutorole = (i: number) =>
    setForm((prev) => ({
      ...prev,
      autoroleIds: (prev.autoroleIds ?? []).filter((_, idx) => idx !== i),
    }));

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={!!form.enabled}
            onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
        }
        label="Activer le message d'accueil"
        sx={{ mb: 1 }}
      />
      <MuiGrid container spacing={2}>
        <MuiGrid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            Canal d'accueil
          </Typography>
          {channels.length > 0 ? (
            <ChannelSelect
              label="Canal"
              value={form.channelId ?? null}
              channels={channels}
              onChange={(v) => setForm((prev) => ({ ...prev, channelId: v }))}
            />
          ) : (
            <TextField
              size="small"
              fullWidth
              placeholder="ID canal"
              value={form.channelId ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, channelId: e.target.value || null }))}
            />
          )}
        </MuiGrid>
        <MuiGrid size={{ xs: 12, sm: 6 }}>
          <FormControlLabel
            control={
              <Switch
                checked={!!form.dm}
                onChange={(e) => setForm((prev) => ({ ...prev, dm: e.target.checked }))}
              />
            }
            label="Envoyer aussi en DM"
          />
        </MuiGrid>
        <MuiGrid size={{ xs: 12 }}>
          <TextField
            size="small"
            fullWidth
            multiline
            rows={3}
            label="Message d'accueil ({user} = mention)"
            value={form.message ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          />
        </MuiGrid>
      </MuiGrid>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">Roles attribues automatiquement</Typography>
          <Tooltip title="Ajouter un role">
            <IconButton size="small" onClick={addAutorole}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {(form.autoroleIds ?? []).map((rid, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {roles.length > 0 ? (
                <RoleSelect
                  label="Role"
                  value={rid || null}
                  roles={roles}
                  onChange={(v) => updateAutorole(i, v ?? "")}
                />
              ) : (
                <TextField
                  size="small"
                  placeholder="ID role"
                  value={rid}
                  onChange={(e) => updateAutorole(i, e.target.value)}
                  sx={{ width: 160 }}
                />
              )}
              <Tooltip title="Supprimer">
                <IconButton size="small" color="error" onClick={() => removeAutorole(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(form)}
        >
          Sauvegarder Accueil
        </Button>
      </Box>
    </Box>
  );
}

function GoodbyeSection({
  value,
  channels,
  onSave,
  saving,
}: {
  value: GoodbyeConfig;
  channels: DiscordChannel[];
  onSave: (data: GoodbyeConfig) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<GoodbyeConfig>({ ...value });

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={!!form.enabled}
            onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
        }
        label="Activer le message de depart"
        sx={{ mb: 1 }}
      />
      <MuiGrid container spacing={2}>
        <MuiGrid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            Canal de depart
          </Typography>
          {channels.length > 0 ? (
            <ChannelSelect
              label="Canal"
              value={form.channelId ?? null}
              channels={channels}
              onChange={(v) => setForm((prev) => ({ ...prev, channelId: v }))}
            />
          ) : (
            <TextField
              size="small"
              fullWidth
              placeholder="ID canal"
              value={form.channelId ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, channelId: e.target.value || null }))}
            />
          )}
        </MuiGrid>
        <MuiGrid size={{ xs: 12 }}>
          <TextField
            size="small"
            fullWidth
            multiline
            rows={2}
            label="Message de depart ({user} = tag)"
            value={form.message ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          />
        </MuiGrid>
      </MuiGrid>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(form)}
        >
          Sauvegarder Depart
        </Button>
      </Box>
    </Box>
  );
}

// ── Section Leveling ──────────────────────────────────────────────────────────

function LevelingSection({
  value,
  channels,
  roles,
  onSave,
  saving,
}: {
  value: LevelingConfig;
  channels: DiscordChannel[];
  roles: DiscordRole[];
  onSave: (data: LevelingConfig) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<LevelingConfig>({ ...value });

  const setNum = (key: keyof LevelingConfig, v: string) => {
    const n = Number(v);
    if (!isNaN(n)) setForm((prev) => ({ ...prev, [key]: n }));
  };

  const addLevelRole = () =>
    setForm((prev) => ({
      ...prev,
      levelRoles: [...(prev.levelRoles ?? []), { level: 0, roleId: "" }],
    }));

  const updateLevelRole = (i: number, field: "level" | "roleId", v: string) => {
    const arr = [...(form.levelRoles ?? [])];
    const cur = arr[i] ?? { level: 0, roleId: "" };
    if (field === "level") arr[i] = { level: Number(v) || 0, roleId: cur.roleId };
    else arr[i] = { level: cur.level, roleId: v };
    setForm((prev) => ({ ...prev, levelRoles: arr }));
  };

  const removeLevelRole = (i: number) =>
    setForm((prev) => ({
      ...prev,
      levelRoles: (prev.levelRoles ?? []).filter((_, idx) => idx !== i),
    }));

  const addNoXpChannel = () =>
    setForm((prev) => ({ ...prev, noXpChannels: [...(prev.noXpChannels ?? []), ""] }));

  const updateNoXpChannel = (i: number, v: string) => {
    const arr = [...(form.noXpChannels ?? [])];
    arr[i] = v;
    setForm((prev) => ({ ...prev, noXpChannels: arr }));
  };

  const removeNoXpChannel = (i: number) =>
    setForm((prev) => ({
      ...prev,
      noXpChannels: (prev.noXpChannels ?? []).filter((_, idx) => idx !== i),
    }));

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={!!form.enabled}
            onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
        }
        label="Activer le systeme de niveaux"
        sx={{ mb: 1 }}
      />
      <MuiGrid container spacing={2}>
        <MuiGrid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            size="small"
            fullWidth
            label="XP par message"
            type="number"
            value={form.xpPerMessage ?? 15}
            onChange={(e) => setNum("xpPerMessage", e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        </MuiGrid>
        <MuiGrid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            size="small"
            fullWidth
            label="Cooldown XP message (ms)"
            type="number"
            value={form.xpCooldownMs ?? 60000}
            onChange={(e) => setNum("xpCooldownMs", e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        </MuiGrid>
        <MuiGrid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            size="small"
            fullWidth
            label="XP vocal par minute"
            type="number"
            value={form.voiceXpPerMin ?? 5}
            onChange={(e) => setNum("voiceXpPerMin", e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        </MuiGrid>
      </MuiGrid>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">Roles par niveau atteint</Typography>
          <Tooltip title="Ajouter">
            <IconButton size="small" onClick={addLevelRole}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Stack spacing={1}>
          {(form.levelRoles ?? []).map((lr, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TextField
                size="small"
                label="Niveau"
                type="number"
                value={lr.level}
                onChange={(e) => updateLevelRole(i, "level", e.target.value)}
                sx={{ width: 80 }}
                slotProps={{ htmlInput: { min: 0 } }}
              />
              {roles.length > 0 ? (
                <Box sx={{ flex: 1 }}>
                  <RoleSelect
                    label="Role"
                    value={lr.roleId || null}
                    roles={roles}
                    onChange={(v) => updateLevelRole(i, "roleId", v ?? "")}
                  />
                </Box>
              ) : (
                <TextField
                  size="small"
                  label="ID role"
                  value={lr.roleId}
                  onChange={(e) => updateLevelRole(i, "roleId", e.target.value)}
                  sx={{ flex: 1 }}
                />
              )}
              <IconButton size="small" color="error" onClick={() => removeLevelRole(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">Canaux sans XP</Typography>
          <Tooltip title="Ajouter">
            <IconButton size="small" onClick={addNoXpChannel}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {(form.noXpChannels ?? []).map((cid, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {channels.length > 0 ? (
                <Box sx={{ minWidth: 160 }}>
                  <ChannelSelect
                    label="Canal"
                    value={cid || null}
                    channels={channels}
                    onChange={(v) => updateNoXpChannel(i, v ?? "")}
                  />
                </Box>
              ) : (
                <TextField
                  size="small"
                  placeholder="ID canal"
                  value={cid}
                  onChange={(e) => updateNoXpChannel(i, e.target.value)}
                  sx={{ width: 160 }}
                />
              )}
              <IconButton size="small" color="error" onClick={() => removeNoXpChannel(i)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(form)}
        >
          Sauvegarder Leveling
        </Button>
      </Box>
    </Box>
  );
}

// ── Section Logging ───────────────────────────────────────────────────────────

const LOGGING_KEYS: { key: keyof LoggingConfig; label: string }[] = [
  { key: "messages", label: "Messages" },
  { key: "members", label: "Membres" },
  { key: "moderation", label: "Moderation" },
  { key: "voice", label: "Vocal" },
  { key: "server", label: "Serveur" },
];

function LoggingSection({
  value,
  channels,
  onSave,
  saving,
}: {
  value: LoggingConfig;
  channels: DiscordChannel[];
  onSave: (data: LoggingConfig) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<LoggingConfig>({ ...value });

  return (
    <Box>
      <MuiGrid container spacing={2}>
        {LOGGING_KEYS.map(({ key, label }) => (
          <MuiGrid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              {label}
            </Typography>
            {channels.length > 0 ? (
              <ChannelSelect
                label={label}
                value={form[key] ?? null}
                channels={channels}
                onChange={(v) => setForm((prev) => ({ ...prev, [key]: v }))}
              />
            ) : (
              <TextField
                size="small"
                fullWidth
                placeholder="ID canal"
                value={form[key] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value || null }))}
              />
            )}
          </MuiGrid>
        ))}
      </MuiGrid>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(form)}
        >
          Sauvegarder Logging
        </Button>
      </Box>
    </Box>
  );
}

// ── Section Panels (reaction-roles) ──────────────────────────────────────────

function PanelsSection({
  value,
  channels,
  roles,
  onSave,
  saving,
}: {
  value: PanelsConfig;
  channels: DiscordChannel[];
  roles: DiscordRole[];
  onSave: (data: PanelsConfig) => void;
  saving: boolean;
}) {
  const [panels, setPanels] = useState<PanelsConfig>([...(value ?? [])]);

  const addPanel = () =>
    setPanels((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        channelId: null,
        messageId: null,
        title: "",
        description: "",
        mode: "buttons",
        exclusive: false,
        options: [],
      },
    ]);

  const removePanel = (i: number) => setPanels((prev) => prev.filter((_, idx) => idx !== i));

  type PanelItem = PanelsConfig[number];

  const updatePanel = <K extends keyof PanelItem>(i: number, key: K, val: PanelItem[K]) => {
    const arr = [...panels];
    const cur = arr[i];
    if (!cur) return;
    arr[i] = { ...cur, [key]: val } as PanelItem;
    setPanels(arr);
  };

  const addOption = (pi: number) => {
    const arr = [...panels];
    const cur = arr[pi];
    if (!cur) return;
    arr[pi] = {
      ...cur,
      options: [...(cur.options ?? []), { roleId: "", label: "", emoji: "", description: "" }],
    } as PanelItem;
    setPanels(arr);
  };

  const removeOption = (pi: number, oi: number) => {
    const arr = [...panels];
    const cur = arr[pi];
    if (!cur) return;
    arr[pi] = { ...cur, options: cur.options.filter((_, idx) => idx !== oi) } as PanelItem;
    setPanels(arr);
  };

  const updateOption = (
    pi: number,
    oi: number,
    field: "roleId" | "label" | "emoji" | "description",
    val: string,
  ) => {
    const arr = [...panels];
    const cur = arr[pi];
    if (!cur) return;
    const opts = [...cur.options];
    const curOpt = opts[oi];
    if (!curOpt) return;
    opts[oi] = { ...curOpt, [field]: val } as PanelItem["options"][number];
    arr[pi] = { ...cur, options: opts } as PanelItem;
    setPanels(arr);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="subtitle2">
          {panels.length} panel{panels.length !== 1 ? "s" : ""}
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={addPanel} variant="outlined">
          Nouveau panel
        </Button>
      </Box>

      <Stack spacing={2}>
        {panels.map((panel, pi) => (
          <Box
            key={panel.id}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: 2,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="subtitle2">Panel {pi + 1}</Typography>
              <IconButton size="small" color="error" onClick={() => removePanel(pi)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            <MuiGrid container spacing={1} sx={{ mb: 1 }}>
              <MuiGrid size={{ xs: 12, sm: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Titre"
                  value={panel.title}
                  onChange={(e) => updatePanel(pi, "title", e.target.value)}
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 12, sm: 6 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 0.5 }}
                >
                  Canal
                </Typography>
                {channels.length > 0 ? (
                  <ChannelSelect
                    label="Canal"
                    value={panel.channelId ?? null}
                    channels={channels}
                    onChange={(v) => updatePanel(pi, "channelId", v)}
                  />
                ) : (
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="ID canal"
                    value={panel.channelId ?? ""}
                    onChange={(e) => updatePanel(pi, "channelId", e.target.value || null)}
                  />
                )}
              </MuiGrid>
              <MuiGrid size={{ xs: 12 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Description"
                  value={panel.description}
                  onChange={(e) => updatePanel(pi, "description", e.target.value)}
                />
              </MuiGrid>
              <MuiGrid size={{ xs: 6 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 0.5 }}
                >
                  Mode
                </Typography>
                <Select
                  size="small"
                  fullWidth
                  value={panel.mode}
                  onChange={(e) => updatePanel(pi, "mode", e.target.value as "buttons" | "select")}
                >
                  <MenuItem value="buttons">Boutons</MenuItem>
                  <MenuItem value="select">Menu deroulant</MenuItem>
                </Select>
              </MuiGrid>
              <MuiGrid size={{ xs: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!panel.exclusive}
                      onChange={(e) => updatePanel(pi, "exclusive", e.target.checked)}
                    />
                  }
                  label="Exclusif (1 role max)"
                />
              </MuiGrid>
            </MuiGrid>

            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Options
              </Typography>
              <Tooltip title="Ajouter une option">
                <IconButton size="small" onClick={() => addOption(pi)}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Stack spacing={1}>
              {panel.options.map((opt, oi) => (
                <Box key={oi} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <TextField
                    size="small"
                    label="Emoji"
                    value={opt.emoji ?? ""}
                    onChange={(e) => updateOption(pi, oi, "emoji", e.target.value)}
                    sx={{ width: 70 }}
                  />
                  <TextField
                    size="small"
                    label="Label"
                    value={opt.label}
                    onChange={(e) => updateOption(pi, oi, "label", e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  {roles.length > 0 ? (
                    <Box sx={{ flex: 1 }}>
                      <RoleSelect
                        label="Role"
                        value={opt.roleId || null}
                        roles={roles}
                        onChange={(v) => updateOption(pi, oi, "roleId", v ?? "")}
                      />
                    </Box>
                  ) : (
                    <TextField
                      size="small"
                      label="ID role"
                      value={opt.roleId}
                      onChange={(e) => updateOption(pi, oi, "roleId", e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  )}
                  <IconButton size="small" color="error" onClick={() => removeOption(pi, oi)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(panels)}
        >
          Sauvegarder Panels
        </Button>
      </Box>
    </Box>
  );
}

// ── Section Features ──────────────────────────────────────────────────────────

const KNOWN_FEATURES = [
  "duel",
  "gacha",
  "economy",
  "leveling",
  "moderation",
  "welcome",
  "logging",
  "reaction_roles",
  "tournaments",
  "rankings",
  "social",
  "music",
];

function FeaturesSection({
  value,
  channels,
  roles,
  onSave,
  saving,
}: {
  value: FeaturesConfig;
  channels: DiscordChannel[];
  roles: DiscordRole[];
  onSave: (data: FeaturesConfig) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FeaturesConfig>({ ...value });

  const allKeys = Array.from(new Set([...KNOWN_FEATURES, ...Object.keys(form)]));

  const toggle = (key: string, enabled: boolean) => {
    setForm((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), enabled },
    }));
  };

  const addAllowedRole = (key: string, roleId: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { enabled: true }),
        allowedRoles: [...(prev[key]?.allowedRoles ?? []), roleId],
      },
    }));
  };

  const removeAllowedRole = (key: string, i: number) => {
    setForm((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { enabled: true }),
        allowedRoles: (prev[key]?.allowedRoles ?? []).filter((_, idx) => idx !== i),
      },
    }));
  };

  const addAllowedChannel = (key: string, cid: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { enabled: true }),
        allowedChannels: [...(prev[key]?.allowedChannels ?? []), cid],
      },
    }));
  };

  const removeAllowedChannel = (key: string, i: number) => {
    setForm((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { enabled: true }),
        allowedChannels: (prev[key]?.allowedChannels ?? []).filter((_, idx) => idx !== i),
      },
    }));
  };

  return (
    <Box>
      <Stack spacing={1}>
        {allKeys.map((key) => {
          const ft = form[key] ?? { enabled: true };
          return (
            <Box
              key={key}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 1.5,
                opacity: ft.enabled ? 1 : 0.6,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Switch
                  size="small"
                  checked={!!ft.enabled}
                  onChange={(e) => toggle(key, e.target.checked)}
                />
                <Typography variant="subtitle2" sx={{ flex: 1, fontFamily: "monospace" }}>
                  {key}
                </Typography>
              </Box>
              {ft.enabled && (
                <Box sx={{ pl: 4 }}>
                  {/* Roles autorises */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Roles autorises :
                    </Typography>
                    {(ft.allowedRoles ?? []).map((rid, i) => {
                      const r = roles.find((r) => r.id === rid);
                      return (
                        <Chip
                          key={i}
                          label={r ? `@${r.name}` : rid}
                          size="small"
                          onDelete={() => removeAllowedRole(key, i)}
                          sx={{ height: 20, fontSize: "0.65rem" }}
                        />
                      );
                    })}
                    <Tooltip title="Ajouter un role autorise">
                      <IconButton
                        size="small"
                        onClick={() => {
                          const first = roles[0];
                          if (first) addAllowedRole(key, first.id);
                        }}
                      >
                        <AddIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {/* Canaux autorises */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Canaux autorises :
                    </Typography>
                    {(ft.allowedChannels ?? []).map((cid, i) => {
                      const ch = channels.find((c) => c.id === cid);
                      return (
                        <Chip
                          key={i}
                          label={ch ? `#${ch.name}` : cid}
                          size="small"
                          onDelete={() => removeAllowedChannel(key, i)}
                          sx={{ height: 20, fontSize: "0.65rem" }}
                        />
                      );
                    })}
                    <Tooltip title="Ajouter un canal autorise">
                      <IconButton
                        size="small"
                        onClick={() => {
                          const first = channels.find(
                            (c) => c.type === "GUILD_TEXT" || c.type === "0",
                          );
                          if (first) addAllowedChannel(key, first.id);
                        }}
                      >
                        <AddIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          disabled={saving}
          onClick={() => onSave(form)}
        >
          Sauvegarder Features
        </Button>
      </Box>
    </Box>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function BotConfigEditor({ initialConfig, channels, roles }: Props) {
  const { showToast } = useToast();
  const { saving, save } = useSaveSection(showToast);

  const SECTIONS = [
    {
      id: "channels",
      label: "Canaux",
      render: () => (
        <ChannelsSection
          value={initialConfig.channels}
          channels={channels}
          onSave={(d) => save("channels", d)}
          saving={saving === "channels"}
        />
      ),
    },
    {
      id: "roles",
      label: "Roles",
      render: () => (
        <RolesSection
          value={initialConfig.roles}
          roles={roles}
          onSave={(d) => save("roles", d)}
          saving={saving === "roles"}
        />
      ),
    },
    {
      id: "economy",
      label: "Economie",
      render: () => (
        <EconomySection
          value={initialConfig.economy}
          onSave={(d) => save("economy", d)}
          saving={saving === "economy"}
        />
      ),
    },
    {
      id: "moderation",
      label: "Moderation",
      render: () => (
        <ModerationSection
          value={initialConfig.moderation}
          onSave={(d) => save("moderation", d)}
          saving={saving === "moderation"}
        />
      ),
    },
    {
      id: "cooldowns",
      label: "Cooldowns",
      render: () => (
        <CooldownsSection
          value={initialConfig.cooldowns}
          onSave={(d) => save("cooldowns", d)}
          saving={saving === "cooldowns"}
        />
      ),
    },
    {
      id: "welcome",
      label: "Accueil",
      render: () => (
        <WelcomeSection
          value={initialConfig.welcome}
          channels={channels}
          roles={roles}
          onSave={(d) => save("welcome", d)}
          saving={saving === "welcome"}
        />
      ),
    },
    {
      id: "goodbye",
      label: "Depart",
      render: () => (
        <GoodbyeSection
          value={initialConfig.goodbye}
          channels={channels}
          onSave={(d) => save("goodbye", d)}
          saving={saving === "goodbye"}
        />
      ),
    },
    {
      id: "leveling",
      label: "Leveling",
      render: () => (
        <LevelingSection
          value={initialConfig.leveling}
          channels={channels}
          roles={roles}
          onSave={(d) => save("leveling", d)}
          saving={saving === "leveling"}
        />
      ),
    },
    {
      id: "panels",
      label: "Reaction-role panels",
      render: () => (
        <PanelsSection
          value={initialConfig.panels}
          channels={channels}
          roles={roles}
          onSave={(d) => save("panels", d)}
          saving={saving === "panels"}
        />
      ),
    },
    {
      id: "logging",
      label: "Logging",
      render: () => (
        <LoggingSection
          value={initialConfig.logging}
          channels={channels}
          onSave={(d) => save("logging", d)}
          saving={saving === "logging"}
        />
      ),
    },
    {
      id: "features",
      label: "Commandes / Features",
      render: () => (
        <FeaturesSection
          value={initialConfig.features}
          channels={channels}
          roles={roles}
          onSave={(d) => save("features", d)}
          saving={saving === "features"}
        />
      ),
    },
  ];

  return (
    <Box>
      {SECTIONS.map((section) => (
        <Accordion key={section.id} defaultExpanded={section.id === "channels"}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {section.label}
            </Typography>
            {saving === section.id && (
              <CircularProgress size={16} sx={{ ml: 2, alignSelf: "center" }} />
            )}
          </AccordionSummary>
          <AccordionDetails>{section.render()}</AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
