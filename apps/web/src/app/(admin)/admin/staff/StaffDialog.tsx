"use client";

import { FormControlLabel, Grid, MenuItem, Switch, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { FormDialog } from "@/components/ui";
import { type StaffMember } from "@/lib/types";
import { type StaffMemberInput } from "./actions";

const TEAMS = [
  { value: "admin", label: "Administration" },
  { value: "rh", label: "Ressources Humaines" },
  { value: "modo", label: "Modération" },
  { value: "arbitre", label: "Arbitrage" },
  { value: "staff", label: "Staff" },
  { value: "dev", label: "Développement" },
  { value: "event", label: "Événementiel" },
  { value: "media", label: "Média / Design" },
];

interface StaffDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: StaffMemberInput) => Promise<void>;
  initialData?: StaffMember | null;
  loading?: boolean;
}

export function StaffDialog({ open, onClose, onSubmit, initialData, loading }: StaffDialogProps) {
  const [formData, setFormData] = useState<StaffMemberInput>({
    name: "",
    role: "",
    teamId: "modo",
    imageUrl: "",
    discordId: "",
    displayIndex: 0,
    isActive: true,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        role: initialData.role || "",
        teamId: initialData.teamId || "modo",
        imageUrl: initialData.imageUrl || "",
        discordId: initialData.discordId || "",
        displayIndex: initialData.displayIndex || 0,
        isActive: initialData.isActive ?? true,
      });
    } else {
      setFormData({
        name: "",
        role: "",
        teamId: "modo",
        imageUrl: "",
        discordId: "",
        displayIndex: 0,
        isActive: true,
      });
    }
  }, [initialData]);

  const handleSubmit = async () => {
    await onSubmit(formData);
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={initialData ? "Modifier le membre" : "Ajouter un membre"}
      onSubmit={handleSubmit}
      loading={loading}
      maxWidth="md"
    >
      <Grid container spacing={3} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Nom / Pseudo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Rôle"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            required
            placeholder="ex: Modérateur, Développeur..."
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            select
            label="Équipe"
            value={formData.teamId}
            onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
            required
          >
            {TEAMS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            type="number"
            label="Ordre d'affichage"
            value={formData.displayIndex}
            onChange={(e) =>
              setFormData({
                ...formData,
                displayIndex: parseInt(e.target.value, 10) || 0,
              })
            }
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth
            label="URL de l'image"
            value={formData.imageUrl}
            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
            placeholder="https://..."
            helperText="L'avatar Discord sera utilisé si synchronisé"
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth
            label="ID Discord"
            value={formData.discordId}
            onChange={(e) => setFormData({ ...formData, discordId: e.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
            }
            label="Actif (Affiché sur le site)"
          />
        </Grid>
      </Grid>
    </FormDialog>
  );
}
