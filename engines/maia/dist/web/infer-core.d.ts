/**
 * Runtime-agnostic helpers shared by model.node.ts and model.web.ts.
 *
 * The two backends differ only in which onnxruntime package they import and
 * whether the model is loaded from a path or from bytes. Everything about
 * packing a batch into tensors and slicing the results back apart is
 * identical, so it lives here.
 */
import { InferenceOutputs } from "./model.js";
/**
 * Largest batch handed to a single session.run. Batches beyond this are
 * chunked, so a caller can pass 10k positions without trying to allocate a
 * single multi-hundred-megabyte tensor (each position is 6144 floats = 24 KB,
 * so 64 ≈ 1.5 MB of input).
 */
export declare const DEFAULT_MAX_BATCH_SIZE = 64;
/** Minimal structural type for the bits of the ort namespace we use. */
export interface OrtTensorFactory {
    Tensor: new (type: string, data: Float32Array | BigInt64Array, dims: number[]) => unknown;
}
/** Minimal structural type for the bits of an ORT session we use. */
export interface OrtSessionLike {
    outputMetadata?: readonly {
        name: string;
        shape?: ReadonlyArray<number | string>;
    }[];
}
export declare function validateBatch(tokens: Float32Array[], selfElos: number[], oppoElos: number[]): void;
/**
 * Pack a batch of positions into the three input tensors the graph expects:
 * tokens [B, 64, 96] float32, self_elo [B] int64, oppo_elo [B] int64.
 */
export declare function buildBatchFeeds(ort: OrtTensorFactory, tokens: Float32Array[], selfElos: number[], oppoElos: number[]): Record<string, unknown>;
/**
 * Slice a batched session.run result into per-position outputs.
 *
 * Returns copies rather than subarray views, matching what the single-position
 * `infer()` path has always handed back: each result owns its buffer, so a
 * caller can mutate or transfer one without touching its neighbours. The copy
 * is ~17 KB per position against a multi-millisecond forward pass.
 */
export declare function splitBatchOutputs(logitsMove: Float32Array, logitsValue: Float32Array, batchSize: number): InferenceOutputs[];
/**
 * Probe whether the loaded graph really supports batch > 1.
 *
 * Artifacts exported before the dynamic-batch fix declare a *static* output
 * shape of [1, 4352] and blow up at run time with
 * "Reshape node 'gemm_input_reshape': Input shape:{2,64,256}, requested
 * shape:{64,256}". A symbolic (string) dim 0 on the outputs means the graph
 * was exported correctly. When metadata is unavailable we optimistically
 * assume batching works and let a run-time error surface normally.
 */
export declare function supportsDynamicBatch(session: OrtSessionLike): boolean;
export declare const LEGACY_MODEL_WARNING: string;
/** Split [0, total) into [start, end) chunks of at most `size`. */
export declare function chunkRanges(total: number, size: number): Generator<[number, number]>;
//# sourceMappingURL=infer-core.d.ts.map