import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function MyProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Si pas de session, le DashboardLayout (AuthGuard) s'en occupera aussi,
  // mais on assure la redirection ici vers la page de connexion au cas où.
  if (!session) {
    redirect('/sign-in');
  }

  // Redirection directe vers l'ID de l'utilisateur pour éviter le mot-clé "me"
  redirect(`/dashboard/profile/${session.user.id}`);
}
