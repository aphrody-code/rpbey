import { type Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/auth-utils';

export const metadata: Metadata = {
  title: {
    default: 'RPB Admin',
    template: '%s | RPB Admin',
  },
  description:
    "Panel d'administration RPB - Gestion des bots, tournois et utilisateurs.",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const session = await requireAdmin();

  if (!session) {
    redirect('/sign-in?callbackUrl=/admin');
  }

  return <AdminShell>{children}</AdminShell>;
}
