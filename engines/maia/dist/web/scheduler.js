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
const DEFAULT_SCHEDULER_BATCH_SIZE = 32;
export class BatchScheduler {
    inner;
    maxBatchSize;
    maxWaitMs;
    pending = [];
    timer = null;
    /** In-flight batched run, if any. Awaited by close(). */
    running = null;
    closed = false;
    constructor(inner, opts = {}) {
        this.inner = inner;
        this.maxBatchSize = Math.max(1, opts.maxBatchSize ?? DEFAULT_SCHEDULER_BATCH_SIZE);
        this.maxWaitMs = Math.max(0, opts.maxWaitMs ?? 0);
    }
    /** The model this scheduler wraps. */
    unwrap() {
        return this.inner;
    }
    async load() {
        return this.inner.load();
    }
    isLoaded() {
        return this.inner.isLoaded();
    }
    /** Queue a position; it resolves when its batch runs. */
    infer(tokens, selfElo, oppoElo) {
        if (this.closed) {
            return Promise.reject(new Error("BatchScheduler: closed."));
        }
        return new Promise((resolve, reject) => {
            this.pending.push({ tokens, selfElo, oppoElo, resolve, reject });
            this.schedule();
        });
    }
    /**
     * Pass straight through — the caller already has a full batch, so queuing
     * it would only add a tick of latency.
     */
    inferBatch(tokens, selfElos, oppoElos) {
        if (this.closed) {
            return Promise.reject(new Error("BatchScheduler: closed."));
        }
        return this.inner.inferBatch(tokens, selfElos, oppoElos);
    }
    schedule() {
        // While a batch is in flight, new arrivals simply accumulate; the flush
        // that is running will pick them up when it finishes. This is what keeps
        // a slow batch from blocking admission of later calls.
        if (this.running)
            return;
        if (this.pending.length >= this.maxBatchSize) {
            this.clearTimer();
            void this.flush();
            return;
        }
        if (this.timer === null) {
            this.timer = setTimeout(() => {
                this.timer = null;
                void this.flush();
            }, this.maxWaitMs);
            // Don't let a pending flush keep a Node process alive.
            this.timer.unref?.();
        }
    }
    flush() {
        if (this.running)
            return this.running;
        this.clearTimer();
        const batch = this.pending.splice(0, this.maxBatchSize);
        if (batch.length === 0)
            return Promise.resolve();
        const run = (async () => {
            try {
                const outputs = await this.inner.inferBatch(batch.map((c) => c.tokens), batch.map((c) => c.selfElo), batch.map((c) => c.oppoElo));
                for (let i = 0; i < batch.length; i++)
                    batch[i].resolve(outputs[i]);
            }
            catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                for (const call of batch)
                    call.reject(error);
            }
        })().finally(() => {
            this.running = null;
            // Anything that arrived while we were running goes out immediately.
            if (this.pending.length > 0 && !this.closed)
                this.schedule();
        });
        this.running = run;
        return run;
    }
    clearTimer() {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    async close() {
        this.closed = true;
        this.clearTimer();
        // Let an in-flight run settle its callers before releasing the session.
        if (this.running) {
            try {
                await this.running;
            }
            catch {
                // Already reported to that batch's callers.
            }
        }
        // Anything still queued will never run — fail it rather than hang.
        const orphaned = this.pending;
        this.pending = [];
        for (const call of orphaned) {
            call.reject(new Error("BatchScheduler: closed before this call ran."));
        }
        await this.inner.close();
    }
}
//# sourceMappingURL=scheduler.js.map