/**
 * Public Maia3 entry point for the browser.
 *
 *   import { Maia3 } from "maia3-js/web";
 *
 * Resolves ONNX weights via fetch + Cache Storage and runs inference with
 * onnxruntime-web. The constructor lets callers override the URL (e.g. to
 * self-host weights) and listen to download progress.
 */
import { Maia3 as Maia3Core } from "./index.js";
import { Maia3WebModel } from "./model.web.js";
import { ensureModelWeb } from "./download.web.js";
import { DEFAULT_VARIANT } from "./variants.js";
export * from "./index.js";
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
export class Maia3 extends Maia3Core {
    constructor(opts = {}) {
        const variant = opts.variant ?? DEFAULT_VARIANT;
        const factory = async () => {
            const bytes = opts.modelBytes ??
                (await ensureModelWeb({
                    variant,
                    url: opts.url,
                    onProgress: opts.onProgress,
                }));
            return new Maia3WebModel({
                modelBytes: bytes,
                executionProviders: opts.executionProviders,
                numThreads: opts.numThreads,
                simd: opts.simd,
                proxy: opts.proxy,
                wasmPaths: opts.wasmPaths,
                maxBatchSize: opts.maxBatchSize,
            });
        };
        super(factory, { ...opts, variant });
    }
}
export { ensureModelWeb } from "./download.web.js";
export { Maia3WebModel } from "./model.web.js";
//# sourceMappingURL=index.web.js.map