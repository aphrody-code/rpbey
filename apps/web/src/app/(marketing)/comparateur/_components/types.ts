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
	shops: BxShop[];
	products: BxProduct[];
}
