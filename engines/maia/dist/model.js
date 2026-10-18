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
export const LOGITS_MOVE_DIM = 4352;
export const LOGITS_VALUE_DIM = 3;
export { TOKENS_PER_POSITION };
//# sourceMappingURL=model.js.map