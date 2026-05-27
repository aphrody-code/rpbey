import { type Metadata } from 'next';
import { BuilderClient } from './_components/BuilderClient';

export const metadata: Metadata = {
  title: 'DECK BUILDER | Créez votre Deck Beyblade X',
  description:
    'Construisez et sauvegardez vos decks Beyblade X. Choisissez vos Blades, Ratchets et Bits parmi plus de 500 pièces.',
  openGraph: {
    title: 'DECK BUILDER | RPB',
    description:
      'Construisez et sauvegardez vos decks Beyblade X avec le builder visuel RPB.',
    images: ['/main-banner.webp'],
  },
};

export default function BuilderPage() {
  return <BuilderClient />;
}
