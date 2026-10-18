/**
 * Browser-side ONNX downloader for Maia3 variants.
 *
 * Uses fetch + Cache Storage. Falls back to in-memory if Cache Storage is
 * unavailable (e.g. Service-Worker-less contexts or non-secure origins).
 *
 * Returns an ArrayBuffer that can be passed directly to Maia3WebModel.
 */
import { getVariant } from "./variants.js";
const CACHE_NAME = "maia3-js";
async function readWithProgress(response, onProgress) {
    const total = Number(response.headers.get("content-length") ?? 0);
    if (!response.body)
        return response.arrayBuffer();
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        if (value) {
            chunks.push(value);
            loaded += value.byteLength;
            onProgress?.(loaded, total);
        }
    }
    const out = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return out.buffer;
}
/**
 * Fetch the ONNX file for a variant and return its raw bytes.
 *
 * Tries Cache Storage first; falls back to a network fetch and stores the
 * response back into the cache (best-effort).
 */
export async function ensureModelWeb(opts) {
    const info = getVariant(opts.variant);
    const url = opts.url ?? info.url;
    if (typeof caches !== "undefined") {
        try {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(url);
            if (cached) {
                return await cached.arrayBuffer();
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`[maia3-js] failed to download ${info.name}: HTTP ${response.status}`);
            }
            // Tee response so we can both stream-with-progress and store in cache.
            const cacheClone = response.clone();
            const bytes = await readWithProgress(response, opts.onProgress);
            cache.put(url, cacheClone).catch(() => {
                /* cache writes are best-effort */
            });
            return bytes;
        }
        catch (err) {
            // Fall through to direct fetch below.
            if (typeof console !== "undefined") {
                console.warn("[maia3-js] cache storage unavailable, falling back to direct fetch", err);
            }
        }
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`[maia3-js] failed to download ${info.name}: HTTP ${response.status}`);
    }
    return readWithProgress(response, opts.onProgress);
}
//# sourceMappingURL=download.web.js.map