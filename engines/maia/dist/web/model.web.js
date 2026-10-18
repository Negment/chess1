/**
 * onnxruntime-web backed Maia3 model.
 *
 * Accepts an ArrayBuffer (typically produced by download.web.ts) so that the
 * browser can pull weights via fetch + Cache Storage and hand the raw bytes
 * directly to ORT.
 */
import { LOGITS_MOVE_DIM, LOGITS_VALUE_DIM, TOKENS_PER_POSITION, } from "./model.js";
import { buildBatchFeeds, chunkRanges, DEFAULT_MAX_BATCH_SIZE, LEGACY_MODEL_WARNING, splitBatchOutputs, supportsDynamicBatch, validateBatch, } from "./infer-core.js";
function defaultNumThreads() {
    // `crossOriginIsolated` is undefined outside browsers and false without
    // COOP/COEP; either way threads are unavailable.
    const isolated = typeof globalThis !== "undefined" &&
        globalThis.crossOriginIsolated === true;
    if (!isolated)
        return 1;
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 1 : 1;
    return Math.max(1, Math.min(4, Math.floor(cores / 2)));
}
export class Maia3WebModel {
    session = null;
    ort = null;
    modelBytes;
    executionProviders;
    opts;
    maxBatchSize;
    /** False when the loaded artifact baked batch=1 into its graph. */
    batchCapable = true;
    warnedLegacy = false;
    constructor(opts) {
        this.modelBytes = opts.modelBytes;
        this.executionProviders = opts.executionProviders ?? ["wasm"];
        this.opts = opts;
        this.maxBatchSize = Math.max(1, opts.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE);
    }
    isLoaded() {
        return this.session !== null;
    }
    /** Whether the loaded graph supports batch > 1 in a single run. */
    supportsBatching() {
        return this.batchCapable;
    }
    async load() {
        if (this.session)
            return;
        this.ort = await import("onnxruntime-web");
        const wasm = this.ort.env.wasm;
        wasm.simd = this.opts.simd ?? true;
        wasm.numThreads = this.opts.numThreads ?? defaultNumThreads();
        if (this.opts.proxy !== undefined)
            wasm.proxy = this.opts.proxy;
        if (this.opts.wasmPaths !== undefined)
            wasm.wasmPaths = this.opts.wasmPaths;
        const bytes = this.modelBytes instanceof Uint8Array
            ? this.modelBytes
            : new Uint8Array(this.modelBytes);
        this.session = await this.ort.InferenceSession.create(bytes, {
            executionProviders: this.executionProviders,
            graphOptimizationLevel: "all",
        });
        this.batchCapable = supportsDynamicBatch(this.session);
    }
    async infer(tokens, selfElo, oppoElo) {
        return this.runSingle(tokens, selfElo, oppoElo);
    }
    async inferBatch(tokens, selfElos, oppoElos) {
        if (!this.session || !this.ort) {
            throw new Error("Maia3WebModel: call load() first.");
        }
        validateBatch(tokens, selfElos, oppoElos);
        const batchSize = tokens.length;
        if (batchSize === 0)
            return [];
        if (!this.batchCapable) {
            if (!this.warnedLegacy) {
                this.warnedLegacy = true;
                console.warn(LEGACY_MODEL_WARNING);
            }
            const outputs = new Array(batchSize);
            for (let i = 0; i < batchSize; i++) {
                outputs[i] = await this.runSingle(tokens[i], selfElos[i], oppoElos[i]);
            }
            return outputs;
        }
        const outputs = new Array(batchSize);
        for (const [start, end] of chunkRanges(batchSize, this.maxBatchSize)) {
            const chunk = await this.runBatch(tokens.slice(start, end), selfElos.slice(start, end), oppoElos.slice(start, end));
            for (let i = 0; i < chunk.length; i++)
                outputs[start + i] = chunk[i];
        }
        return outputs;
    }
    async runBatch(tokens, selfElos, oppoElos) {
        const feeds = buildBatchFeeds(this.ort, tokens, selfElos, oppoElos);
        const results = await this.session.run(feeds);
        return splitBatchOutputs(results.logits_move.data, results.logits_value.data, tokens.length);
    }
    async runSingle(tokens, selfElo, oppoElo) {
        if (!this.session || !this.ort) {
            throw new Error("Maia3WebModel: call load() first.");
        }
        if (tokens.length !== TOKENS_PER_POSITION) {
            throw new Error(`tokens length ${tokens.length} ≠ ${TOKENS_PER_POSITION}`);
        }
        const feeds = {
            tokens: new this.ort.Tensor("float32", tokens, [1, 64, 96]),
            self_elo: new this.ort.Tensor("int64", BigInt64Array.from([BigInt(Math.round(selfElo))]), [1]),
            oppo_elo: new this.ort.Tensor("int64", BigInt64Array.from([BigInt(Math.round(oppoElo))]), [1]),
        };
        const results = await this.session.run(feeds);
        return {
            logitsMove: results.logits_move.data.slice(0, LOGITS_MOVE_DIM),
            logitsValue: results.logits_value.data.slice(0, LOGITS_VALUE_DIM),
        };
    }
    async close() {
        if (this.session) {
            await this.session.release?.();
            this.session = null;
        }
    }
}
//# sourceMappingURL=model.web.js.map