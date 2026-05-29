import { NextResponse } from "next/server";
import { getRecommendations } from "@/lib/recommendation-engine";
import type { RecommendationOptions } from "@/lib/recommendation-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);

		const options: RecommendationOptions = {
			weights: {},
			filters: {},
		};

		// Parse weights
		const metaRelevanceWeight = searchParams.get("metaRelevanceWeight");
		if (metaRelevanceWeight !== null) {
			options.weights!.metaRelevanceWeight = parseFloat(metaRelevanceWeight);
		}
		const hypeWeight = searchParams.get("hypeWeight");
		if (hypeWeight !== null) {
			options.weights!.hypeWeight = parseFloat(hypeWeight);
		}
		const priceEfficiencyWeight = searchParams.get("priceEfficiencyWeight");
		if (priceEfficiencyWeight !== null) {
			options.weights!.priceEfficiencyWeight = parseFloat(priceEfficiencyWeight);
		}

		// Parse filters
		const minMetaRelevance = searchParams.get("minMetaRelevance");
		if (minMetaRelevance !== null) {
			options.filters!.minMetaRelevance = parseFloat(minMetaRelevance);
		}
		const minHypeScore = searchParams.get("minHypeScore");
		if (minHypeScore !== null) {
			options.filters!.minHypeScore = parseFloat(minHypeScore);
		}
		const minPriceEfficiency = searchParams.get("minPriceEfficiency");
		if (minPriceEfficiency !== null) {
			options.filters!.minPriceEfficiency = parseFloat(minPriceEfficiency);
		}
		const maxPriceEur = searchParams.get("maxPriceEur");
		if (maxPriceEur !== null) {
			options.filters!.maxPriceEur = parseFloat(maxPriceEur);
		}
		const productType = searchParams.get("productType");
		if (productType !== null) {
			options.filters!.productType = productType;
		}
		const productLine = searchParams.get("productLine");
		if (productLine !== null) {
			options.filters!.productLine = productLine;
		}
		const availableOnly = searchParams.get("availableOnly");
		if (availableOnly !== null) {
			options.filters!.availableOnly = availableOnly === "true";
		}

		const recommendations = await getRecommendations(options);

		return NextResponse.json({
			success: true,
			count: recommendations.length,
			weights: {
				metaRelevanceWeight: options.weights?.metaRelevanceWeight ?? 0.5,
				hypeWeight: options.weights?.hypeWeight ?? 0.2,
				priceEfficiencyWeight: options.weights?.priceEfficiencyWeight ?? 0.3,
			},
			filters: options.filters,
			data: recommendations,
		});
	} catch (error: any) {
		console.error("Recommendation API Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error.message || "Failed to fetch recommendations",
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json().catch(() => ({}));
		const recommendations = await getRecommendations(body);
		return NextResponse.json({
			success: true,
			count: recommendations.length,
			weights: {
				metaRelevanceWeight: body.weights?.metaRelevanceWeight ?? 0.5,
				hypeWeight: body.weights?.hypeWeight ?? 0.2,
				priceEfficiencyWeight: body.weights?.priceEfficiencyWeight ?? 0.3,
			},
			filters: body.filters,
			data: recommendations,
		});
	} catch (error: any) {
		console.error("Recommendation API POST Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error.message || "Failed to fetch recommendations",
			},
			{ status: 500 }
		);
	}
}
