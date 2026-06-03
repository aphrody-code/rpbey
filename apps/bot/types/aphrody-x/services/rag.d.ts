import type { Store } from "../db/store";
export interface RagResult {
    query: string;
    answer: string;
    sources: {
        id: string;
        author_username: string;
        text: string;
        like_count: number;
        conversation_id?: string;
    }[];
}
export interface RagOptions {
    apiKey?: string;
    model?: string;
    limit?: number;
    offlineMock?: boolean;
}
export declare class BeybladeXRag {
    private apiKey;
    private model;
    private limit;
    private offlineMock;
    constructor(options?: RagOptions);
    private getEmbedding;
    /**
     * Helper to parse user query into search keywords.
     * Uses simple keyword extraction fallback if offline or no API key.
     */
    extractKeywords(query: string): Promise<string[]>;
    /**
     * Query the RAG system to generate an answer based on crawled SQLite data.
     */
    query(query: string, store: Store): Promise<RagResult>;
}
