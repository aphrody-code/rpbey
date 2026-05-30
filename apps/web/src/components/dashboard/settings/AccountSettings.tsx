"use client";

import BadgeIcon from "@mui/icons-material/Badge";
import DevicesIcon from "@mui/icons-material/Devices";
import KeyIcon from "@mui/icons-material/Key";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { SecuritySettings } from "@/components/profile";
import { useToast } from "@/components/ui";
import { authClient, signOut, useSession } from "@/lib/auth-client";

interface LinkedAccount {
  provider?: string;
  providerId?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  credential: "E-mail / mot de passe",
  discord: "Discord",
  google: "Google",
  challonge: "Challonge",
};

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 5,
        border: "1px solid",
        borderColor: "divider",
        background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(
          theme.palette.background.default,
          0.5,
        )} 100%)`,
        backdropFilter: "blur(20px)",
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: subtitle ? 0.5 : 3 }}>
          {icon}
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
        </Box>
        {subtitle && (
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            {subtitle}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Paramètres du COMPTE (≠ profil blader). Surface dédiée à l'identité d'authentification :
 * e-mail, mot de passe, A2F, fournisseurs liés et sessions. L'identité publique (nom de
 * Blader, avatar, favoris, réseaux) se gère dans `/dashboard/profile/edit` — aucune
 * duplication. Aucun flux dépendant de l'e-mail (reset / changement vérifié) n'est exposé
 * car aucun transport e-mail n'est configuré côté serveur.
 */
export function AccountSettings() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authClient
      .listAccounts()
      .then((res) => {
        if (!cancelled) setAccounts((res.data as LinkedAccount[] | undefined) ?? []);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const providerIds = (accounts ?? []).map((a) => a.providerId ?? a.provider ?? "");
  const hasPassword = providerIds.includes("credential");

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      showToast("Le nouveau mot de passe doit faire au moins 8 caractères.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Les deux mots de passe ne correspondent pas.", "error");
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (res.error) {
        showToast(res.error.message || "Mot de passe actuel incorrect.", "error");
      } else {
        showToast("Mot de passe mis à jour. Les autres sessions ont été déconnectées.", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      showToast("Erreur lors du changement de mot de passe.", "error");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeOthers = async () => {
    setIsRevoking(true);
    try {
      const res = await authClient.revokeOtherSessions();
      if (res.error) {
        showToast(res.error.message || "Échec de la déconnexion des appareils.", "error");
      } else {
        showToast("Toutes les autres sessions ont été déconnectées.", "success");
      }
    } catch {
      showToast("Erreur lors de la révocation des sessions.", "error");
    } finally {
      setIsRevoking(false);
    }
  };

  if (isPending) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const user = session?.user as
    | {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        username?: string | null;
      }
    | undefined;

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <Box sx={{ mb: 5 }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
          Paramètres du compte
        </Typography>
        <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: "normal" }}>
          Identifiants, sécurité et appareils connectés. Ton identité publique de Blader se modifie
          dans l'édition du profil.
        </Typography>
      </Box>

      <Stack spacing={4}>
        {/* ── Identité du compte ─────────────────────────────── */}
        <SectionCard icon={<PersonIcon color="primary" sx={{ fontSize: 28 }} />} title="Identité">
          <Stack spacing={2.5}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Avatar src={user?.image || undefined} sx={{ width: 64, height: 64 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
                  {user?.name ?? "—"}
                </Typography>
                <Typography variant="body2" noWrap sx={{ color: "text.secondary" }}>
                  {user?.email ?? "—"}
                </Typography>
              </Box>
            </Box>

            <Divider />

            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                Fournisseurs liés
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
                {accounts === null ? (
                  <CircularProgress size={18} />
                ) : providerIds.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Aucun
                  </Typography>
                ) : (
                  providerIds.map((p, i) => (
                    <Chip
                      key={`${p}-${i}`}
                      label={PROVIDER_LABELS[p] ?? p}
                      size="small"
                      variant="outlined"
                    />
                  ))
                )}
              </Stack>
            </Box>

            <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {user?.username && (
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    Nom d'utilisateur
                  </Typography>
                  <Typography variant="body2">@{user.username}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  Identifiant
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                  {user?.id ?? "—"}
                </Typography>
              </Box>
            </Box>

            <Box>
              <Button
                component={Link}
                href="/dashboard/profile/edit"
                variant="outlined"
                startIcon={<BadgeIcon />}
                sx={{ borderRadius: 2 }}
              >
                Modifier mon profil de Blader
              </Button>
            </Box>
          </Stack>
        </SectionCard>

        {/* ── Mot de passe ───────────────────────────────────── */}
        <SectionCard
          icon={<KeyIcon color="primary" sx={{ fontSize: 28 }} />}
          title="Mot de passe"
          subtitle={
            hasPassword
              ? "Modifie ton mot de passe. Les autres appareils seront déconnectés par sécurité."
              : "Tu te connectes via un fournisseur externe (Discord / Google). Aucun mot de passe n'est défini sur ce compte."
          }
        >
          {hasPassword ? (
            <Stack spacing={2.5} sx={{ maxWidth: 420 }}>
              <TextField
                type="password"
                label="Mot de passe actuel"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                fullWidth
                autoComplete="current-password"
              />
              <TextField
                type="password"
                label="Nouveau mot de passe"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                autoComplete="new-password"
                helperText="8 caractères minimum."
              />
              <TextField
                type="password"
                label="Confirmer le nouveau mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                autoComplete="new-password"
              />
              <Box>
                <Button
                  variant="contained"
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !currentPassword || !newPassword}
                  sx={{ borderRadius: 2, fontWeight: "bold" }}
                >
                  {isChangingPassword ? "Mise à jour..." : "Changer le mot de passe"}
                </Button>
              </Box>
            </Stack>
          ) : null}
        </SectionCard>

        {/* ── Authentification à deux facteurs ───────────────── */}
        <SecuritySettings />

        {/* ── Sessions & déconnexion ─────────────────────────── */}
        <SectionCard
          icon={<DevicesIcon color="primary" sx={{ fontSize: 28 }} />}
          title="Appareils & sessions"
          subtitle="Déconnecte les autres appareils si tu penses que ton compte est utilisé ailleurs."
        >
          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={isRevoking ? <CircularProgress size={18} /> : <DevicesIcon />}
              onClick={handleRevokeOthers}
              disabled={isRevoking}
              sx={{ borderRadius: 2 }}
            >
              Déconnecter les autres appareils
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              sx={{ borderRadius: 2 }}
            >
              Me déconnecter
            </Button>
          </Stack>
        </SectionCard>
      </Stack>
    </Box>
  );
}
