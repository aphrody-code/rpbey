import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { type NextRequest, NextResponse } from 'next/server';

function categorizeAsset(name: string): string {
  const lower = name.toLowerCase();
  if (
    lower.includes('blade') ||
    lower.includes('dran') ||
    lower.includes('sword') ||
    lower.includes('scythe') ||
    lower.includes('wizard') ||
    lower.includes('knight') ||
    lower.includes('shark') ||
    lower.includes('phoenix') ||
    lower.includes('rhino') ||
    lower.includes('leon') ||
    lower.includes('viper') ||
    lower.includes('dragon') ||
    lower.includes('wolf') ||
    lower.includes('tiger') ||
    lower.includes('whale') ||
    lower.includes('stag') ||
    lower.includes('unicorn') ||
    lower.includes('sphinx') ||
    lower.includes('gryphon') ||
    lower.includes('wyvern') ||
    lower.includes('head_') ||
    lower.includes('auxblade') ||
    lower.includes('samurai') ||
    lower.includes('cobalt') ||
    lower.includes('tyranno') ||
    lower.includes('shinobi') ||
    lower.includes('mammotusk') ||
    lower.includes('hells')
  )
    return 'blade';
  if (lower.includes('ratchet') || /^\d-\d\d/.test(lower)) return 'ratchet';
  if (
    lower.startsWith('bit_') ||
    lower.startsWith('bit-') ||
    lower.includes('_bit')
  )
    return 'bit';
  if (lower.includes('arena') || lower.includes('stadium')) return 'arena';
  if (lower.includes('powercore') || lower.includes('power_core'))
    return 'powercore';
  if (
    lower.includes('battlepass') ||
    lower.includes('season') ||
    lower.includes('seasonxp')
  )
    return 'battlepass';
  if (
    lower.includes('portrait') ||
    lower.includes('frame_') ||
    lower.includes('frame-')
  )
    return 'frame';
  if (lower.includes('clan') || lower.includes('exhibition')) return 'clan';
  if (lower.includes('marketing')) return 'marketing';
  if (lower.includes('augment')) return 'augment';
  if (lower.includes('badge') || lower.includes('achievement')) return 'badge';
  if (
    lower.includes('battle') ||
    lower.includes('screen') ||
    lower.includes('icon') ||
    lower.includes('banner') ||
    lower.includes('button') ||
    lower.includes('btn') ||
    lower.includes('ui')
  )
    return 'ui';
  return 'other';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'textures';

  const validTypes = ['textures', 'sprites', 'marketing', 'vfx', 'meshes'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  try {
    const dirPath = path.join(process.cwd(), 'public', 'app-assets', type);
    const files = await readdir(dirPath);

    const extPattern =
      type === 'meshes'
        ? /\.(obj|fbx|gltf|glb)$/i
        : /\.(png|jpg|jpeg|webp|gif)$/i;

    const assets = files
      .filter((f) => extPattern.test(f))
      .map((name) => ({
        name,
        path: `/app-assets/${type}/${name}`,
        category: categorizeAsset(name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(
      { assets, total: assets.length },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch {
    return NextResponse.json({ assets: [], total: 0 });
  }
}
