import { type Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Mon Deck',
};

export default function DeckRedirectPage() {
  redirect('/builder');
}
