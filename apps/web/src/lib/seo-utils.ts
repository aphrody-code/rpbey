import { type Metadata } from 'next';
import {
  type BreadcrumbList,
  type Event,
  type ItemList,
  type SportsOrganization,
  type TechArticle,
  type WebSite,
  type WithContext,
} from 'schema-dts';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rpbey.fr';

/**
 * Generate consistent OG + Twitter metadata for a page.
 */
export function createPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
}): Metadata {
  const { title, description, path, type = 'website' } = opts;
  const image = opts.image || '/banner.webp';
  const url = `${baseUrl}${path}`;

  return {
    title,
    description,
    openGraph: {
      type,
      locale: 'fr_FR',
      url,
      siteName: 'RPB - République Populaire du Beyblade',
      title,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export function generateTechArticleJsonLd(article: {
  title: string;
  description: string;
  publishedAt: string;
  modifiedAt: string;
  authorName: string;
  url: string;
  image?: string;
  keywords?: string[];
  proficiencyLevel?: 'Beginner' | 'Intermediate' | 'Expert';
}): WithContext<TechArticle> {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: article.title,
    description: article.description,
    image: article.image ? [`${baseUrl}${article.image}`] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt,
    author: {
      '@type': 'Person',
      name: article.authorName,
      url: `${baseUrl}/notre-equipe`, // Or specific author profile
    },
    publisher: {
      '@type': 'Organization',
      name: 'République Populaire du Beyblade',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.webp`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}${article.url}`,
    },
    proficiencyLevel: article.proficiencyLevel || 'Beginner',
    keywords: article.keywords?.join(', '),
  };
}

export function generateBreadcrumbJsonLd(
  items: { name: string; item: string }[],
): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.item}`,
    })),
  };
}

export function generateEventJsonLd(event: {
  name: string;
  description?: string;
  date: string;
  location?: string;
  url: string;
  maxAttendees?: number;
  status?: 'upcoming' | 'active' | 'complete' | 'cancelled';
}): WithContext<Event> {
  const eventStatus = {
    upcoming: 'https://schema.org/EventScheduled',
    active: 'https://schema.org/EventScheduled',
    complete: 'https://schema.org/EventPostponed',
    cancelled: 'https://schema.org/EventCancelled',
  } as const;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description || `Tournoi Beyblade X organisé par la RPB`,
    startDate: event.date,
    eventStatus: event.status
      ? eventStatus[event.status]
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: event.location
      ? 'https://schema.org/OfflineEventAttendanceMode'
      : 'https://schema.org/OnlineEventAttendanceMode',
    location: event.location
      ? {
          '@type': 'Place',
          name: event.location,
        }
      : {
          '@type': 'VirtualLocation',
          url: `${baseUrl}${event.url}`,
        },
    organizer: {
      '@type': 'Organization',
      name: 'RPB - République Populaire du Beyblade',
      url: baseUrl,
    },
    url: `${baseUrl}${event.url}`,
    maximumAttendeeCapacity: event.maxAttendees,
    image: `${baseUrl}/banner.webp`,
  };
}

export function generateOrganizationJsonLd(): WithContext<SportsOrganization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: 'RPB - République Populaire du Beyblade',
    alternateName: 'RPB',
    url: baseUrl,
    logo: `${baseUrl}/logo.webp`,
    description:
      'La 1ère communauté Beyblade X en France. Tournois officiels, classements nationaux et événements.',
    sport: 'Beyblade X',
    sameAs: [
      'https://discord.gg/V8H2vHWeU6',
      'https://twitter.com/RPBey_fr',
      'https://www.instagram.com/rpb_bey',
      'https://www.tiktok.com/@rpb_bey',
      'https://www.twitch.tv/tv_rpb',
      'https://www.youtube.com/@RPB-Beyblade',
    ],
    foundingDate: '2024-01-01',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: 'https://discord.gg/V8H2vHWeU6',
    },
  };
}

export function generateItemListJsonLd(
  items: {
    name: string;
    url: string;
    position: number;
    image?: string;
  }[],
): WithContext<ItemList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      url: `${baseUrl}${item.url}`,
      image: item.image,
    })),
  };
}

export function generateWebsiteJsonLd(): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'RPB - République Populaire du Beyblade',
    url: baseUrl,
    author: {
      '@type': 'Person',
      name: 'Yoyo',
      url: 'https://twitter.com/yoyo__goat',
    },
    creator: {
      '@type': 'Person',
      name: 'Yoyo',
      url: 'https://twitter.com/yoyo__goat',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      // @ts-expect-error - query-input is required by Google but not in schema-dts
      'query-input': 'required name=search_term_string',
    },
  };
}
