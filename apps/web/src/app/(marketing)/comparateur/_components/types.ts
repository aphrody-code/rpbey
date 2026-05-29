export interface BxProduct {
	shop: string;
	domain: string;
	region: string;
	type: string;
	currency: string;
	title: string;
	price: number | null;
	priceMax: number | null;
	priceEur?: number | null;
	available: boolean;
	url: string;
	image: string | null;
}

export interface BxShop {
	name: string;
	domain: string;
	url: string;
	region: string;
	type: string;
	currency: string;
	platform: string;
	productCount: number;
	sources?: string[];
}

export interface BxOffer {
	shop: string;
	domain: string;
	region: string;
	type: string;
	title: string;
	price: number;
	currency: string;
	priceEur: number | null;
	available: boolean;
	url: string;
	image: string | null;
}

export interface BxProductGroup {
	key: string;
	code: string | null;
	name: string;
	slug?: string;
	offers: BxOffer[];
	shopCount: number;
	cheapest: BxOffer | null;
	cheapestEur: number | null;
}

export interface BxCatalog {
	generatedAt: string;
	shopCount: number;
	scrapedShopCount: number;
	productCount: number;
	platforms?: Record<string, number>;
	stats?: {
		averagePriceEur: number;
		successRate: number;
		regionStats: Array<{
			region: string;
			productCount: number;
			averagePriceEur: number | null;
		}>;
		platformStats: Array<{
			platform: string;
			total: number;
			active: number;
		}>;
	};
	shops: BxShop[];
	products: BxProduct[];
}

export interface PartAnalysis {
	id: string;
	name: string;
	type: string;
	usageCount: number;
	normalizedUsage: number;
	tier: "S" | "A" | "B" | "C";
	metaScore: number;
}

export interface RecommendedProduct {
	key: string;
	code: string | null;
	name: string;
	slug: string;
	cheapestEur: number | null;
	shopCount: number;
	imageUrl: string | null;
	offers: BxOffer[];

	// Calculated Scores (0.0 to 1.0)
	metaRelevanceScore: number;
	hypeScore: number;
	priceEfficiencyScore: number;
	overallScore: number;

	// Component & Product Metadata analysis
	includedParts: PartAnalysis[];
	classifications: string[];
}

