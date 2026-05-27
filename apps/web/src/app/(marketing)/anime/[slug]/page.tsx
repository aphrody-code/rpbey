import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAnimeSeriesBySlug } from '@/server/actions/anime';
import { SeriesDetail } from '../_components/SeriesDetail';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const series = await getAnimeSeriesBySlug(slug);
  if (!series) return { title: 'Série introuvable | RPB' };

  return {
    title: `${series.titleFr || series.title} | Anime RPB`,
    description:
      series.synopsis ||
      `Regardez ${series.titleFr || series.title} en streaming sur la RPB.`,
  };
}

export default async function SeriesPage({ params }: Props) {
  const { slug } = await params;
  const series = await getAnimeSeriesBySlug(slug);

  if (!series) notFound();

  return <SeriesDetail series={series} />;
}
