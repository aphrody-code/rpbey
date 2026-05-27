import { createClient } from './standard-api';

const feedmyClient = createClient('https://feedmy.fr');

export interface FeedMyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  published_at: string;
  created_at: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: {
    id: number;
    title: string;
    sku: string;
    price: string;
    compare_at_price: string | null;
    available: boolean;
  }[];
  images: {
    id: number;
    src: string;
    width: number;
    height: number;
  }[];
}

interface FeedMyProductsResponse {
  products: FeedMyProduct[];
}

export async function fetchLatestBeyblades(
  limit = 4,
): Promise<FeedMyProduct[]> {
  try {
    // Fetch a batch of recent products to filter from
    const data = await feedmyClient.get<FeedMyProductsResponse>(
      '/products.json',
      {
        params: { limit: 250 },
        revalidate: 3600, // Cache for 1 hour
      },
    );

    // Filter for Beyblade products (searching in title or tags)
    // Beyblade X products usually contain "Beyblade" or are in "Beyblade" collection (tags)
    const beyblades = data.products
      .filter((product) => {
        const title = product.title.toLowerCase();
        const tags = product.tags.map((t) => t.toLowerCase());

        return (
          title.includes('beyblade') ||
          tags.includes('beyblade') ||
          tags.includes('beyblade x')
        );
      })
      // Sort by published_at desc just in case
      .sort(
        (a, b) =>
          new Date(b.published_at).getTime() -
          new Date(a.published_at).getTime(),
      );

    return beyblades.slice(0, limit);
  } catch (error) {
    console.error('Failed to fetch FeedMy products:', error);
    return [];
  }
}
