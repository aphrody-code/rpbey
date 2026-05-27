import { type Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
  await connection();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  // User redirect (Admins also go here by default now)
  redirect(`/dashboard/profile/${session.user.id}`);
}
