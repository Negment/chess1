/**
 * Maia3 — runtime-agnostic core.
 *
 * Mirrors the inference path in maia3/maia3/uci.py:score_moves. Concrete
 * runtimes wire this class with a model factory and (optionally) a download
 * helper. See index.node.ts and index.web.ts.
 */
import { HistoryInput } from "./history.js";
import { Maia3Model } from "./model.js";
import { BatchSchedulerOptions } from "./scheduler.js";
import { VariantAlias } from "./variants.js";
export interface PredictInput extends HistoryInput {
    /** Player-to-move Elo, raw integer ≈ [0, 5000]. */
    selfElo: number;
    /** Opponent Elo. Defaults to `selfElo` when omitted. */
    oppoElo?: number;
    /** Softmax temperature applied before sampling. 0 → argmax for bestMove. */
    temperature?: number;
    /** Nucleus-sampling top-p threshold (only used when temperature > 0). */
    topP?: number;
    /** Number of top candidates to score with a second-pass WDL evaluation. */
    topK?: number;
}
export interface MoveWdl {
    win: number;
    draw: number;
    loss: number;
}
export interface MoveCandidate {
    uci: string;
    probability: number;
    wdl: MoveWdl;
    winProbability: number;
}
export interface PredictionResult {
    bestMove: string;
    /** Map from UCI move (in caller's frame, NOT mirrored) → policy probability. */
    moves: Map<string, number>;
    /** Top-K candidates including a per-candidate WDL evaluation. */
    candidates: MoveCandidate[];
    /** WDL for the current position, from side-to-move POV. */
    wdl: MoveWdl;
    /** Convenience: wdl.win + 0.5 * wdl.draw. */
    winProbability: number;
}
export interface PredictBatchOptions {
    /**
     * Positions prepared and inferred per round. Bounds peak memory — each
     * position holds a 6144-float token tensor (24 KB) plus its candidates.
     * Defaults to 64.
     */
    maxBatchSize?: number;
    /**
     * topK applied to inputs that don't specify their own.
     *
     * Defaults to 0 — policy only, one forward pass per position. Every
     * candidate WDL costs an extra forward, so the default keeps a batch of N
     * at N passes rather than N*(1+K). Set it (or per-input `topK`) to opt in.
     */
    topK?: number;
    /**
     * "throw" (default) rejects on the first bad position, matching predict().
     * "collect" returns an Error in that slot instead, so one unusable FEN
     * doesn't discard the whole batch.
     */
    onError?: "throw" | "collect";
}
export interface Maia3CoreOptions {
    variant?: VariantAlias;
    /** Default temperature for predict() when none is passed. */
    temperature?: number;
    /** Default topP for predict() when none is passed. */
    topP?: number;
    /** Default topK for predict() when none is passed. */
    topK?: number;
    /**
     * Coalesce concurrent predict() calls into batched runs.
     *
     * Off by default, so single-call latency is unchanged. Turn it on when
     * many predict() calls are in flight at once (e.g. a request handler) —
     * `true` accepts the defaults, or pass `{ maxBatchSize, maxWaitMs }`.
     * predictBatch() is unaffected either way; it batches on its own.
     */
    autoBatch?: boolean | BatchSchedulerOptions;
}
/** Factory that produces an unloaded Maia3Model when called. */
export type Maia3ModelFactory = () => Promise<Maia3Model>;
/**
 * Core Maia3 driver. Use Maia3Node / Maia3Web (in index.node.ts /
 * index.web.ts) for ergonomic constructors with built-in runtime wiring.
 */
export declare class Maia3 {
    private readonly factory;
    /** What predict() talks to — the scheduler when autoBatch is on. */
    private model;
    /** The underlying model, bypassing any scheduler. Used by predictBatch. */
    private directModel;
    protected readonly variant: VariantAlias;
    private readonly defaults;
    private readonly autoBatch;
    constructor(factory: Maia3ModelFactory, options?: Maia3CoreOptions);
    load(): Promise<void>;
    isLoaded(): boolean;
    getVariant(): VariantAlias;
    close(): Promise<void>;
    predict(input: PredictInput): Promise<PredictionResult>;
    /**
     * Evaluate many positions with batched forward passes.
     *
     * Costs one batched run per `maxBatchSize` positions instead of one run per
     * position. Results are index-aligned with `inputs`.
     *
     * Note that `topK` defaults to 0 here (policy only) rather than to the
     * constructor default used by `predict()` — see PredictBatchOptions.topK.
     *
     * @example
     * ```ts
     * const results = await maia.predictBatch(
     *   fens.map((fen) => ({ fen, selfElo: 1500 }))
     * );
     * ```
     */
    predictBatch(inputs: PredictInput[], opts?: PredictBatchOptions & {
        onError?: "throw";
    }): Promise<PredictionResult[]>;
    predictBatch(inputs: PredictInput[], opts: PredictBatchOptions & {
        onError: "collect";
    }): Promise<(PredictionResult | Error)[]>;
    /**
     * @param direct when true, return the underlying model rather than the
     *   auto-batch scheduler — for callers that already have a full batch.
     */
    private requireModel;
    /**
     * Resolve inputs, tokenize, and compute the legal-move mask. Everything
     * that happens before the model sees the position.
     */
    private prepare;
    /**
     * Turn one position's raw logits into policy probabilities, a best move,
     * and the position WDL.
     */
    private decode;
    /**
     * Apply the top-K moves and tokenize the resulting positions, with Elos
     * swapped because the side to move flips after our move.
     */
    private buildCandidates;
    /**
     * Combine a decoded position with its candidate outputs. `outputs` may be a
     * flattened array covering several positions; `offset` is where this
     * position's candidates start.
     */
    private assemble;
}
export type { Maia3Model, InferenceOutputs } from "./model.js";
export { LOGITS_MOVE_DIM, LOGITS_VALUE_DIM, TOKENS_PER_POSITION } from "./model.js";
export { DEFAULT_MAX_BATCH_SIZE } from "./infer-core.js";
export { BatchScheduler } from "./scheduler.js";
export type { BatchSchedulerOptions } from "./scheduler.js";
export { STARTPOS_FEN } from "./history.js";
export type { HistoryInput } from "./history.js";
export type { VariantAlias, VariantInfo } from "./variants.js";
export { VARIANTS, DEFAULT_VARIANT, getVariant } from "./variants.js";
export { getAllMoves, getMoveToIndex, getIndexToMove, generateAllMoves, NUM_MOVES, moveToIndex, indexToMove, } from "./moves.js";
export { buildHistoryTokens, tokenizeBoard, mirrorBoard, HISTORY, PIECE_DIMS, SEQ_LEN, FEATURE_DIM, } from "./encoding.js";
export { resolveHistory } from "./history.js";
export { mirrorMove, mirrorSquare, softmax, softmax3, sampleIndex, wdlFromValueLogits, winProbabilityFromWdl, clamp, } from "./utils.js";
//# sourceMappingURL=index.d.ts.map