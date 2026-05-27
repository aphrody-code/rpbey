import Container from '@mui/material/Container';
import { RandomCombo } from '@/components/deck/RandomCombo';
import { PageHeader } from '@/components/ui';

export const metadata = {
  title: 'Hasard | Dashboard RPB',
  description: 'Laisse le hasard décider de ton prochain combo Beyblade X !',
};

export default function RandomPage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <PageHeader
        title="🎲 Mode Aléatoire"
        description="Laisse le destin choisir ton prochain combo pour l'entraînement ou le fun."
      />
      <RandomCombo />
    </Container>
  );
}
