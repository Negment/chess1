/**
 * onnxruntime-node backed Maia3 model.
 */
import { InferenceOutputs, Maia3Model } from "./model.js";
export interface Maia3NodeModelOptions {
    modelPath: string;
    executionProviders?: string[];
    /**
     * Threads used within a single operator. Defaults to half the available
     * cores (min 1, max 8) — inference on this graph stops scaling well before
     * core count, and oversubscribing hurts when the host is also serving
     * requests. Set explicitly to override.
     */
    intraOpNumThreads?: number;
    /** Threads used across operators. Defaults to 1; the graph is sequential. */
    interOpNumThreads?: number;
    /** ORT graph optimization level. Defaults to "all". */
    graphOptimizationLevel?: "disabled" | "basic" | "extended" | "all";
    /** Reuse CPU allocations between runs. Defaults to true. */
    enableCpuMemArena?: boolean;
    /** Largest batch passed to a single session.run. Defaults to 64. */
    maxBatchSize?: number;
}
export declare class Maia3NodeModel implements Maia3Model {
    private session;
    private ort;
    private readonly modelPath;
    private readonly executionProviders;
    private readonly sessionOptions;
    private readonly maxBatchSize;
    /** False when the loaded artifact baked batch=1 into its graph. */
    private batchCapable;
    private warnedLegacy;
    constructor(opts: Maia3NodeModelOptions);
    isLoaded(): boolean;
    /** Whether the loaded graph supports batch > 1 in a single run. */
    supportsBatching(): boolean;
    load(): Promise<void>;
    infer(tokens: Float32Array, selfElo: number, oppoElo: number): Promise<InferenceOutputs>;
    inferBatch(tokens: Float32Array[], selfElos: number[], oppoElos: number[]): Promise<InferenceOutputs[]>;
    private runBatch;
    private runSingle;
    close(): Promise<void>;
}
//# sourceMappingURL=model.node.d.ts.map