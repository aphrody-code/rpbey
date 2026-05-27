import { type Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Modifier mon Profil',
};

export default function EditProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
