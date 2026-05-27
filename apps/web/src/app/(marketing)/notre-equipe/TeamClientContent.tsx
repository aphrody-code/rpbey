'use client';

import { NavigateNext } from '@mui/icons-material';
import {
  alpha,
  Box,
  Breadcrumbs,
  Container,
  Typography,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { StaffCard } from '@/components/cards';
import { type StaffMember } from '@/lib/types';

interface TeamClientContentProps {
  groupedMembers: Record<string, StaffMember[]>;
  teamLabels: Record<string, string>;
  teamOrder: string[];
}

const TEAM_LOGOS: Record<string, string> = {
  ADMIN: '/logo-admin.webp',
  RH: '/logo-rh.webp',
  MODO: '/logo-modo.webp',
  STAFF: '/logo-staff.webp',
  ARBITRE: '/logo-staff.webp',
  DEV: '/logo-staff.webp',
  EVENT: '/logo-staff.webp',
  MEDIA: '/logo-staff.webp',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export function TeamClientContent({
  groupedMembers,
  teamLabels,
  teamOrder,
}: TeamClientContentProps) {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const secondaryColor = theme.palette.secondary.main;

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
          pt: { xs: 4, md: 14 },
          pb: { xs: 4, md: 12 },
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
            background: `radial-gradient(circle at 20% 30%, ${alpha(secondaryColor, 0.15)} 0%, transparent 50%), radial-gradient(circle at 80% 70%, ${alpha(primaryColor, 0.2)} 0%, transparent 50%)`,
            zIndex: 0,
          }}
        />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Breadcrumbs
            separator={<NavigateNext fontSize="small" />}
            sx={{ color: 'rgba(255,255,255,0.7)', mb: { xs: 2, md: 4 } }}
          >
            <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
              Accueil
            </Link>
            <Typography color="white">Notre Équipe</Typography>
          </Breadcrumbs>

          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '1.8rem', md: '4rem' },
              fontWeight: 900,
              mb: 2,
              textShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            Nos Équipes
          </Typography>
          <Typography
            variant="h5"
            sx={{
              opacity: 0.9,
              maxWidth: 700,
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Découvrez les talents et les passionnés qui donnent vie à l'univers
            de la République Populaire du Beyblade.
          </Typography>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        {teamOrder.map((teamId) => {
          const teamMembers = groupedMembers[teamId];
          if (!teamMembers || teamMembers.length === 0) return null;

          const logoPath = TEAM_LOGOS[teamId];

          return (
            <Box key={teamId} sx={{ mb: { xs: 8, md: 12 } }}>
              <Box
                sx={{ mb: 5, display: 'flex', alignItems: 'center', gap: 2 }}
              >
                {logoPath && (
                  <Image
                    src={logoPath}
                    alt={`${teamLabels[teamId]} Logo`}
                    width={48}
                    height={48}
                    style={{ width: 'auto', height: '3rem' }}
                  />
                )}
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: '800',
                    fontSize: { xs: '1.75rem', md: '2.5rem' },
                  }}
                >
                  {teamLabels[teamId] || teamId}
                </Typography>
                <Box
                  sx={{
                    flexGrow: 1,
                    height: '2px',
                    bgcolor: 'divider',
                    opacity: 0.5,
                  }}
                />
              </Box>
              <Grid
                container
                spacing={4}
                component={motion.div}
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
              >
                {teamMembers.map((member) => (
                  <Grid key={member.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StaffCard member={member} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          );
        })}

        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          sx={{
            textAlign: 'center',
            mt: 4,
            p: { xs: 4, md: 8 },
            bgcolor: 'background.paper',
            borderRadius: 8,
            border: '1px solid',
            borderColor: 'divider',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '4px',
              background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
            }}
          />
          <Typography
            variant="h4"
            gutterBottom
            sx={{
              fontWeight: 'bold',
            }}
          >
            Envie de nous rejoindre ?
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              mb: 4,
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            La RPB est une communauté gérée par des bénévoles. Si vous souhaitez
            apporter votre pierre à l'édifice, n'hésitez pas !
          </Typography>
          <Box
            component="a"
            href="https://discord.gg/rpb"
            target="_blank"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.5,
              px: 4,
              py: 2,
              borderRadius: 3,
              bgcolor: '#5865F2',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: '#4752C4',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 20px rgba(88, 101, 242, 0.3)',
              },
            }}
          >
            Rejoindre le Discord
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
