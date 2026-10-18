/**
 * Continuous batching for concurrent single-position inference.
 *
 * A server handling simultaneous requests, or a UI evaluating several boards
 * at once, issues many independent `infer` calls that would each become their
 * own `session.run`. BatchScheduler collects the ones in flight at the same
 * moment and runs them as a single batch.
 *
 * It implements Maia3Model, so it can be dropped in wherever a model is
 * expected. `predictBatch` deliberately bypasses it — a caller that already
 * has its whole batch gains nothing from waiting in a queue.
 */
import { InferenceOutputs, Maia3Model } from "./model.js";
export interface BatchSchedulerOptions {
    /** Positions per batched run. Defaults to 32. */
    maxBatchSize?: number;
    /**
     * How long an idle scheduler waits for more work before running what it
     * has. Defaults to 0 — i.e. the end of the current macrotask, which
     * coalesces everything already queued without adding real latency.
     */
    maxWaitMs?: number;
}
export declare class BatchScheduler implements Maia3Model {
    private readonly inner;
    private readonly maxBatchSize;
    private readonly maxWaitMs;
    private pending;
    private timer;
    /** In-flight batched run, if any. Awaited by close(). */
    private running;
    private closed;
    constructor(inner: Maia3Model, opts?: BatchSchedulerOptions);
    /** The model this scheduler wraps. */
    unwrap(): Maia3Model;
    load(): Promise<void>;
    isLoaded(): boolean;
    /** Queue a position; it resolves when its batch runs. */
    infer(tokens: Float32Array, selfElo: number, oppoElo: number): Promise<InferenceOutputs>;
    /**
     * Pass straight through — the caller already has a full batch, so queuing
     * it would only add a tick of latency.
     */
    inferBatch(tokens: Float32Array[], selfElos: number[], oppoElos: number[]): Promise<InferenceOutputs[]>;
    private schedule;
    private flush;
    private clearTimer;
    close(): Promise<void>;
}
//# sourceMappingURL=scheduler.d.ts.map