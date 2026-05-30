"use client";

import EditIcon from "@mui/icons-material/Edit";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import StarIcon from "@mui/icons-material/Star";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import { useState } from "react";
import type { TeamDetail, TeamMember, TeamRole } from "@rpbey/api-contract";
import { useConfirmDialog, useToast } from "@/components/ui";
import { TeamRosterTable } from "./TeamRosterTable";
import { canManage, ROLE_LABELS, teamsMutate } from "./shared";

const ASSIGNABLE_ROLES: TeamRole[] = ["MEMBER", "CO_CAPTAIN", "CAPTAIN"];

export function TeamMembersTab({
  team,
  role,
  currentUserId,
  onChanged,
}: {
  team: TeamDetail;
  role: TeamRole;
  currentUserId: string;
  onChanged: () => void;
}) {
  const { showSuccess, showError } = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<TeamRole>("MEMBER");
  const [editJersey, setEditJersey] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [saving, setSaving] = useState(false);

  const manage = canManage(role);
  const isCaptain = role === "CAPTAIN";

  const openEdit = (m: TeamMember) => {
    setEditing(m);
    setEditRole(m.role);
    setEditJersey(typeof m.jerseyNumber === "number" ? String(m.jerseyNumber) : "");
    setEditPosition(m.position ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const jerseyNum = editJersey.trim() === "" ? null : Number(editJersey);
      await teamsMutate(`/api/teams/${team.id}/members`, "PATCH", {
        userId: editing.userId,
        // Seul le capitaine peut changer les rôles ; sinon on n'envoie pas le champ.
        role: isCaptain ? editRole : undefined,
        jerseyNumber: jerseyNum != null && Number.isFinite(jerseyNum) ? jerseyNum : null,
        position: editPosition.trim() === "" ? null : editPosition.trim(),
      });
      showSuccess("Membre mis à jour.");
      setEditing(null);
      onChanged();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  };

  const promoteCaptain = async (m: TeamMember) => {
    const ok = await confirm({
      title: "Transférer le capitanat",
      message: `Nommer ${m.bladerName || m.name || "ce joueur"} capitaine ? Tu deviendras co-capitaine.`,
      confirmText: "Transférer",
      confirmColor: "warning",
    });
    if (!ok) return;
    try {
      await teamsMutate(`/api/teams/${team.id}/members`, "PATCH", {
        userId: m.userId,
        role: "CAPTAIN",
      });
      showSuccess("Capitanat transféré.");
      onChanged();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Transfert impossible.");
    }
  };

  const kick = async (m: TeamMember) => {
    const ok = await confirm({
      title: "Exclure le membre",
      message: `Exclure ${m.bladerName || m.name || "ce joueur"} de l'équipe ?`,
      confirmText: "Exclure",
      confirmColor: "error",
    });
    if (!ok) return;
    try {
      await teamsMutate(
        `/api/teams/${team.id}/members?userId=${encodeURIComponent(m.userId)}`,
        "DELETE",
      );
      showSuccess("Membre exclu.");
      onChanged();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Exclusion impossible.");
    }
  };

  return (
    <>
      <TeamRosterTable
        members={team.members}
        renderActions={
          manage
            ? (m) => {
                if (m.userId === currentUserId) return null;
                return (
                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                    <Tooltip title="Modifier (rôle, numéro, poste)">
                      <IconButton size="small" onClick={() => openEdit(m)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isCaptain && m.role !== "CAPTAIN" && (
                      <Tooltip title="Nommer capitaine">
                        <IconButton size="small" color="warning" onClick={() => promoteCaptain(m)}>
                          <StarIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {m.role !== "CAPTAIN" && (
                      <Tooltip title="Exclure">
                        <IconButton size="small" color="error" onClick={() => kick(m)}>
                          <PersonRemoveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                );
              }
            : undefined
        }
      />

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editing?.bladerName || editing?.name || "Membre"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {isCaptain && (
              <TextField
                select
                label="Rôle"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as TeamRole)}
                fullWidth
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <MenuItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label="Numéro de maillot"
              type="number"
              value={editJersey}
              onChange={(e) => setEditJersey(e.target.value)}
              slotProps={{ htmlInput: { min: 0, max: 999 } }}
              fullWidth
            />
            <TextField
              label="Poste / rôle de jeu"
              placeholder="Attaquant, défenseur…"
              value={editPosition}
              onChange={(e) => setEditPosition(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setEditing(null)} disabled={saving}>
            Annuler
          </Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}
    </>
  );
}
