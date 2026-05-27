import { Container } from '@mui/material';
import { ProfileSettingsForm } from '@/components/dashboard/settings/ProfileSettingsForm';

export const metadata = {
  title: 'Paramètres | Dashboard',
  description: 'Gérez votre profil RPB.',
};

export default function SettingsPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <ProfileSettingsForm />
    </Container>
  );
}
