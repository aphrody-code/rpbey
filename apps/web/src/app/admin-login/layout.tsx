import { type Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion Admin',
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
