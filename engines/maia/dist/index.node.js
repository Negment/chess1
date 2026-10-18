/**
 * Public Maia3 entry point for Node.js.
 *
 *   import { Maia3 } from "maia3-js";
 *
 * The constructor accepts a variant alias plus optional sampling / cache
 * defaults; weights are resolved via ensureModelNode and loaded into an
 * onnxruntime-node session.
 */
import { Maia3 as Maia3Core } from "./index.js";
import { Maia3NodeModel } from "./model.node.js";
import { ensureModelNode } from "./download.node.js";
import { DEFAULT_VARIANT } from "./variants.js";
export * from "./index.js";
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
export class Maia3 extends Maia3Core {
    constructor(opts = {}) {
        const variant = opts.variant ?? DEFAULT_VARIANT;
        const factory = async () => {
            const modelPath = opts.modelPath ?? (await ensureModelNode({ variant, modelDir: opts.modelDir }));
            return new Maia3NodeModel({
                modelPath,
                executionProviders: opts.executionProviders,
                intraOpNumThreads: opts.intraOpNumThreads,
                interOpNumThreads: opts.interOpNumThreads,
                graphOptimizationLevel: opts.graphOptimizationLevel,
                enableCpuMemArena: opts.enableCpuMemArena,
                maxBatchSize: opts.maxBatchSize,
            });
        };
        super(factory, { ...opts, variant });
    }
}
export { ensureModelNode } from "./download.node.js";
export { Maia3NodeModel } from "./model.node.js";
//# sourceMappingURL=index.node.js.map