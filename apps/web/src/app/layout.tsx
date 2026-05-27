import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { type Metadata, type Viewport } from 'next';
import Script from 'next/script';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { JsonLd } from '@/components/seo/JsonLd';
import ThemeRegistry from '@/components/theme/ThemeRegistry';
import { Toaster } from '@/components/ui/Toaster';
import { googleSansFlex } from '@/lib/fonts';
import {
  generateOrganizationJsonLd,
  generateWebsiteJsonLd,
} from '@/lib/seo-utils';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#dc2626',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://rpbey.fr'),
  title: {
    default: 'RPB - République Populaire du Beyblade',
    template: '%s | RPB',
  },
  description:
    'Rejoignez la RPB, la 1ère communauté Beyblade X en France. Participez aux tournois officiels, consultez le classement national, optimisez vos decks et discutez meta sur notre Discord.',
  keywords: [
    'Beyblade',
    'Beyblade X',
    'Beyblade X France',
    'RPB',
    'République Populaire du Beyblade',
    'Tournoi Beyblade',
    'Classement Beyblade',
    'Communauté Beyblade',
    'Discord Beyblade',
    'WBO France',
    'Takara Tomy',
    'Hasbro',
    'Dran Sword',
    'Hells Scythe',
    'Wizard Arrow',
    'Toupies de combat',
    'Meta Beyblade X',
    'Deck Building',
    'Compétition',
    'RPBey',
  ],
  authors: [
    { name: 'RPB' },
    { name: 'Yoyo', url: 'https://twitter.com/yoyo__goat' },
  ],
  creator: 'Yoyo',
  icons: {
    icon: '/logo.webp',
    apple: '/logo.webp',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://rpbey.fr',
    siteName: 'RPB - République Populaire du Beyblade',
    title: 'RPB - République Populaire du Beyblade',
    description:
      'Rejoignez la RPB, la 1ère communauté Beyblade X en France. Tournois, classements, meta et passion.',
    images: [
      {
        url: '/banner.webp',
        width: 1200,
        height: 630,
        alt: 'RPB Banner',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RPB - République Populaire du Beyblade',
    description:
      'Rejoignez la RPB, la 1ère communauté Beyblade X en France. Tournois, classements, meta et passion.',
    images: ['/banner.webp'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={googleSansFlex.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WQTHQZM9"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="gtm"
          />
        </noscript>
        <Script
          id="gtm"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WQTHQZM9');`,
          }}
        />
        <InitColorSchemeScript attribute="class" defaultMode="dark" />
        <JsonLd data={generateWebsiteJsonLd()} />
        <JsonLd data={generateOrganizationJsonLd()} />
        <NuqsAdapter>
          <ThemeRegistry>
            <Toaster />
            {children}
          </ThemeRegistry>
        </NuqsAdapter>
      </body>
    </html>
  );
}
