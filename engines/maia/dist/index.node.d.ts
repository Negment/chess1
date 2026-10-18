/**
 * Public Maia3 entry point for Node.js.
 *
 *   import { Maia3 } from "maia3-js";
 *
 * The constructor accepts a variant alias plus optional sampling / cache
 * defaults; weights are resolved via ensureModelNode and loaded into an
 * onnxruntime-node session.
 */
import { Maia3 as Maia3Core, Maia3CoreOptions } from "./index.js";
import { VariantAlias } from "./variants.js";
export * from "./index.js";
export interface Maia3NodeOptions extends Maia3CoreOptions {
    variant?: VariantAlias;
    /** Explicit ONNX file path (overrides bundled / download). */
    modelPath?: string;
    /** Cache directory for downloaded variants. */
    modelDir?: string;
    /** Execution providers passed through to onnxruntime-node. */
    executionProviders?: string[];
    /**
     * Threads used within a single operator. Defaults to half the available
     * cores (min 1, max 8) — throughput on this graph peaks well below core
     * count and degrades past it.
     */
    intraOpNumThreads?: number;
    /** Threads used across operators. Defaults to 1; the graph is sequential. */
    interOpNumThreads?: number;
    /** ORT graph optimization level. Defaults to "all". */
    graphOptimizationLevel?: "disabled" | "basic" | "extended" | "all";
    /** Reuse CPU allocations between runs. Defaults to true. */
    enableCpuMemArena?: boolean;
    /** Largest batch passed to a single session.run (default 64). */
    maxBatchSize?: number;
}
/**
 * Maia3 inference for Node.js. Constructor + `load()` resolves the ONNX
 * weights (bundled, cached, or downloaded) and prepares a session.
 *
 * @example
 * ```ts
 * const maia = new Maia3({ variant: "5m" });
 * await maia.load();
 * const r = await maia.predict({ fen: STARTPOS_FEN, selfElo: 1500 });
 * ```
 */
export declare class Maia3 extends Maia3Core {
    constructor(opts?: Maia3NodeOptions);
}
export { ensureModelNode } from "./download.node.js";
export { Maia3NodeModel } from "./model.node.js";
//# sourceMappingURL=index.node.d.ts.map