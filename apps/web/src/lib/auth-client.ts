'use client';

import {
  adminClient,
  twoFactorClient,
  usernameClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // Use relative URLs - the client will automatically use the current origin
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    adminClient(),
    usernameClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/two-factor';
      },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
