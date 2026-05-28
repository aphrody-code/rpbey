import { type MetadataRoute } from 'next';

// Robots permissif : on AUTORISE explicitement les crawlers classiques ET les
// bots IA (indexation + grounding LLM) ; seules les zones privées restent fermées.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rpbey.fr';

  // Crawlers IA / moteurs autorisés nommément (index + grounding LLM).
  const aiAndSearchBots = [
    'Googlebot', 'Googlebot-Image', 'Google-Extended', 'Bingbot', 'DuckDuckBot',
    'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', // OpenAI / ChatGPT
    'ClaudeBot', 'Claude-Web', 'Claude-SearchBot', 'anthropic-ai', // Anthropic / Claude
    'PerplexityBot', 'Perplexity-User', // Perplexity
    'Google-CloudVertexBot', 'Applebot', 'Applebot-Extended',
    'Amazonbot', 'meta-externalagent', 'FacebookBot', 'Bytespider', 'CCBot', 'cohere-ai',
  ];

  return {
    rules: [
      // Règle générale : tout autorisé sauf les zones privées.
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/dashboard/', '/sign-in', '/sign-up', '/two-factor'],
      },
      // Bots IA & moteurs : accès large (l'API publique de data reste lisible,
      // seules les vraies zones privées sont fermées).
      ...aiAndSearchBots.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: ['/admin/', '/dashboard/'],
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
