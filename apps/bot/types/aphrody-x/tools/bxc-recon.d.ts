/**
 * bxc CLI integration — runs `bxc recon` (profile `max` recommended for X SPA).
 */
export type BxcReconProfile = "static" | "fast" | "http" | "stealth" | "max";
export interface ReconSummary {
    url: string;
    finalUrl?: string;
    httpStatus?: number;
    profile?: string;
    cdn?: string;
    error?: string;
    raw?: unknown;
}
export interface XSurfaceReconReport {
    generated_at: string;
    profile: BxcReconProfile;
    results: Record<string, ReconSummary>;
}
/** Invoke global `bxc recon` per URL (best: profile `max` for x.com SPA). */
export declare function runXSurfaceRecon(profile?: BxcReconProfile, urls?: readonly string[]): Promise<XSurfaceReconReport>;
