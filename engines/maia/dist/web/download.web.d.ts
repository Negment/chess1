/**
 * Browser-side ONNX downloader for Maia3 variants.
 *
 * Uses fetch + Cache Storage. Falls back to in-memory if Cache Storage is
 * unavailable (e.g. Service-Worker-less contexts or non-secure origins).
 *
 * Returns an ArrayBuffer that can be passed directly to Maia3WebModel.
 */
import { VariantAlias } from "./variants.js";
export type ProgressCallback = (loaded: number, total: number) => void;
export interface EnsureModelWebOptions {
    variant: VariantAlias;
    /** Override URL. Useful for self-hosted weights. */
    url?: string;
    /** Progress callback receives (bytesLoaded, bytesTotal). */
    onProgress?: ProgressCallback;
}
/**
 * Fetch the ONNX file for a variant and return its raw bytes.
 *
 * Tries Cache Storage first; falls back to a network fetch and stores the
 * response back into the cache (best-effort).
 */
export declare function ensureModelWeb(opts: EnsureModelWebOptions): Promise<ArrayBuffer>;
//# sourceMappingURL=download.web.d.ts.map