import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';

export async function GET() {
  if (!(await requireAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Filter and mask sensitive vars
  const env: Record<string, string> = {};
  const sensitiveKeys = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD', 'URL', 'ID'];

  Object.keys(process.env)
    .sort()
    .forEach((key) => {
      // Only include relevant keys
      if (
        key.startsWith('NEXT_') ||
        key.startsWith('BETTER_AUTH') ||
        key.startsWith('DATABASE') ||
        key.startsWith('DISCORD') ||
        key.startsWith('TWITCH') ||
        key.startsWith('GOOGLE') ||
        key === 'NODE_ENV'
      ) {
        const isSensitive = sensitiveKeys.some((s) =>
          key.toUpperCase().includes(s),
        );
        env[key] = isSensitive ? '••••••••' : process.env[key] || '';
      }
    });

  return NextResponse.json({ env });
}
