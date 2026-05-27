import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = (formData.get('type') as string) || 'deckbox'; // 'avatar' or 'deckbox'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validation
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 },
      );
    }

    // Size limits: 5MB for avatars, 10MB for deckboxes
    const maxSize = type === 'avatar' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: `File size too large (max ${type === 'avatar' ? '5MB' : '10MB'})`,
        },
        { status: 400 },
      );
    }

    // Ensure uploads directory exists
    const folder = type === 'avatar' ? 'avatars' : 'deckboxes';
    const uploadDir = join(process.cwd(), 'public', 'uploads', folder);

    try {
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
    } catch (err) {
      console.error('Error creating upload directory:', err);
    }

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `${session.user.id}-${uniqueSuffix}.${extension}`;
    const filepath = join(uploadDir, filename);

    await writeFile(filepath, buffer);

    const fileUrl = `/uploads/${folder}/${filename}`;

    return NextResponse.json({ url: fileUrl });
  } catch (error) {
    console.error('Error uploading file:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to upload file: ${errorMessage}` },
      { status: 500 },
    );
  }
}
