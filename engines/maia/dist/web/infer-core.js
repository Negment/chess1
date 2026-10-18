/**
 * Runtime-agnostic helpers shared by model.node.ts and model.web.ts.
 *
 * The two backends differ only in which onnxruntime package they import and
 * whether the model is loaded from a path or from bytes. Everything about
 * packing a batch into tensors and slicing the results back apart is
 * identical, so it lives here.
 */
import { LOGITS_MOVE_DIM, LOGITS_VALUE_DIM, TOKENS_PER_POSITION, } from "./model.js";
/**
 * Largest batch handed to a single session.run. Batches beyond this are
 * chunked, so a caller can pass 10k positions without trying to allocate a
 * single multi-hundred-megabyte tensor (each position is 6144 floats = 24 KB,
 * so 64 ≈ 1.5 MB of input).
 */
export const DEFAULT_MAX_BATCH_SIZE = 64;
export function validateBatch(tokens, selfElos, oppoElos) {
    if (selfElos.length !== tokens.length || oppoElos.length !== tokens.length) {
        throw new Error("inferBatch: tokens / selfElos / oppoElos length mismatch");
    }
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].length !== TOKENS_PER_POSITION) {
            throw new Error(`inferBatch: tokens[${i}] length ${tokens[i].length} ≠ ${TOKENS_PER_POSITION}`);
        }
    }
}
/**
 * Pack a batch of positions into the three input tensors the graph expects:
 * tokens [B, 64, 96] float32, self_elo [B] int64, oppo_elo [B] int64.
 */
export function buildBatchFeeds(ort, tokens, selfElos, oppoElos) {
    const batchSize = tokens.length;
    // A batch of one can reference the caller's array directly — no copy.
    let packed;
    if (batchSize === 1) {
        packed = tokens[0];
    }
    else {
        packed = new Float32Array(batchSize * TOKENS_PER_POSITION);
        for (let i = 0; i < batchSize; i++) {
            packed.set(tokens[i], i * TOKENS_PER_POSITION);
        }
    }
    const self = new BigInt64Array(batchSize);
    const oppo = new BigInt64Array(batchSize);
    for (let i = 0; i < batchSize; i++) {
        self[i] = BigInt(Math.round(selfElos[i]));
        oppo[i] = BigInt(Math.round(oppoElos[i]));
    }
    return {
        tokens: new ort.Tensor("float32", packed, [batchSize, 64, 96]),
        self_elo: new ort.Tensor("int64", self, [batchSize]),
        oppo_elo: new ort.Tensor("int64", oppo, [batchSize]),
    };
}
/**
 * Slice a batched session.run result into per-position outputs.
 *
 * Returns copies rather than subarray views, matching what the single-position
 * `infer()` path has always handed back: each result owns its buffer, so a
 * caller can mutate or transfer one without touching its neighbours. The copy
 * is ~17 KB per position against a multi-millisecond forward pass.
 */
export function splitBatchOutputs(logitsMove, logitsValue, batchSize) {
    const expectedMove = batchSize * LOGITS_MOVE_DIM;
    const expectedValue = batchSize * LOGITS_VALUE_DIM;
    if (logitsMove.length < expectedMove || logitsValue.length < expectedValue) {
        throw new Error(`inferBatch: model returned ${logitsMove.length}/${logitsValue.length} ` +
            `logits for batch ${batchSize}, expected ${expectedMove}/${expectedValue}. ` +
            `The ONNX artifact may not support batching.`);
    }
    const out = new Array(batchSize);
    for (let i = 0; i < batchSize; i++) {
        out[i] = {
            logitsMove: logitsMove.slice(i * LOGITS_MOVE_DIM, (i + 1) * LOGITS_MOVE_DIM),
            logitsValue: logitsValue.slice(i * LOGITS_VALUE_DIM, (i + 1) * LOGITS_VALUE_DIM),
        };
    }
    return out;
}
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
export function supportsDynamicBatch(session) {
    const metadata = session.outputMetadata;
    if (!metadata || metadata.length === 0)
        return true;
    for (const value of metadata) {
        const shape = value.shape;
        if (!shape || shape.length === 0)
            continue;
        if (typeof shape[0] === "number")
            return false;
    }
    return true;
}
export const LEGACY_MODEL_WARNING = "maia3-js: this ONNX artifact was exported with a fixed batch size of 1, " +
    "so batched inference is falling back to sequential runs. Delete your " +
    "cached model directory to pick up the batch-enabled artifact.";
/** Split [0, total) into [start, end) chunks of at most `size`. */
export function* chunkRanges(total, size) {
    for (let start = 0; start < total; start += size) {
        yield [start, Math.min(start + size, total)];
    }
}
//# sourceMappingURL=infer-core.js.map