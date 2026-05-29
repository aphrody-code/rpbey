"use client";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DownloadIcon from "@mui/icons-material/Download";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { alpha, useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";
import { type Part } from "@/lib/types";

interface RandomComboData {
  blade: Part;
  ratchet: Part;
  bit: Part;
}

export function RandomCombo() {
  const [combo, setCombo] = useState<RandomComboData | null>(null);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const generateCombo = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parts/random");
      if (res.ok) {
        const data = await res.json();
        setCombo(data);
      }
    } catch (error) {
      console.error("Failed to generate combo", error);
    } finally {
      // Small artificial delay for the "roulette" effect
      setTimeout(() => setLoading(false), 500);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!combo) generateCombo();
  }, [combo, generateCombo]);

  return (
    <Card
      elevation={0}
      sx={{
        maxWidth: 600,
        mx: "auto",
        borderRadius: 5,
        border: "1px solid",
        borderColor: "divider",
        background: `linear-gradient(180deg, ${alpha(
          theme.palette.background.paper,
          0.9,
        )} 0%, ${alpha(theme.palette.background.default, 0.5)} 100%)`,
        backdropFilter: "blur(20px)",
        overflow: "visible",
      }}
    >
      <CardContent sx={{ textAlign: "center", p: { xs: 3, md: 5 } }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontWeight: "900",
            letterSpacing: "-0.02em",
          }}
        >
          Générateur de Combo
        </Typography>
        <Typography
          sx={{
            color: "text.secondary",
            mb: 5,
          }}
        >
          Laisse le hasard décider de ta prochaine configuration de combat !
        </Typography>

        <Box
          sx={{
            height: 240,
            mb: 5,
            borderRadius: 4,
            bgcolor: alpha(theme.palette.primary.main, 0.03),
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed",
            borderColor: loading ? "primary.main" : "divider",
            position: "relative",
            transition: "all 0.3s ease",
          }}
        >
          {loading ? (
            <Stack
              spacing={2}
              sx={{
                alignItems: "center",
              }}
            >
              <CircularProgress size={60} thickness={5} />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: "bold",
                  animation: "pulse 1.5s infinite",

                  "@keyframes pulse": {
                    "0%": { opacity: 0.5 },
                    "50%": { opacity: 1 },
                    "100%": { opacity: 0.5 },
                  },
                }}
              >
                Calcul du destin...
              </Typography>
            </Stack>
          ) : combo ? (
            <Typography
              variant="h1"
              sx={{
                opacity: 0.05,
                fontSize: "10rem",
                fontWeight: 900,
                userSelect: "none",
              }}
            >
              RPB
            </Typography>
          ) : (
            <CircularProgress />
          )}
        </Box>

        {combo && !loading && (
          <Stack spacing={3} sx={{ mb: 5 }}>
            <Box
              sx={{
                p: 3,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "primary.light",
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                transform: "scale(1.05)",
                boxShadow: `0 10px 30px ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <Typography
                variant="caption"
                color="primary"
                sx={{
                  fontWeight: "900",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                Blade
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: "800",
                }}
              >
                {combo.blade.name}
              </Typography>
            </Box>

            <Stack direction="row" spacing={2}>
              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontWeight: "bold",
                    letterSpacing: "0.1em",
                  }}
                >
                  RATCHET
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: "bold",
                  }}
                >
                  {combo.ratchet.name}
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontWeight: "bold",
                    letterSpacing: "0.1em",
                  }}
                >
                  BIT
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: "bold",
                  }}
                >
                  {combo.bit.name}
                </Typography>
              </Box>
            </Stack>

            <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
              {combo.blade.beyType && (
                <Chip
                  label={combo.blade.beyType}
                  color="primary"
                  sx={{ fontWeight: "bold", borderRadius: 2 }}
                />
              )}
            </Box>

            <Button
              component="a"
              href={`/api/combo/card?blade=${combo.blade.id}&ratchet=${combo.ratchet.id}&bit=${combo.bit.id}`}
              download={`${combo.blade.name}-${combo.ratchet.name}-${combo.bit.name}.png`}
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              sx={{
                alignSelf: "center",
                borderRadius: 3,
                fontWeight: 700,
                textTransform: "none",
              }}
            >
              Télécharger en image
            </Button>
          </Stack>
        )}

        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={!loading && <AutoAwesomeIcon />}
          onClick={generateCombo}
          disabled={loading}
          sx={{
            borderRadius: 4,
            py: 2,
            fontSize: "1.1rem",
            fontWeight: "900",
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.4)}`,
            "&:hover": {
              background: `linear-gradient(45deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
              transform: "translateY(-2px)",
            },
            transition: "all 0.2s ease",
          }}
        >
          {loading ? "Génération..." : "Lancer le tirage"}
        </Button>
      </CardContent>
    </Card>
  );
}
