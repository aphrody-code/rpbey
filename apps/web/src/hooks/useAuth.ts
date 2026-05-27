'use client';

import { signIn, signOut, useSession } from '@/lib/auth-client';

export function useAuth() {
  const { data: session, isPending } = useSession();

  const user = session?.user ?? null;
  const isAuthenticated = !!user;
  const isLoading = isPending;

  const loginWithDiscord = async () => {
    await signIn.social({ provider: 'discord' });
  };

  const logout = async () => {
    await signOut();
  };

  return {
    user,
    session,
    isAuthenticated,
    isLoading,
    loginWithDiscord,
    logout,
  };
}
