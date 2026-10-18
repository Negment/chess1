/**
 * onnxruntime-web backed Maia3 model.
 *
 * Accepts an ArrayBuffer (typically produced by download.web.ts) so that the
 * browser can pull weights via fetch + Cache Storage and hand the raw bytes
 * directly to ORT.
 */
import { InferenceOutputs, Maia3Model } from "./model.js";
export interface Maia3WebModelOptions {
    /** Raw bytes of the ONNX model. */
    modelBytes: ArrayBuffer | Uint8Array;
    /** Optional execution providers — defaults to ["wasm"]. */
    executionProviders?: string[];
    /**
     * WASM worker threads.
     *
     * Defaults to half of `navigator.hardwareConcurrency` (max 4) when the page
     * is cross-origin isolated, and 1 otherwise. Multi-threaded WASM requires
     * SharedArrayBuffer, which browsers only expose under COOP/COEP headers:
     *
     *   Cross-Origin-Opener-Policy: same-origin
     *   Cross-Origin-Embedder-Policy: require-corp
     *
     * Requesting threads without isolation fails to initialize, so we don't.
     */
    numThreads?: number;
    /** Enable SIMD kernels. Defaults to true; ORT falls back if unsupported. */
    simd?: boolean;
    /** Run inference in a worker so the main thread stays responsive. */
    proxy?: boolean;
    /** Override where the ORT .wasm artifacts are served from. */
    wasmPaths?: string;
    /** Largest batch passed to a single session.run. Defaults to 64. */
    maxBatchSize?: number;
}
export declare class Maia3WebModel implements Maia3Model {
    private session;
    private ort;
    private readonly modelBytes;
    private readonly executionProviders;
    private readonly opts;
    private readonly maxBatchSize;
    /** False when the loaded artifact baked batch=1 into its graph. */
    private batchCapable;
    private warnedLegacy;
    constructor(opts: Maia3WebModelOptions);
    isLoaded(): boolean;
    /** Whether the loaded graph supports batch > 1 in a single run. */
    supportsBatching(): boolean;
    load(): Promise<void>;
    infer(tokens: Float32Array, selfElo: number, oppoElo: number): Promise<InferenceOutputs>;
    inferBatch(tokens: Float32Array[], selfElos: number[], oppoElos: number[]): Promise<InferenceOutputs[]>;
    private runBatch;
    private runSingle;
    close(): Promise<void>;
}
//# sourceMappingURL=model.web.d.ts.map