'use client';

import { Close, ThreeDRotation } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

interface MeshAsset {
  name: string;
  path: string;
  category: string;
}

const MESH_CATEGORIES = [
  { label: 'Toutes', value: 'all' },
  { label: 'Blades (Head)', value: 'blade', color: '#ef4444' },
  { label: 'Ratchets', value: 'ratchet', color: '#f59e0b' },
  { label: 'Bits', value: 'bit', color: '#3b82f6' },
  { label: 'Base', value: 'base', color: '#22c55e' },
  { label: 'Trophées', value: 'trophy', color: '#a855f7' },
  { label: 'VFX / Autre', value: 'other', color: '#6b7280' },
];

function categorizeMesh(name: string): string {
  const lower = name.toLowerCase();
  if (
    lower.startsWith('head_') ||
    lower.startsWith('auxblade') ||
    lower.includes('bladecore')
  )
    return 'blade';
  if (lower.startsWith('ratchet')) return 'ratchet';
  if (lower.startsWith('bit_')) return 'bit';
  if (lower.startsWith('base_') || lower.startsWith('headparts')) return 'base';
  if (lower.startsWith('trophy')) return 'trophy';
  return 'other';
}

// Texture lookup with multiple fallback strategies
// Unity naming: [BladeName]_Blade_AO.webp, Ratchet3-85_AO.webp, Bit_A_AO.webp, AuxBlade_B_AO.webp
function findTextures(meshName: string): {
  ao: string[];
  edge: string[];
} {
  const base = meshName.replace('.obj', '');
  const stripped = base.replace(/_\d+$/, '');
  const t = '/app-assets/textures/';

  // Different strategies based on mesh category
  const lower = base.toLowerCase();

  if (lower.startsWith('auxblade')) {
    return {
      ao: [`${t}${stripped}_AO.webp`, `${t}${base}_AO.webp`],
      edge: [`${t}${stripped}_EdgeMask.webp`, `${t}${base}_EdgeMask.webp`],
    };
  }

  if (lower.startsWith('ratchet')) {
    // Ratchet meshes: Ratchet3-85.obj → Ratchet3-85_AO.webp
    return {
      ao: [`${t}${stripped}_AO.webp`, `${t}${base}_AO.webp`],
      edge: [`${t}${stripped}_EdgeMask.webp`, `${t}${base}_EdgeMask.webp`],
    };
  }

  if (lower.startsWith('bit_')) {
    // Bit meshes: Bit_A.obj → Bit_A_AO.webp
    return {
      ao: [`${t}${stripped}_AO.webp`, `${t}${base}_AO.webp`],
      edge: [`${t}${stripped}_EdgeMask.webp`, `${t}${base}_EdgeMask.webp`],
    };
  }

  if (lower.startsWith('trophy')) {
    return { ao: [], edge: [] };
  }

  // Head meshes are generic — try edge textures
  if (lower.startsWith('head_metal')) {
    return {
      ao: [`${t}head_metal_edge.webp`, `${t}head_metal_edge_1.webp`],
      edge: [`${t}head_metal_edge.webp`],
    };
  }

  // Default: try direct name match
  return {
    ao: [
      `${t}${stripped}_AO.webp`,
      `${t}${base}_AO.webp`,
      `${t}${stripped}_Blade_AO.webp`,
    ],
    edge: [
      `${t}${stripped}_EdgeMask.webp`,
      `${t}${base}_EdgeMask.webp`,
      `${t}${stripped}_Blade_EdgeMask.webp`,
    ],
  };
}

function ThreeCanvas({
  meshPath,
  meshName,
  width,
  height,
  premium = false,
}: {
  meshPath: string;
  meshName: string;
  width: number;
  height: number;
  premium?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // --- Scene ---
    const scene = new THREE.Scene();

    // Gradient background — dark studio look
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 2;
    bgCanvas.height = 256;
    const bgCtx = bgCanvas.getContext('2d');
    if (bgCtx) {
      const grad = bgCtx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#141418');
      grad.addColorStop(0.5, '#0c0c10');
      grad.addColorStop(1, '#080810');
      bgCtx.fillStyle = grad;
      bgCtx.fillRect(0, 0, 2, 256);
    }
    const bgTexture = new THREE.CanvasTexture(bgCanvas);
    scene.background = bgTexture;

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(
      premium ? 35 : 45,
      width / height,
      0.1,
      1000,
    );

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.shadowMap.enabled = premium;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- 3-Point Lighting (Studio) ---
    // Key light — warm white from top-right
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
    keyLight.position.set(4, 8, 6);
    if (premium) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.setScalar(1024);
      keyLight.shadow.radius = 4;
    }
    scene.add(keyLight);

    // Fill light — cool blue from left
    const fillLight = new THREE.DirectionalLight(0x88aaee, 0.6);
    fillLight.position.set(-6, 2, -3);
    scene.add(fillLight);

    // Rim light — red BBX accent from behind
    const rimLight = new THREE.DirectionalLight(0xdc2626, 0.8);
    rimLight.position.set(0, 3, -6);
    scene.add(rimLight);

    // Ambient — very subtle, let directional do the work
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambient);

    // Under-glow — subtle red point from below
    const underGlow = new THREE.PointLight(0xdc2626, 0.3, 12);
    underGlow.position.set(0, -2, 0);
    scene.add(underGlow);

    // --- Ground Plane (reflective pedestal) ---
    if (premium) {
      const groundGeo = new THREE.CircleGeometry(4, 64);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0x111115,
        metalness: 0.9,
        roughness: 0.15,
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -1.6;
      ground.receiveShadow = true;
      scene.add(ground);

      // Glowing ring around pedestal
      const ringGeo = new THREE.RingGeometry(3.8, 4, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xdc2626,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -1.59;
      scene.add(ring);
    }

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = premium ? 1.5 : 2.5;
    controls.minDistance = 2;
    controls.maxDistance = 15;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);

    // --- Textures ---
    const textureLoader = new THREE.TextureLoader();
    const texPaths = findTextures(meshName);

    // Build PBR material — chrome-like metallic
    const material = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.85,
      roughness: 0.18,
      side: THREE.DoubleSide,
      envMapIntensity: 1.5,
    });

    // Fake environment reflection using gradient
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 256;
    envCanvas.height = 256;
    const envCtx = envCanvas.getContext('2d');
    if (envCtx) {
      const g = envCtx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#334');
      g.addColorStop(0.3, '#556');
      g.addColorStop(0.5, '#889');
      g.addColorStop(0.7, '#334');
      g.addColorStop(1, '#112');
      envCtx.fillStyle = g;
      envCtx.fillRect(0, 0, 256, 256);
    }
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envTex;

    // Try loading AO + Edge maps
    function tryLoadTexture(
      paths: string[],
      onSuccess: (tex: THREE.Texture) => void,
    ) {
      if (paths.length === 0) return;
      const [first, ...rest] = paths;
      if (!first) return;
      textureLoader.load(
        first,
        (tex) => onSuccess(tex),
        undefined,
        () => tryLoadTexture(rest, onSuccess),
      );
    }

    tryLoadTexture(texPaths.ao, (tex) => {
      material.aoMap = tex;
      material.aoMapIntensity = 1.2;
      material.needsUpdate = true;
    });

    tryLoadTexture(texPaths.edge, (tex) => {
      material.bumpMap = tex;
      material.bumpScale = 0.4;
      material.needsUpdate = true;
    });

    // --- Load OBJ ---
    const loader = new OBJLoader();
    loader.load(
      meshPath,
      (obj) => {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = material;
            child.castShadow = premium;
            child.receiveShadow = premium;
            if (child.geometry.attributes.uv) {
              child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
            }
            // Compute smooth normals for better shading
            child.geometry.computeVertexNormals();
          }
        });

        // Center and scale
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;
        obj.scale.setScalar(scale);
        obj.position.sub(center.multiplyScalar(scale));

        scene.add(obj);

        // Camera positioning — slightly above and to the side
        camera.position.set(2, 2.5, 5);
        camera.lookAt(0, 0, 0);
        controls.update();
      },
      undefined,
      () => {},
    );

    // --- Animate ---
    let animId: number;
    const clock = new THREE.Clock();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      controls.update();

      // Subtle pulsing rim light
      rimLight.intensity = 0.6 + Math.sin(t * 2) * 0.2;
      underGlow.intensity = 0.2 + Math.sin(t * 1.5 + 1) * 0.1;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      material.dispose();
      bgTexture.dispose();
      envTex.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
    };
  }, [meshPath, meshName, width, height, premium]);

  return (
    <div
      ref={mountRef}
      style={{ width, height, borderRadius: 8, overflow: 'hidden' }}
    />
  );
}

function useMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width:599px)');
    setMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return mobile;
}

function MeshCard({ mesh }: { mesh: MeshAsset }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const isMobile = useMobile();
  const catColor =
    MESH_CATEGORIES.find((c) => c.value === mesh.category)?.color || '#888';
  const displayName = mesh.name.replace('.obj', '').replace(/_/g, ' ');

  return (
    <>
      <Card
        elevation={0}
        sx={{
          borderRadius: 4,
          border: '1px solid',
          borderColor: alpha(catColor, 0.12),
          bgcolor: '#0e0e12',
          transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          overflow: 'hidden',
          '&:hover': {
            borderColor: alpha(catColor, 0.5),
            transform: 'translateY(-6px) scale(1.02)',
            boxShadow: `0 16px 40px ${alpha(catColor, 0.25)}, 0 0 0 1px ${alpha(catColor, 0.15)}`,
            '& .mesh-glow': {
              opacity: 1,
            },
          },
        }}
      >
        <CardActionArea
          onClick={() => setDialogOpen(true)}
          sx={{ borderRadius: 4 }}
        >
          {/* Static thumbnail — no WebGL, zero perf cost */}
          <Box
            sx={{
              width: '100%',
              aspectRatio: '1',
              bgcolor: '#0c0c10',
              background:
                'radial-gradient(circle at 50% 40%, #1a1a22 0%, #0c0c10 70%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              className="mesh-icon"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&:hover': {
                  transform: 'rotateY(20deg) scale(1.1)',
                },
              }}
            >
              <ThreeDRotation
                sx={{ fontSize: 36, color: alpha(catColor, 0.5) }}
              />
              <Typography
                sx={{
                  fontSize: '0.55rem',
                  fontWeight: 900,
                  color: alpha(catColor, 0.35),
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Ouvrir en 3D
              </Typography>
            </Box>
            <Box
              className="mesh-glow"
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: `linear-gradient(0deg, ${alpha(catColor, 0.1)} 0%, transparent 100%)`,
                opacity: 0,
                transition: 'opacity 0.3s',
                pointerEvents: 'none',
              }}
            />
            <Chip
              label="3D"
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                height: 20,
                fontSize: '0.55rem',
                fontWeight: 900,
                bgcolor: alpha(catColor, 0.12),
                color: catColor,
                border: '1px solid',
                borderColor: alpha(catColor, 0.25),
              }}
            />
          </Box>
          <CardContent
            sx={{
              p: 1.5,
              '&:last-child': { pb: 1.5 },
              borderTop: '1px solid',
              borderColor: alpha('#fff', 0.04),
            }}
          >
            <Typography
              variant="body2"
              noWrap
              sx={{
                fontWeight: '900',
                fontSize: '0.75rem',
                color: '#e4e4e7',
              }}
            >
              {displayName}
            </Typography>
            <Chip
              label={mesh.category}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.55rem',
                fontWeight: 900,
                mt: 0.5,
                bgcolor: alpha(catColor, 0.12),
                color: catColor,
                textTransform: 'uppercase',
                border: '1px solid',
                borderColor: alpha(catColor, 0.2),
              }}
            />
          </CardContent>
        </CardActionArea>
      </Card>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#08080c',
              borderRadius: { xs: 0, sm: 5 },
              overflow: 'hidden',
              border: { sm: '1px solid' },
              borderColor: { sm: alpha(catColor, 0.2) },
              boxShadow: `0 40px 80px rgba(0,0,0,0.8), 0 0 60px ${alpha(catColor, 0.1)}`,
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fff',
            pb: 1,
            px: 3,
            pt: 2,
            borderBottom: '1px solid',
            borderColor: alpha('#fff', 0.06),
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: '900',
                }}
              >
                {displayName}
              </Typography>
              <Chip
                label={mesh.category}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.6rem',
                  fontWeight: 900,
                  bgcolor: alpha(catColor, 0.15),
                  color: catColor,
                  textTransform: 'uppercase',
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: alpha('#fff', 0.35) }}>
              {isMobile
                ? 'Toucher pour tourner'
                : 'Glisser pour tourner · Molette pour zoomer'}{' '}
              · {mesh.name}
            </Typography>
          </Box>
          <IconButton
            onClick={() => setDialogOpen(false)}
            sx={{
              color: '#666',
              bgcolor: alpha('#fff', 0.05),
              '&:hover': { bgcolor: alpha('#fff', 0.1) },
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: '#08080c',
          }}
        >
          {dialogOpen && (
            <ThreeCanvas
              meshPath={mesh.path}
              meshName={mesh.name}
              width={
                isMobile
                  ? window.innerWidth
                  : Math.min(700, window.innerWidth - 32)
              }
              height={
                isMobile
                  ? window.innerHeight - 100
                  : Math.min(550, window.innerHeight - 120)
              }
              premium
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const _MESHES_PER_PAGE = 30;

export function MeshGallery() {
  const [meshes, setMeshes] = useState<MeshAsset[]>([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [_page, _setPage] = useState(1);

  useEffect(() => {
    fetch('/api/app-assets?type=meshes')
      .then((r) => r.json())
      .then((data) => {
        const assets = (data.assets || []).map(
          (a: { name: string; path: string }) => ({
            ...a,
            category: categorizeMesh(a.name),
          }),
        );
        setMeshes(assets);
        setLoading(false);
      })
      .catch(() => {
        setMeshes([]);
        setLoading(false);
      });
  }, []);

  const filtered =
    category === 'all' ? meshes : meshes.filter((m) => m.category === category);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 3 }}>
        {MESH_CATEGORIES.map((cat) => {
          const count =
            cat.value === 'all'
              ? meshes.length
              : meshes.filter((m) => m.category === cat.value).length;
          return (
            <Chip
              key={cat.value}
              label={`${cat.label} (${count})`}
              clickable
              onClick={() => setCategory(cat.value)}
              sx={{
                fontWeight: 900,
                fontSize: '0.75rem',
                borderRadius: 2,
                bgcolor:
                  category === cat.value
                    ? cat.color || 'text.primary'
                    : 'transparent',
                color: category === cat.value ? '#fff' : 'text.secondary',
                border: '1px solid',
                borderColor:
                  category === cat.value
                    ? cat.color || 'text.primary'
                    : 'divider',
              }}
            />
          );
        })}
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.disabled',
          mb: 2,
          display: 'block',
        }}
      >
        {filtered.length} modèle{filtered.length !== 1 ? 's' : ''} 3D avec
        textures PBR — Rotation auto, cliquer pour vue plein écran
      </Typography>
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography
            sx={{
              color: 'text.disabled',
            }}
          >
            Chargement des modèles 3D...
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(4, 1fr)',
              lg: 'repeat(5, 1fr)',
            },
            gap: 2,
          }}
        >
          {filtered.slice(0, _page * _MESHES_PER_PAGE).map((mesh) => (
            <MeshCard key={mesh.name} mesh={mesh} />
          ))}
        </Box>
      )}
      {filtered.length > _page * _MESHES_PER_PAGE && (
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Button
            variant="outlined"
            onClick={() => _setPage((p) => p + 1)}
            sx={{
              fontWeight: 900,
              borderRadius: 3,
              borderColor: alpha('#a855f7', 0.3),
              color: '#a855f7',
              px: 4,
              '&:hover': { bgcolor: alpha('#a855f7', 0.08) },
            }}
          >
            Voir plus ({filtered.length - _page * _MESHES_PER_PAGE} restants)
          </Button>
        </Box>
      )}
    </Box>
  );
}
