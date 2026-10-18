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
export type VariantAlias = "5m" | "23m" | "79m";
export interface VariantInfo {
    alias: VariantAlias;
    /** Display name (matches python-side maia3 CLI). */
    name: string;
    /** Filename for the ONNX artifact, both locally and on Hugging Face. */
    onnxFile: string;
    /** Hugging Face download URL. */
    url: string;
    /** Approximate size in bytes (for progress display). */
    approxBytes: number;
    /** Whether the file is bundled in the npm package. */
    bundled: boolean;
}
export declare const VARIANTS: Record<VariantAlias, VariantInfo>;
export declare const DEFAULT_VARIANT: VariantAlias;
export declare function getVariant(alias: VariantAlias): VariantInfo;
//# sourceMappingURL=variants.d.ts.map