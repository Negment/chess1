/**
 * Public Maia3 entry point for the browser.
 *
 *   import { Maia3 } from "maia3-js/web";
 *
 * Resolves ONNX weights via fetch + Cache Storage and runs inference with
 * onnxruntime-web. The constructor lets callers override the URL (e.g. to
 * self-host weights) and listen to download progress.
 */
import { Maia3 as Maia3Core, Maia3CoreOptions } from "./index.js";
import { ProgressCallback } from "./download.web.js";
import { VariantAlias } from "./variants.js";
export * from "./index.js";
export interface Maia3WebOptions extends Maia3CoreOptions {
    variant?: VariantAlias;
    /** Override URL for the ONNX weights file. */
    url?: string;
    /** Optional pre-fetched bytes (skips download). */
    modelBytes?: ArrayBuffer | Uint8Array;
    /** Progress callback called during download (loaded, total). */
    onProgress?: ProgressCallback;
    /** Execution providers (default ["wasm"]). */
    executionProviders?: string[];
    /**
     * WASM worker threads. Defaults to half of `navigator.hardwareConcurrency`
     * (max 4) when the page is cross-origin isolated, else 1 — multi-threaded
     * WASM needs SharedArrayBuffer, which requires COOP/COEP headers:
     *
     *   Cross-Origin-Opener-Policy: same-origin
     *   Cross-Origin-Embedder-Policy: require-corp
     */
    numThreads?: number;
    /** Enable SIMD kernels (default true). */
    simd?: boolean;
    /** Run inference in a worker to keep the main thread responsive. */
    proxy?: boolean;
    /** Override where the ORT .wasm artifacts are served from. */
    wasmPaths?: string;
    /** Largest batch passed to a single session.run (default 64). */
    maxBatchSize?: number;
}
/**
 * Maia3 inference for browsers. `load()` downloads (or pulls from cache)
 * the ONNX file and constructs an onnxruntime-web session.
 *
 * @example
 * ```ts
 * const maia = new Maia3({
 *   variant: "5m",
 *   onProgress: (loaded, total) => console.log(loaded / total),
 * });
 * await maia.load();
 * const r = await maia.predict({ fen: STARTPOS_FEN, selfElo: 1500 });
 * ```
 */
export declare class Maia3 extends Maia3Core {
    constructor(opts?: Maia3WebOptions);
}
export { ensureModelWeb } from "./download.web.js";
export { Maia3WebModel } from "./model.web.js";
//# sourceMappingURL=index.web.d.ts.map