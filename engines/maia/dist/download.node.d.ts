/**
 * Node-side ONNX downloader for Maia3 variants.
 *
 * Resolution order in ensureModelNode():
 *   1. If the variant is bundled and `<packageDir>/models/<file>` exists, use it.
 *   2. If `<modelDir>/<file>` exists, use it.
 *   3. Otherwise download from VARIANTS[variant].url to `<modelDir>/<file>`.
 */
import { VariantAlias, VARIANTS } from "./variants.js";
/** Bundled models live in `<package>/models`. The compiled JS sits in `<package>/dist`. */
export declare const PACKAGE_MODELS_DIR: string;
export declare const DEFAULT_MODEL_DIR: string;
export interface EnsureModelOptions {
    variant: VariantAlias;
    /** Directory to store downloaded models. Defaults to the bundled models/ dir. */
    modelDir?: string;
}
/**
 * Resolve the local path to the ONNX file for a variant, downloading it if
 * necessary. Returns the absolute file path on disk.
 */
export declare function ensureModelNode(opts: EnsureModelOptions): Promise<string>;
export { VARIANTS };
//# sourceMappingURL=download.node.d.ts.map