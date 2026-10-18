/**
 * Runtime-agnostic interface for a Maia3 ONNX session.
 *
 * Two concrete implementations exist:
 *   - model.node.ts  → wraps onnxruntime-node, loads from a file path
 *   - model.web.ts   → wraps onnxruntime-web,  loads from an ArrayBuffer
 *
 * Both accept the same logical inputs/outputs:
 *   inputs : tokens [B, 64, 96] float32, self_elo [B] int64, oppo_elo [B] int64
 *   outputs: logits_move [B, 4352] float32, logits_value [B, 3] float32
 */
import { TOKENS_PER_POSITION } from "./encoding.js";
export declare const LOGITS_MOVE_DIM = 4352;
export declare const LOGITS_VALUE_DIM = 3;
export { TOKENS_PER_POSITION };
export interface InferenceOutputs {
    /** Float32Array of length 4352. */
    logitsMove: Float32Array;
    /** Float32Array of length 3 — [loss, draw, win]. */
    logitsValue: Float32Array;
}
export interface Maia3Model {
    load(): Promise<void>;
    isLoaded(): boolean;
    infer(tokens: Float32Array, selfElo: number, oppoElo: number): Promise<InferenceOutputs>;
    inferBatch(tokens: Float32Array[], selfElos: number[], oppoElos: number[]): Promise<InferenceOutputs[]>;
    close(): Promise<void>;
}
//# sourceMappingURL=model.d.ts.map