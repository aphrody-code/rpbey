import { connection } from 'next/server';
import ProfileClient from './ProfileClient';

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage(props: ProfilePageProps) {
  await connection();
  return <ProfileClient {...props} />;
}
