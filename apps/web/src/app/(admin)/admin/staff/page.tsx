"use client";

import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Sync as SyncIcon,
} from "@mui/icons-material";
import {
  Avatar,
  alpha,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  IconButton,
  Grid as MuiGrid,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, StatusChip, useConfirmDialog, useToast } from "@/components/ui";
import { type StaffMember } from "@/lib/types";
import { RoleColors } from "@/lib/role-colors";
import {
  createStaffMember,
  deleteStaffMember,
  getStaffMembers,
  type StaffMemberInput,
  syncStaffFromDiscord,
  updateStaffMember,
} from "./actions";
import { StaffDialog } from "./StaffDialog";

const TEAM_LABELS: Record<string, string> = {
  ADMIN: "Administration",
  RH: "Ressources Humaines",
  MODO: "Modération",
  ARBITRE: "Arbitrage",
  STAFF: "Staff",
  DEV: "Développement",
  EVENT: "Événementiel",
  MEDIA: "Média / Design",
};

const TEAM_COLORS: Record<string, string> = {
  ADMIN: RoleColors.ADMIN.hex,
  RH: RoleColors.RH.hex,
  MODO: RoleColors.MODO.hex,
  STAFF: RoleColors.STAFF.hex,
  ARBITRE: "#f59e0b", // Amber
  DEV: "#10b981", // Emerald
  EVENT: "#f59e0b", // Amber
  MEDIA: "#8b5cf6", // Violet
};

export default function AdminStaffPage() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStaffMembers();
      setMembers(data);
    } catch {
      showToast("Erreur lors de la récupération des membres", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAdd = () => {
    setSelectedMember(null);
    setDialogOpen(true);
  };

  const handleSync = async () => {
    const confirmed = await confirm({
      title: "Synchroniser le staff",
      message:
        "Cette action va importer ou mettre à jour tous les membres Discord possédant les rôles Admin, RH, Modo et Staff. Continuer ?",
      confirmText: "Synchroniser",
    });

    if (confirmed) {
      setLoading(true);
      try {
        const results = await syncStaffFromDiscord();
        showToast(
          `Synchronisation terminée : ${results.added} ajoutés, ${results.updated} mis à jour.`,
          "success",
        );
        fetchMembers();
      } catch {
        showToast("Erreur lors de la synchronisation", "error");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEdit = (member: StaffMember) => {
    setSelectedMember(member);
    setDialogOpen(true);
  };

  const handleDelete = async (member: StaffMember) => {
    const confirmed = await confirm({
      title: "Supprimer le membre",
      message: `Êtes-vous sûr de vouloir supprimer ${member.name} du staff ?`,
      confirmText: "Supprimer",
      confirmColor: "error",
    });

    if (confirmed) {
      try {
        await deleteStaffMember(member.id);
        showToast("Membre supprimé avec succès", "success");
        fetchMembers();
      } catch {
        showToast("Erreur lors de la suppression", "error");
      }
    }
  };

  const handleSubmit = async (data: StaffMemberInput) => {
    setSubmitting(true);
    try {
      if (selectedMember) {
        await updateStaffMember(selectedMember.id, data);
        showToast("Membre mis à jour", "success");
      } else {
        await createStaffMember(data);
        showToast("Membre ajouté", "success");
      }
      setDialogOpen(false);
      fetchMembers();
    } catch {
      showToast("Erreur lors de l'enregistrement", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <PageHeader title="Gestion du Staff" description="Gerez les membres de l'equipe RPB">
        <ButtonGroup variant="contained" size="small">
          <Button
            startIcon={<SyncIcon />}
            onClick={handleSync}
            color="secondary"
            variant="outlined"
          >
            Sync Discord
          </Button>
          <Button startIcon={<AddIcon />} onClick={handleAdd}>
            Ajouter manuellement
          </Button>
        </ButtonGroup>
      </PageHeader>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={4}>
          {Object.keys(TEAM_LABELS).map((roleKey) => {
            const teamMembers = members.filter((m) => m.role === roleKey);
            if (teamMembers.length === 0) return null;

            return (
              <Box key={roleKey}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: "bold",
                    }}
                  >
                    {TEAM_LABELS[roleKey]}
                  </Typography>
                  <StatusChip
                    label={`${teamMembers.length} membre${teamMembers.length > 1 ? "s" : ""}`}
                    customColor={TEAM_COLORS[roleKey]}
                    size="small"
                  />
                  <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
                </Box>
                <MuiGrid container spacing={2}>
                  {teamMembers.map((member) => (
                    <MuiGrid key={member.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                      <Card
                        variant="outlined"
                        sx={{
                          height: "100%",
                          transition: "transform 0.2s",
                          "&:hover": {
                            transform: "translateY(-4px)",
                            boxShadow: 1,
                            borderColor: TEAM_COLORS[roleKey],
                          },
                        }}
                      >
                        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 2,
                            }}
                          >
                            <Avatar
                              src={member.imageUrl || undefined}
                              sx={{
                                width: 48,
                                height: 48,
                                border: `2px solid ${alpha(TEAM_COLORS[roleKey] || "#000", 0.1)}`,
                                bgcolor: alpha(TEAM_COLORS[roleKey] || "#000", 0.05),
                                color: TEAM_COLORS[roleKey],
                                fontWeight: "bold",
                              }}
                            >
                              {member.name.charAt(0)}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="subtitle1"
                                noWrap
                                sx={{
                                  fontWeight: "bold",
                                }}
                              >
                                {member.name}
                              </Typography>
                              <Typography
                                variant="body2"
                                noWrap
                                gutterBottom
                                sx={{
                                  color: "text.secondary",
                                }}
                              >
                                {member.role}
                              </Typography>
                              <Box
                                sx={{
                                  display: "flex",
                                  gap: 0.5,
                                  alignItems: "center",
                                }}
                              >
                                <StatusChip
                                  type="user"
                                  status={member.isActive ? "verified" : "offline"}
                                  showIcon={false}
                                  size="small"
                                />
                                {member.discordId && (
                                  <Tooltip title={`ID: ${member.discordId}`}>
                                    <Chip
                                      label="Discord"
                                      size="small"
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: "0.65rem" }}
                                    />
                                  </Tooltip>
                                )}
                              </Box>
                            </Box>
                            <Box sx={{ display: "flex", flexDirection: "column" }}>
                              <IconButton size="small" onClick={() => handleEdit(member)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDelete(member)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </MuiGrid>
                  ))}
                </MuiGrid>
              </Box>
            );
          })}
        </Stack>
      )}
      <StaffDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        initialData={selectedMember}
        loading={submitting}
      />
    </Box>
  );
}
