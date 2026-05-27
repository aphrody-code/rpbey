'use client';

import {
  Box,
  Chip,
  Container,
  InputAdornment,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { type Part } from '@/lib/types';
import { AssetGallery } from './AssetGallery';
import { CombatTab } from './CombatTab';
import { GameData } from './GameData';
import { MeshGallery } from './MeshViewer';
import { PartGrid } from './PartGrid';
import { ProductCatalog } from './ProductCatalog';
import { VfxGallery } from './VfxGallery';

/* ─── Types ─── */

interface ProductEntry {
  code: string;
  name: string;
  date: string;
}

interface AppClientProps {
  blades: Part[];
  ratchets: Part[];
  bits: Part[];
  lockChips: Part[];
  assistBlades: Part[];
  products: ProductEntry[];
}

/* ─── Takara-style Tab Config ─── */

const APP_TABS = [
  {
    label: 'Accueil',
    icon: '/bbx-icons/app_icon_round.webp',
    color: '#ce0c07',
  },
  {
    label: 'Collection',
    icon: '/bbx-icons/home-icon-2beylocker-on.webp',
    color: '#e68002',
  },
  {
    label: 'Combats',
    icon: '/bbx-icons/btn-battle.webp',
    color: '#ef4444',
  },
  {
    label: 'Customize',
    icon: '/bbx-icons/icon-scan.webp',
    color: '#a855f7',
  },
  {
    label: 'Assets',
    icon: '/bbx-icons/orangeStar.webp',
    color: '#f7d301',
  },
  {
    label: 'Données',
    icon: '/bbx-icons/home-icon-2beylocker-on.webp',
    color: '#22c55e',
  },
];

const COLLECTION_FILTERS = [
  { label: 'Tous', value: 'ALL' },
  { label: 'BX', value: 'BX', color: '#ce0c07' },
  { label: 'UX', value: 'UX', color: '#3b82f6' },
  { label: 'CX', value: 'CX', color: '#a855f7' },
];

const TYPE_FILTERS = [
  { label: 'Tous', value: 'ALL' },
  { label: 'Attaque', value: 'ATTACK', color: '#ef4444' },
  { label: 'Défense', value: 'DEFENSE', color: '#3b82f6' },
  { label: 'Endurance', value: 'STAMINA', color: '#22c55e' },
  { label: 'Équilibre', value: 'BALANCE', color: '#a855f7' },
];

const ASSET_SUBTABS = ['Textures', 'Modèles 3D', 'VFX', 'Produits'] as const;

/* ─── Feature Card for Home Tab ─── */

function FeatureCard({
  icon,
  title,
  description,
  color,
  badge,
}: {
  icon: string;
  title: string;
  description: string;
  color: string;
  badge?: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        background: '#1d1b1b',
        border: '1px solid',
        borderColor: alpha('#fff', 0.04),
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: alpha(color, 0.2),
          transform: 'translateY(-2px)',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.3)})`,
        },
      }}
    >
      {badge && (
        <Chip
          label={badge}
          size="small"
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            fontWeight: 800,
            fontSize: '0.6rem',
            bgcolor: alpha(color, 0.15),
            color,
            height: 20,
          }}
        />
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: alpha(color, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            src={icon}
            alt={title}
            sx={{
              width: 24,
              height: 24,
              objectFit: 'contain',
              filter: `drop-shadow(0 0 4px ${color})`,
            }}
          />
        </Box>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 900,
            color: '#f5f0f0',
          }}
        >
          {title}
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: '#a89999', lineHeight: 1.6 }}>
        {description}
      </Typography>
    </Paper>
  );
}

/* ─── Stat Counter ─── */

function StatCounter({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 900,
          color,
          textShadow: `0 0 20px ${alpha(color, 0.3)}`,
          lineHeight: 1,
        }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: '#a89999',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

/* ─── Section Header ─── */

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 900,
          color: '#f5f0f0',
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" sx={{ color: '#a89999' }}>
          {subtitle}
        </Typography>
      )}
      <Box
        sx={{
          mt: 1,
          height: 3,
          borderRadius: 2,
          background:
            'linear-gradient(90deg, #ce0c07, #e68002, #f7d301, transparent)',
          maxWidth: 200,
        }}
      />
    </Box>
  );
}

/* ─── Main Component ─── */

export function AppClient({
  blades,
  ratchets,
  bits,
  lockChips,
  assistBlades,
  products,
}: AppClientProps) {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [assetSubTab, setAssetSubTab] = useState(0);
  const [combatMode, setCombatMode] = useState<'arena' | 'calc' | 'rules'>(
    'arena',
  );

  const allParts = useMemo(
    () => [...blades, ...ratchets, ...bits, ...lockChips, ...assistBlades],
    [blades, ratchets, bits, lockChips, assistBlades],
  );

  const filterParts = (parts: Part[]) => {
    return parts.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.externalId.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'ALL' || p.beyType === typeFilter;
      const matchSystem = systemFilter === 'ALL' || p.system === systemFilter;
      return matchSearch && matchType && matchSystem;
    });
  };

  const activeColor = APP_TABS[tab]?.color ?? '#ce0c07';

  // Stats for home
  const bxCount = allParts.filter((p) => p.system === 'BX').length;
  const uxCount = allParts.filter((p) => p.system === 'UX').length;
  const cxCount = allParts.filter((p) => p.system === 'CX').length;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#141111',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'fixed',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(255,255,255,0.008) 15px, rgba(255,255,255,0.008) 16px)',
          zIndex: 0,
          pointerEvents: 'none',
        },
      }}
    >
      <Container
        maxWidth="xl"
        sx={{ py: { xs: 1, md: 2 }, position: 'relative', zIndex: 1 }}
      >
        {/* ── Header (Takara-style) ── */}
        <Box
          sx={{
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 1,
          }}
        >
          <Box
            component="img"
            src="/bbx-icons/app_icon_round.webp"
            alt="Beyblade X"
            sx={{
              width: 48,
              height: 48,
              filter: 'drop-shadow(0 0 8px rgba(206,12,7,0.4))',
            }}
          />
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 900,
                lineHeight: 1.2,
                background: 'linear-gradient(90deg, #ce0c07, #e68002, #f7d301)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              BEYBLADE X
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: '#a89999',
                letterSpacing: 0.5,
              }}
            >
              TAKARA TOMY · {allParts.length} pièces · {products.length}{' '}
              produits
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            label="v1.7.1"
            size="small"
            sx={{
              fontWeight: 800,
              fontSize: '0.65rem',
              bgcolor: alpha('#ce0c07', 0.1),
              color: '#ce0c07',
              border: '1px solid',
              borderColor: alpha('#ce0c07', 0.2),
            }}
          />
        </Box>

        {/* ── Tab Bar (Takara bottom-nav style) ── */}
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: '#1d1b1b',
            border: '1px solid',
            borderColor: alpha('#fff', 0.04),
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 64,
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: 0,
                background: `linear-gradient(90deg, ${activeColor}, ${alpha(activeColor, 0.4)})`,
                boxShadow: `0 0 12px ${activeColor}`,
              },
              '& .MuiTab-root': {
                minHeight: 64,
                textTransform: 'none',
                fontWeight: 800,
                fontSize: { xs: '0.7rem', sm: '0.8rem' },
                color: '#a89999',
                transition: 'all 0.2s ease',
                '&.Mui-selected': { color: '#f5f0f0' },
                '&:hover': {
                  color: '#f5f0f0',
                  bgcolor: alpha('#fff', 0.02),
                },
              },
            }}
          >
            {APP_TABS.map((t, i) => (
              <Tab
                key={t.label}
                label={
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        filter:
                          tab === i
                            ? `drop-shadow(0 0 6px ${t.color})`
                            : 'grayscale(0.8) opacity(0.4)',
                        transition: 'filter 0.2s ease',
                      }}
                    >
                      <Box
                        component="img"
                        src={t.icon}
                        alt={t.label}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    </Box>
                    <span>{t.label}</span>
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Paper>

        {/* ── Tab Content ── */}
        <Box sx={{ minHeight: 400 }}>
          {/* ═══ HOME ═══ */}
          {tab === 0 && (
            <Box>
              {/* Hero Banner */}
              <Paper
                elevation={0}
                sx={{
                  mb: 4,
                  p: { xs: 3, md: 5 },
                  borderRadius: 4,
                  bgcolor: '#1d1b1b',
                  border: '1px solid',
                  borderColor: alpha('#fff', 0.04),
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background:
                      'radial-gradient(ellipse at 30% 50%, rgba(206,12,7,0.08) 0%, transparent 60%)',
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background:
                      'linear-gradient(90deg, #ce0c07, #e68002, #f7d301)',
                  },
                }}
              >
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      color: '#ce0c07',
                      fontWeight: 900,
                      letterSpacing: 3,
                    }}
                  >
                    TAKARA TOMY × RPB
                  </Typography>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 900,
                      color: '#f5f0f0',
                      mb: 1,
                      fontSize: { xs: '1.8rem', md: '2.5rem' },
                    }}
                  >
                    Beyblade X Database
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: '#a89999',
                      maxWidth: 600,
                      mb: 3,
                      lineHeight: 1.7,
                    }}
                  >
                    Base de données complète extraite de l&apos;application
                    officielle Takara Tomy v1.7.1 — pièces, stats, modèles 3D,
                    textures, effets visuels et catalogue produits.
                  </Typography>

                  {/* Stats Row */}
                  <Box
                    sx={{
                      display: 'flex',
                      gap: { xs: 3, md: 5 },
                      flexWrap: 'wrap',
                    }}
                  >
                    <StatCounter
                      label="Pièces"
                      value={allParts.length}
                      color="#f7d301"
                    />
                    <StatCounter label="BX" value={bxCount} color="#ce0c07" />
                    <StatCounter label="UX" value={uxCount} color="#3b82f6" />
                    <StatCounter label="CX" value={cxCount} color="#a855f7" />
                    <StatCounter
                      label="Produits"
                      value={products.length}
                      color="#e68002"
                    />
                  </Box>
                </Box>
              </Paper>

              {/* Feature Grid (Takara exclusive features) */}
              <SectionHeader
                title="Fonctionnalités Takara Tomy"
                subtitle="Systèmes exclusifs de la version japonaise"
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: '1fr 1fr',
                    md: '1fr 1fr 1fr',
                  },
                  gap: 2,
                  mb: 4,
                }}
              >
                <FeatureCard
                  icon="/bbx-icons/icon-scan.webp"
                  title="BeyLink"
                  description="Liaison physique-numérique via BLE/NFC — les stats réelles de ta toupie importées dans l'app."
                  color="#ce0c07"
                  badge="EXCLUSIF"
                />
                <FeatureCard
                  icon="/bbx-icons/home-icon-2beylocker-on.webp"
                  title="BeyCode"
                  description="Scan QR/NFC ou saisie manuelle du code produit pour débloquer la version numérique de ta toupie."
                  color="#e68002"
                />
                <FeatureCard
                  icon="/bbx-icons/btn-battle.webp"
                  title="Customize"
                  description="Assemblage 3D en temps réel : Blade + Ratchet + Bit avec prévisualisation des stats."
                  color="#a855f7"
                />
                <FeatureCard
                  icon="/bbx-icons/btn-battle-primary.webp"
                  title="4 Modes de Combat"
                  description="Event Battle, Rank Battle, Sim Battle et Cloud Match (PvP en ligne via gRPC)."
                  color="#ef4444"
                />
                <FeatureCard
                  icon="/bbx-icons/orangeStar.webp"
                  title="Rare Bey Get"
                  description="Combats spéciaux pour obtenir des toupies rares avec vidéos exclusives."
                  color="#f7d301"
                />
                <FeatureCard
                  icon="/bbx-icons/ICN_Rank1.webp"
                  title="Ranking"
                  description="Classement global et régional avec boutique de rang et récompenses saisonnières."
                  color="#22c55e"
                />
              </Box>

              {/* Tech Comparison */}
              <SectionHeader
                title="Takara vs Hasbro"
                subtitle="Différences techniques clés"
              />
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: '#1d1b1b',
                  border: '1px solid',
                  borderColor: alpha('#fff', 0.04),
                }}
              >
                <Box
                  component="table"
                  sx={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    '& th': {
                      p: 1.5,
                      textAlign: 'left',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      color: '#a89999',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      borderBottom: '1px solid',
                      borderColor: alpha('#fff', 0.04),
                    },
                    '& td': {
                      p: 1.5,
                      fontSize: '0.8rem',
                      color: '#f5f0f0',
                      borderBottom: '1px solid',
                      borderColor: alpha('#fff', 0.02),
                    },
                    '& tr:last-child td': { borderBottom: 'none' },
                  }}
                >
                  <thead>
                    <tr>
                      <th>Aspect</th>
                      <th style={{ color: '#ce0c07' }}>Takara Tomy</th>
                      <th style={{ color: '#64748b' }}>Hasbro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Moteur', 'Unity 6', 'Unity (ancien)'],
                      ['Taille', '554 Mo', '689 Mo'],
                      ['Scan', 'Vuforia + BLE/NFC', 'ARCore + OpenCV'],
                      ['Multijoueur', 'gRPC + Firebase', 'Photon Realtime'],
                      ['Langues', '100+ locales', '6+'],
                      [
                        'Exclusif',
                        'BeyLink, Customize, RareBey',
                        'Battle Pass, Clans, Frames',
                      ],
                    ].map(([aspect, takara, hasbro]) => (
                      <tr key={aspect}>
                        <td style={{ fontWeight: 700, color: '#a89999' }}>
                          {aspect}
                        </td>
                        <td>{takara}</td>
                        <td style={{ color: '#a89999' }}>{hasbro}</td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Paper>
            </Box>
          )}

          {/* ═══ COLLECTION (Takara-style: BX/UX/CX) ═══ */}
          {tab === 1 && (
            <Box>
              {/* Search & Filters */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 2,
                  mb: 3,
                  alignItems: 'center',
                }}
              >
                <TextField
                  placeholder="Rechercher une pièce..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  size="small"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box
                            component="span"
                            sx={{ color: '#a89999', fontSize: '1.1rem' }}
                          >
                            🔍
                          </Box>
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{
                    minWidth: { xs: 0, sm: 280 },
                    width: { xs: '100%', sm: 'auto' },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      fontWeight: 600,
                      bgcolor: '#1d1b1b',
                      '& fieldset': {
                        borderColor: alpha('#fff', 0.06),
                      },
                      '&:hover fieldset': {
                        borderColor: alpha('#fff', 0.12),
                      },
                    },
                    '& input': { color: '#f5f0f0' },
                    '& input::placeholder': { color: '#a89999' },
                  }}
                />
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {COLLECTION_FILTERS.map((f) => (
                    <Chip
                      key={`sys-${f.value}`}
                      label={f.label}
                      clickable
                      onClick={() => setSystemFilter(f.value)}
                      sx={{
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        borderRadius: 2,
                        bgcolor:
                          systemFilter === f.value
                            ? f.color || '#f5f0f0'
                            : 'transparent',
                        color: systemFilter === f.value ? '#fff' : '#a89999',
                        border: '1px solid',
                        borderColor:
                          systemFilter === f.value
                            ? f.color || '#f5f0f0'
                            : alpha('#fff', 0.08),
                        '&:hover': {
                          bgcolor: f.color
                            ? alpha(
                                f.color,
                                systemFilter === f.value ? 1 : 0.15,
                              )
                            : undefined,
                        },
                      }}
                    />
                  ))}
                  <Box
                    sx={{
                      width: 1,
                      height: 28,
                      bgcolor: alpha('#fff', 0.06),
                      mx: 0.5,
                    }}
                  />
                  {TYPE_FILTERS.map((f) => (
                    <Chip
                      key={f.value}
                      label={f.label}
                      clickable
                      onClick={() => setTypeFilter(f.value)}
                      size="small"
                      sx={{
                        fontWeight: 800,
                        fontSize: '0.65rem',
                        borderRadius: 2,
                        bgcolor:
                          typeFilter === f.value
                            ? f.color || '#f5f0f0'
                            : 'transparent',
                        color: typeFilter === f.value ? '#fff' : '#a8999980',
                        border: '1px solid',
                        borderColor:
                          typeFilter === f.value
                            ? f.color || '#f5f0f0'
                            : alpha('#fff', 0.06),
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Parts by Category (Takara-style sections) */}
              <SectionHeader
                title={`Blades (${filterParts(blades).length})`}
                subtitle="Toupies et Over Blades"
              />
              <PartGrid parts={filterParts(blades)} />

              <Box sx={{ my: 4 }} />
              <SectionHeader
                title={`Ratchets (${filterParts(ratchets).length})`}
                subtitle="Systèmes de rotation"
              />
              <PartGrid parts={filterParts(ratchets)} />

              <Box sx={{ my: 4 }} />
              <SectionHeader
                title={`Bits (${filterParts(bits).length})`}
                subtitle="Pointes de performance"
              />
              <PartGrid parts={filterParts(bits)} />

              {assistBlades.length > 0 && (
                <>
                  <Box sx={{ my: 4 }} />
                  <SectionHeader
                    title={`Assist Blades (${filterParts(assistBlades).length})`}
                    subtitle="Lames d'assistance CX"
                  />
                  <PartGrid parts={filterParts(assistBlades)} />
                </>
              )}

              {lockChips.length > 0 && (
                <>
                  <Box sx={{ my: 4 }} />
                  <SectionHeader
                    title={`Lock Chips (${filterParts(lockChips).length})`}
                    subtitle="Puces de verrouillage CX"
                  />
                  <PartGrid parts={filterParts(lockChips)} />
                </>
              )}
            </Box>
          )}

          {/* ═══ COMBATS ═══ */}
          {tab === 2 && (
            <Box>
              {/* Combat Mode Selector */}
              <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                {(
                  [
                    { key: 'arena', label: 'Arena', color: '#ef4444' },
                    { key: 'calc', label: 'Calculateur', color: '#e68002' },
                    { key: 'rules', label: 'Règles', color: '#22c55e' },
                  ] as const
                ).map((m) => (
                  <Chip
                    key={m.key}
                    label={m.label}
                    clickable
                    onClick={() => setCombatMode(m.key)}
                    sx={{
                      fontWeight: 900,
                      borderRadius: 2,
                      bgcolor: combatMode === m.key ? m.color : 'transparent',
                      color: combatMode === m.key ? '#fff' : '#a89999',
                      border: '1px solid',
                      borderColor:
                        combatMode === m.key ? m.color : alpha('#fff', 0.08),
                    }}
                  />
                ))}
              </Box>

              {(combatMode === 'arena' || combatMode === 'calc') && (
                <CombatTab blades={blades} ratchets={ratchets} bits={bits} />
              )}
              {combatMode === 'rules' && <GameData />}
            </Box>
          )}

          {/* ═══ CUSTOMIZE (3D Models) ═══ */}
          {tab === 3 && <MeshGallery />}

          {/* ═══ ASSETS ═══ */}
          {tab === 4 && (
            <Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                {ASSET_SUBTABS.map((label, i) => (
                  <Chip
                    key={label}
                    label={label}
                    clickable
                    onClick={() => setAssetSubTab(i)}
                    sx={{
                      fontWeight: 900,
                      borderRadius: 2,
                      bgcolor: assetSubTab === i ? '#e68002' : 'transparent',
                      color: assetSubTab === i ? '#fff' : '#a89999',
                      border: '1px solid',
                      borderColor:
                        assetSubTab === i ? '#e68002' : alpha('#fff', 0.08),
                    }}
                  />
                ))}
              </Box>

              {assetSubTab === 0 && <AssetGallery />}
              {assetSubTab === 1 && <MeshGallery />}
              {assetSubTab === 2 && <VfxGallery />}
              {assetSubTab === 3 && <ProductCatalog products={products} />}
            </Box>
          )}

          {/* ═══ DONNÉES ═══ */}
          {tab === 5 && <GameData />}
        </Box>

        {/* ── Footer Branding ── */}
        <Box
          sx={{
            mt: 6,
            mb: 2,
            textAlign: 'center',
            py: 3,
            borderTop: '1px solid',
            borderColor: alpha('#fff', 0.04),
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: '#a8999960', fontWeight: 600, display: 'block' }}
          >
            Données extraites de l&apos;application Beyblade X v1.7.1 (Takara
            Tomy)
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#a8999940',
              fontWeight: 800,
              letterSpacing: 2,
              mt: 0.5,
              display: 'block',
            }}
          >
            RÉPUBLIQUE POPULAIRE DU BEYBLADE
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
