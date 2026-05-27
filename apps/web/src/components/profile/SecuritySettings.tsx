'use client';

import LockIcon from '@mui/icons-material/Lock';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { useToast } from '@/components/ui';
import { authClient } from '@/lib/auth-client';

export default function SecuritySettings() {
  const { data: session } = authClient.useSession();
  const theme = useTheme();
  const [openEnable, setOpenEnable] = useState(false);
  const [openDisable, setOpenDisable] = useState(false);
  const [step, setStep] = useState<'password' | 'qr' | 'backup'>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [totpURI, setTotpURI] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const { showToast } = useToast();

  // We assume 2FA is enabled if the user object has the flag (added via schema update)
  // or via checking a specific endpoint.
  // For now, we rely on session.user.twoFactorEnabled if available, or we might need to fetch it.
  // Since we just updated the schema, the session might not have it yet unless we re-login or Better Auth syncs it.
  // We'll trust the session property if it exists.
  const is2FAEnabled =
    (session?.user as unknown as { twoFactorEnabled: boolean })
      ?.twoFactorEnabled || false;

  const handleEnableStart = () => {
    setStep('password');
    setPassword('');
    setOpenEnable(true);
  };

  const handlePasswordSubmit = async () => {
    setLoading(true);
    try {
      const res = await authClient.twoFactor.enable({
        password,
      });
      if (res.error) {
        showToast(res.error.message || 'Mot de passe incorrect', 'error');
      } else {
        setTotpURI(res.data.totpURI);
        setBackupCodes(res.data.backupCodes);
        setStep('qr');
      }
    } catch {
      showToast('Une erreur est survenue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTOTP = async () => {
    setLoading(true);
    try {
      const res = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice: true,
      });
      if (res.error) {
        showToast(res.error.message || 'Code invalide', 'error');
      } else {
        showToast('A2F activée avec succès', 'success');
        setStep('backup');
      }
    } catch {
      showToast('Une erreur est survenue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      const res = await authClient.twoFactor.disable({
        password,
      });
      if (res.error) {
        showToast(res.error.message || 'Mot de passe incorrect', 'error');
      } else {
        showToast('A2F désactivée', 'success');
        setOpenDisable(false);
        setPassword('');
        // Optionally refresh session
        window.location.reload();
      }
    } catch {
      showToast('Une erreur est survenue', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 5,
        border: '1px solid',
        borderColor: 'divider',
        mt: 4,
        background: `linear-gradient(180deg, ${alpha(
          theme.palette.background.paper,
          0.9,
        )} 0%, ${alpha(theme.palette.background.default, 0.5)} 100%)`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <LockIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography
            variant="h5"
            sx={{
              fontWeight: '800',
            }}
          >
            Sécurité
          </Typography>
        </Box>

        <Stack spacing={3} sx={{ mt: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
              p: 2,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.background.default, 0.5),
            }}
          >
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                Authentification à deux facteurs (A2F)
                {is2FAEnabled ? (
                  <Chip
                    label="Activé"
                    color="success"
                    size="small"
                    variant="filled"
                    sx={{ fontWeight: 'bold', height: 20 }}
                  />
                ) : (
                  <Chip
                    label="Désactivé"
                    color="default"
                    size="small"
                    variant="outlined"
                    sx={{ height: 20 }}
                  />
                )}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                Protégez votre compte avec une couche de sécurité
                supplémentaire.
              </Typography>
            </Box>

            {is2FAEnabled ? (
              <Button
                variant="outlined"
                color="error"
                onClick={() => setOpenDisable(true)}
                sx={{ borderRadius: 2 }}
              >
                Désactiver l'A2F
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleEnableStart}
                sx={{ borderRadius: 2, boxShadow: 'none' }}
              >
                Activer l'A2F
              </Button>
            )}
          </Box>
        </Stack>
      </CardContent>
      {/* Enable 2FA Dialog */}
      <Dialog
        open={openEnable}
        onClose={() => setOpenEnable(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: { borderRadius: 4, p: 1 },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Configuration de l'A2F
        </DialogTitle>
        <DialogContent>
          {step === 'password' && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography
                sx={{
                  color: 'text.secondary',
                }}
              >
                Pour activer l'authentification à deux facteurs, veuillez
                confirmer votre mot de passe.
              </Typography>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Si vous vous connectez uniquement via Discord, vous devez
                d'abord définir un mot de passe pour utiliser cette
                fonctionnalité.
              </Alert>
              <TextField
                type="password"
                label="Mot de passe"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mt: 2 }}
              />
            </Stack>
          )}

          {step === 'qr' && (
            <Stack spacing={3} sx={{ pt: 1, alignItems: 'center' }}>
              <Typography
                align="center"
                sx={{
                  color: 'text.secondary',
                }}
              >
                Scannez ce QR Code avec votre application d'authentification
                (Google Authenticator, Authy, etc.).
              </Typography>

              <Box
                component="img"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  totpURI,
                )}`}
                alt="QR Code A2F"
                sx={{
                  width: 200,
                  height: 200,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 4,
                  p: 1,
                  bgcolor: 'white',
                }}
              />

              <TextField
                label="Code de vérification (6 chiffres)"
                fullWidth
                value={code}
                onChange={(e) => setCode(e.target.value)}
                slotProps={{
                  htmlInput: {
                    maxLength: 6,
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    style: {
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      letterSpacing: '0.5em',
                    },
                  },
                }}
              />
            </Stack>
          )}

          {step === 'backup' && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                IMPORTANT : Sauvegardez ces codes de secours en lieu sûr. Ils
                vous permettront d'accéder à votre compte si vous perdez votre
                appareil d'authentification.
              </Alert>
              <Box
                sx={{
                  bgcolor: 'action.hover',
                  p: 3,
                  borderRadius: 3,
                  fontFamily: 'monospace',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Grid container spacing={2}>
                  {backupCodes.map((code) => (
                    <Grid
                      size={6}
                      key={code}
                      sx={{ display: 'flex', justifyContent: 'center' }}
                    >
                      <Box component="span" sx={{ fontWeight: 'bold' }}>
                        {code}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setOpenEnable(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Annuler
          </Button>
          {step === 'password' && (
            <Button
              onClick={handlePasswordSubmit}
              variant="contained"
              disabled={loading || !password}
              sx={{ borderRadius: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Continuer'}
            </Button>
          )}
          {step === 'qr' && (
            <Button
              onClick={handleVerifyTOTP}
              variant="contained"
              disabled={loading || code.length < 6}
              sx={{ borderRadius: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Vérifier'}
            </Button>
          )}
          {step === 'backup' && (
            <Button
              onClick={() => {
                setOpenEnable(false);
                window.location.reload();
              }}
              variant="contained"
              sx={{ borderRadius: 2 }}
            >
              J'ai sauvegardé mes codes
            </Button>
          )}
        </DialogActions>
      </Dialog>
      {/* Disable 2FA Dialog */}
      <Dialog
        open={openDisable}
        onClose={() => setOpenDisable(false)}
        slotProps={{
          paper: { sx: { borderRadius: 4, p: 1 } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Désactiver l'A2F</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography
              sx={{
                color: 'text.secondary',
              }}
            >
              Êtes-vous sûr de vouloir désactiver l'authentification à deux
              facteurs ? Votre compte sera moins sécurisé.
            </Typography>
            <TextField
              type="password"
              label="Confirmez votre mot de passe"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mt: 2 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setOpenDisable(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleDisable}
            color="error"
            variant="contained"
            disabled={loading || !password}
            sx={{ borderRadius: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Désactiver'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
