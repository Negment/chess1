/**
 * Maia3 model variants.
 *
 * All variants share the same I/O signature once exported to ONNX:
 *   inputs : tokens [B, 64, 96] float32, self_elo [B] int64, oppo_elo [B] int64
 *   outputs: logits_move [B, 4352] float32, logits_value [B, 3] float32
 *
 * The only differences between variants are architectural (`dim_vit`,
 * `num_heads`, …) which are baked into the ONNX file. The JS code does not
 * need to switch on architecture — it just loads a different file.
 *
 * 5m is bundled in the npm package. 23m and 79m are downloaded on first use
 * from Hugging Face.
 */
const HF_REPO_BASE = "https://huggingface.co/cemoss17/maia3-onnx/resolve/main";
export const VARIANTS = {
    "5m": {
        alias: "5m",
        name: "maia3-5m",
        onnxFile: "maia3_5m.onnx",
        url: `${HF_REPO_BASE}/maia3_5m.onnx`,
        approxBytes: 25 * 1024 * 1024,
        bundled: true,
    },
    "23m": {
        alias: "23m",
        name: "maia3-23m",
        onnxFile: "maia3_23m.onnx",
        url: `${HF_REPO_BASE}/maia3_23m.onnx`,
        approxBytes: 90 * 1024 * 1024,
        bundled: false,
    },
    "79m": {
        alias: "79m",
        name: "maia3-79m",
        onnxFile: "maia3_79m.onnx",
        url: `${HF_REPO_BASE}/maia3_79m.onnx`,
        approxBytes: 310 * 1024 * 1024,
        bundled: false,
    },
};
export const DEFAULT_VARIANT = "5m";
export function getVariant(alias) {
    const v = VARIANTS[alias];
    if (!v)
        throw new Error(`Unknown Maia3 variant: ${alias}`);
    return v;
}
//# sourceMappingURL=variants.js.map