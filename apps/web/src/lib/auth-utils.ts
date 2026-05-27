import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { SUPERADMIN_DISCORD_IDS } from '@/lib/constants';

type SessionUser = {
  role?: string | null;
  discordId?: string | null;
};

/** Check if a user object has admin access (role or superadmin Discord ID). */
export function isAdminUser(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (
    user.discordId &&
    SUPERADMIN_DISCORD_IDS.includes(
      user.discordId as (typeof SUPERADMIN_DISCORD_IDS)[number],
    )
  )
    return true;
  return user.role === 'admin' || user.role === 'superadmin';
}

/** Check if a user has admin or moderator access. */
export function isStaffUser(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return user.role === 'moderator';
}

/** Get the current session and check admin access. Returns session or null. */
export async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session || !isAdminUser(session.user as SessionUser)) return null;
  return session;
}

/** Get the current session and check staff access (admin + moderator). */
export async function requireStaff() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session || !isStaffUser(session.user as SessionUser)) return null;
  return session;
}
