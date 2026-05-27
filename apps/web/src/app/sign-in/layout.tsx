import { type Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion | RPB',
  description:
    'Connectez-vous à la République Populaire du Beyblade pour accéder à votre profil, vos decks et les tournois.',
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
