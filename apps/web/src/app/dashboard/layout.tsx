import { type Metadata } from 'next';
import { connection } from 'next/server';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export const metadata: Metadata = {
  title: 'Tableau de bord | RPB',
  description:
    'Gérez votre profil, vos decks et suivez vos performances sur la plateforme RPB.',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
