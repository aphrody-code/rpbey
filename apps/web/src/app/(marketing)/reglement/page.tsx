import {
  Campaign,
  Chat,
  EmojiEmotions,
  Gavel,
  Group,
  Handshake,
  Shield,
  Warning,
} from '@mui/icons-material';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DiscordIcon } from '@/components/ui/Icons';
import { createPageMetadata } from '@/lib/seo-utils';

export const metadata = createPageMetadata({
  title: 'Règlement de la RPB',
  description:
    'Le règlement officiel de la communauté République Populaire du Beyblade.',
  path: '/reglement',
});

const RULES = [
  {
    icon: <Handshake />,
    title: 'Le respect avant tout',
    description:
      'Les insultes, propos haineux, discriminatoires ou agressifs sont strictement interdits. Traitez les autres membres avec courtoisie et respect.',
    color: 'var(--rpb-primary)',
  },
  {
    icon: <Shield />,
    title: 'Contenu approprié',
    description:
      'Pas de contenu NSFW, choquant ou inapproprié. Le serveur est accessible à tous, y compris aux plus jeunes.',
    color: 'var(--rpb-secondary)',
  },
  {
    icon: <Warning />,
    title: 'Pas de spam',
    description:
      "Évitez de flood les salons ou d'envoyer des messages répétitifs. Cela inclut les pubs non autorisées, les liens ou les bots non approuvés.",
    color: 'var(--rpb-primary)',
  },
  {
    icon: <Chat />,
    title: 'Suivez les catégories',
    description:
      'Utilisez les salons correctement (par exemple, ne postez pas de discussions hors-sujet dans les salons dédiés).',
    color: 'var(--rpb-secondary)',
  },
  {
    icon: <Campaign />,
    title: 'Publicité réglementée',
    description:
      "La publicité pour d'autres serveurs ou contenus est autorisée uniquement dans les salons dédiés et avec l'accord des modérateurs.",
    color: 'var(--rpb-primary)',
  },
  {
    icon: <Gavel />,
    title: 'Pas de comportements toxiques',
    description:
      'Les provocations, conflits inutiles ou comportements toxiques (trash-talk excessif par exemple) ne seront pas tolérés.',
    color: 'var(--rpb-secondary)',
  },
  {
    icon: <EmojiEmotions />,
    title: 'Amusez-vous !',
    description:
      'Ce serveur est un espace convivial pour les fans de Beyblade. Partagez vos passions, stratégies et créations, et profitez de l’ambiance communautaire !',
    color: 'var(--rpb-primary)',
  },
  {
    icon: <Group />,
    title: 'Respect mutuel exigé',
    description:
      'Toute forme de harcèlement visant un membre ou un staff de la RPB sera sévèrement punie. Si vous n’êtes pas d’accord avec une décision prise, cela doit se faire entendre dans le respect et la courtoisie.',
    color: 'var(--rpb-secondary)',
  },
];

export default function RulesPage() {
  return (
    <>
      {/* Header Section */}
      <Box
        sx={{
          background:
            'linear-gradient(135deg, var(--rpb-primary) 0%, #991b1b 50%, #7f1d1d 100%)',
          color: 'white',
          py: { xs: 4, md: 10 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 'bold',
              textAlign: 'center',
              mb: 2,
              fontSize: { xs: '1.8rem', md: '3.75rem' },
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Règlement de la RPB
          </Typography>
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              opacity: 0.9,
              maxWidth: 700,
              mx: 'auto',
              fontStyle: 'italic',
            }}
          >
            "Amusez-vous et prenez du plaisir au sein de la RPB, le but est
            avant tout de se réunir et de s’entraider autour de la passion
            commune qui nous anime."
          </Typography>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            mb: 6,
            bgcolor: 'background.paper',
          }}
        >
          <Grid container spacing={4}>
            {RULES.map((rule, index) => (
              <Grid key={rule.title} size={{ xs: 12, md: 6 }}>
                <Stack direction="row" spacing={3}>
                  <Avatar
                    sx={{
                      bgcolor: rule.color,
                      color: 'white',
                      width: 56,
                      height: 56,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  >
                    {rule.icon}
                  </Avatar>
                  <Box>
                    <Typography
                      variant="h6"
                      gutterBottom
                      sx={{
                        fontWeight: 'bold',
                      }}
                    >
                      {index + 1}. {rule.title}
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        color: 'text.secondary',
                        fontStyle: 'italic',
                        lineHeight: 1.6,
                      }}
                    >
                      {rule.description}
                    </Typography>
                  </Box>
                </Stack>
                {index < RULES.length - 2 && (
                  <Divider
                    sx={{ mt: 4, display: { xs: 'block', md: 'none' } }}
                  />
                )}
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Contact & Mediation Section */}
        <Card
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'primary.main',
            bgcolor: 'rgba(var(--rpb-primary-rgb), 0.05)',
            mb: 6,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={4}
            sx={{
              alignItems: 'center',
            }}
          >
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Typography
                variant="h5"
                gutterBottom
                sx={{
                  fontWeight: 'bold',
                  color: 'primary.main',
                }}
              >
                Besoin d'aide ou de médiation ?
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  marginBottom: '16px',
                }}
              >
                En cas de litige ou de requête spécifique, veuillez vous diriger
                vers les membres du Staff (Fondateurs, Administrateurs ou
                Modérateurs) sur notre serveur Discord.
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontStyle: 'italic',
                }}
              >
                Toute forme de harcèlement visant un membre ou un staff de la
                RPB sera sévèrement punie.
              </Typography>
            </Box>
            <Button
              component="a"
              href="https://discord.gg/rpb"
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              size="large"
              startIcon={<DiscordIcon />}
              sx={{
                minWidth: 240,
                py: 2,
                borderRadius: 2,
                bgcolor: '#5865F2',
                '&:hover': { bgcolor: '#4752C4' },
              }}
            >
              Ouvrir un Ticket Discord
            </Button>
          </Stack>
        </Card>

        {/* Closing Message */}
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 800,
              mx: 'auto',
              fontStyle: 'italic',
            }}
          >
            Restez courtois et respectueux les uns envers les autres même si vos
            opinions divergent. Profitons ensemble de cette passion pour
            Beyblade X !
          </Typography>
        </Box>
      </Container>
    </>
  );
}
