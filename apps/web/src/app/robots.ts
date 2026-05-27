import { type MetadataRoute } from 'next';

// MIGRATED from: export const dynamic = 'force-static';
// → Dynamic by default with Cache Components.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rpbey.fr';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/sign-in',
          '/sign-up',
          '/two-factor',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/'],
      },
      {
        userAgent: 'Google-Extended', // Specifically for LLM grounding
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/'],
      },
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
