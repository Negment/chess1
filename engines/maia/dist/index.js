/**
 * Maia3 — runtime-agnostic core.
 *
 * Mirrors the inference path in maia3/maia3/uci.py:score_moves. Concrete
 * runtimes wire this class with a model factory and (optionally) a download
 * helper. See index.node.ts and index.web.ts.
 */
import { Chess } from "chess.js";
import { buildHistoryTokens, TOKENS_PER_POSITION } from "./encoding.js";
import { resolveHistory } from "./history.js";
import { getMoveToIndex, NUM_MOVES } from "./moves.js";
import { DEFAULT_MAX_BATCH_SIZE } from "./infer-core.js";
import { BatchScheduler } from "./scheduler.js";
import { argmax, clamp, mirrorMove, sampleIndex, softmax, wdlFromValueLogits, winProbabilityFromWdl, } from "./utils.js";
import { DEFAULT_VARIANT } from "./variants.js";
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_TOP_P = 1.0;
const DEFAULT_TOP_K = 5;
const ELO_MIN = 0;
const ELO_MAX = 5000;
/**
 * Core Maia3 driver. Use Maia3Node / Maia3Web (in index.node.ts /
 * index.web.ts) for ergonomic constructors with built-in runtime wiring.
 */
export class Maia3 {
    factory;
    /** What predict() talks to — the scheduler when autoBatch is on. */
    model = null;
    /** The underlying model, bypassing any scheduler. Used by predictBatch. */
    directModel = null;
    variant;
    defaults;
    autoBatch;
    constructor(factory, options = {}) {
        this.factory = factory;
        this.variant = options.variant ?? DEFAULT_VARIANT;
        this.defaults = {
            temperature: options.temperature ?? DEFAULT_TEMPERATURE,
            topP: options.topP ?? DEFAULT_TOP_P,
            topK: options.topK ?? DEFAULT_TOP_K,
        };
        this.autoBatch =
            options.autoBatch === true
                ? {}
                : options.autoBatch === false || options.autoBatch === undefined
                    ? null
                    : options.autoBatch;
    }
    async load() {
        if (this.model && this.model.isLoaded())
            return;
        if (!this.model) {
            this.directModel = await this.factory();
            this.model = this.autoBatch
                ? new BatchScheduler(this.directModel, this.autoBatch)
                : this.directModel;
        }
        await this.model.load();
    }
    isLoaded() {
        return this.model?.isLoaded() ?? false;
    }
    getVariant() {
        return this.variant;
    }
    async close() {
        if (this.model) {
            // Closing the scheduler settles queued callers, then closes the inner
            // model — so there is nothing extra to do for directModel.
            await this.model.close();
            this.model = null;
            this.directModel = null;
        }
    }
    async predict(input) {
        const model = this.requireModel("predict");
        const prepared = this.prepare(input, this.defaults.topK);
        const out = await model.infer(prepared.tokens, prepared.selfElo, prepared.oppoElo);
        const decoded = this.decode(prepared, out);
        const candidates = this.buildCandidates(prepared, decoded.ranked);
        const candidateOutputs = await model.inferBatch(candidates.tokens, candidates.selfElos, candidates.oppoElos);
        return this.assemble(decoded, candidates, candidateOutputs, 0);
    }
    async predictBatch(inputs, opts = {}) {
        const model = this.requireModel("predictBatch", true);
        if (inputs.length === 0)
            return [];
        const maxBatchSize = Math.max(1, opts.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE);
        const fallbackTopK = opts.topK ?? 0;
        const collectErrors = opts.onError === "collect";
        const results = new Array(inputs.length);
        // Work in chunks so that peak memory stays bounded by maxBatchSize rather
        // than by inputs.length — a 10k-position sweep would otherwise hold 10k
        // token tensors (24 KB each) live at once.
        for (let start = 0; start < inputs.length; start += maxBatchSize) {
            const end = Math.min(start + maxBatchSize, inputs.length);
            // ---- 1. Prepare, isolating per-position failures -------------------
            const prepared = new Array(end - start);
            for (let i = start; i < end; i++) {
                try {
                    prepared[i - start] = this.prepare(inputs[i], fallbackTopK);
                }
                catch (err) {
                    if (!collectErrors)
                        throw err;
                    prepared[i - start] = null;
                    results[i] = err instanceof Error ? err : new Error(String(err));
                }
            }
            const live = [];
            for (let i = 0; i < prepared.length; i++) {
                const p = prepared[i];
                if (p)
                    live.push({ index: start + i, prepared: p });
            }
            if (live.length === 0)
                continue;
            // ---- 2. One batched pass over every position in the chunk ----------
            const outs = await model.inferBatch(live.map((l) => l.prepared.tokens), live.map((l) => l.prepared.selfElo), live.map((l) => l.prepared.oppoElo));
            const decoded = live.map((l, i) => this.decode(l.prepared, outs[i]));
            // ---- 3. Flatten every position's candidates into ONE more pass -----
            // Candidate counts vary (a position can have fewer legal moves than K),
            // so we track each position's offset into the flattened arrays.
            const flatTokens = [];
            const flatSelfElos = [];
            const flatOppoElos = [];
            const perPosition = live.map((l, i) => {
                const c = this.buildCandidates(l.prepared, decoded[i].ranked);
                const offset = flatTokens.length;
                flatTokens.push(...c.tokens);
                flatSelfElos.push(...c.selfElos);
                flatOppoElos.push(...c.oppoElos);
                return { candidates: c, offset };
            });
            const flatOutputs = flatTokens.length > 0
                ? await model.inferBatch(flatTokens, flatSelfElos, flatOppoElos)
                : [];
            for (let i = 0; i < live.length; i++) {
                results[live[i].index] = this.assemble(decoded[i], perPosition[i].candidates, flatOutputs, perPosition[i].offset);
            }
        }
        return results;
    }
    /**
     * @param direct when true, return the underlying model rather than the
     *   auto-batch scheduler — for callers that already have a full batch.
     */
    requireModel(caller, direct = false) {
        if (!this.model || !this.model.isLoaded()) {
            throw new Error(`Maia3: call load() before ${caller}().`);
        }
        return direct ? (this.directModel ?? this.model) : this.model;
    }
    /**
     * Resolve inputs, tokenize, and compute the legal-move mask. Everything
     * that happens before the model sees the position.
     */
    prepare(input, fallbackTopK) {
        const temperature = input.temperature ?? this.defaults.temperature;
        const topP = input.topP ?? this.defaults.topP;
        const topK = input.topK ?? fallbackTopK;
        const selfElo = clamp(input.selfElo, ELO_MIN, ELO_MAX);
        const oppoElo = clamp(input.oppoElo ?? input.selfElo, ELO_MIN, ELO_MAX);
        const boards = resolveHistory(input);
        const current = boards[boards.length - 1];
        const mirrored = current.turn() === "b";
        // When the caller passes explicit prior history (priorFens or priorMoves),
        // we propagate it into candidate evaluations — matching python-side
        // `use_uci_history=True`. Without explicit history we tokenize each
        // candidate from scratch, matching the python default.
        const hasExplicitHistory = (Array.isArray(input.priorFens) && input.priorFens.length > 0) ||
            (Array.isArray(input.priorMoves) && input.priorMoves.length > 0);
        const tokens = buildHistoryTokens(boards);
        if (tokens.length !== TOKENS_PER_POSITION) {
            throw new Error(`internal: token tensor wrong length (${tokens.length})`);
        }
        const moveToIndex = getMoveToIndex();
        const legal = current.moves({ verbose: true });
        const mask = new Uint8Array(NUM_MOVES);
        const legalEntries = [];
        for (const m of legal) {
            const promo = m.promotion ?? "";
            const uci = `${m.from}${m.to}${promo}`;
            const lookup = mirrored ? mirrorMove(uci) : uci;
            const idx = moveToIndex.get(lookup);
            if (idx === undefined)
                continue;
            mask[idx] = 1;
            legalEntries.push({ uci, lookup, index: idx });
        }
        if (legalEntries.length === 0) {
            throw new Error(`Maia3.predict: no legal moves at FEN ${current.fen()}; cannot recommend a move`);
        }
        return {
            tokens,
            boards,
            current,
            hasExplicitHistory,
            legalEntries,
            mask,
            selfElo,
            oppoElo,
            temperature,
            topP,
            topK,
        };
    }
    /**
     * Turn one position's raw logits into policy probabilities, a best move,
     * and the position WDL.
     */
    decode(prepared, out) {
        const { mask, legalEntries, temperature, topP } = prepared;
        // ---- Temperature-scaled, masked softmax over policy ------------------
        const t = Math.max(temperature, 1e-9);
        const scale = temperature > 0 ? 1 / t : 1;
        const scaledLogits = new Float64Array(NUM_MOVES);
        for (let i = 0; i < NUM_MOVES; i++) {
            scaledLogits[i] = mask[i] ? out.logitsMove[i] * scale : -Infinity;
        }
        const probs = softmax(scaledLogits, mask);
        // ---- Moves map (caller frame) and bestMove ---------------------------
        const movesMap = new Map();
        for (const e of legalEntries) {
            movesMap.set(e.uci, probs[e.index]);
        }
        const sortedMoves = new Map([...movesMap.entries()].sort((a, b) => b[1] - a[1]));
        let bestMove;
        if (temperature === 0) {
            const bestIdx = argmax(out.logitsMove.map((v, i) => (mask[i] ? v : -Infinity)));
            const bestEntry = legalEntries.find((e) => e.index === bestIdx);
            bestMove = bestEntry.uci;
        }
        else {
            // Sample over legal entries using their post-softmax probabilities.
            const legalProbs = legalEntries.map((e) => probs[e.index]);
            const choice = sampleIndex(legalProbs, topP);
            bestMove = legalEntries[choice].uci;
        }
        const ranked = legalEntries
            .map((e) => ({ entry: e, p: probs[e.index] }))
            .sort((a, b) => b.p - a.p);
        // Current-position WDL needs no inversion — it is already side-to-move POV.
        const wdl = wdlFromValueLogits(out.logitsValue);
        return {
            prepared,
            bestMove,
            sortedMoves,
            ranked,
            wdl,
            winProbability: winProbabilityFromWdl(wdl),
        };
    }
    /**
     * Apply the top-K moves and tokenize the resulting positions, with Elos
     * swapped because the side to move flips after our move.
     */
    buildCandidates(prepared, ranked) {
        const { current, boards, hasExplicitHistory, selfElo, oppoElo, topK } = prepared;
        const k = Math.min(topK, ranked.length);
        const topEntries = ranked.slice(0, k);
        const tokens = [];
        const selfElos = [];
        const oppoElos = [];
        for (const { entry } of topEntries) {
            const next = new Chess(current.fen());
            const moveResult = next.move(entry.uci, { strict: false });
            if (moveResult === null) {
                throw new Error(`Maia3.predict: top candidate ${entry.uci} did not apply on ${current.fen()}`);
            }
            let candidateHistory;
            if (hasExplicitHistory) {
                candidateHistory = [...boards, next];
                if (candidateHistory.length > 8) {
                    candidateHistory = candidateHistory.slice(candidateHistory.length - 8);
                }
            }
            else {
                candidateHistory = [next];
            }
            tokens.push(buildHistoryTokens(candidateHistory));
            selfElos.push(oppoElo); // side-to-move flips
            oppoElos.push(selfElo);
        }
        return { tokens, selfElos, oppoElos, topEntries };
    }
    /**
     * Combine a decoded position with its candidate outputs. `outputs` may be a
     * flattened array covering several positions; `offset` is where this
     * position's candidates start.
     */
    assemble(decoded, candidates, outputs, offset) {
        const moveCandidates = candidates.topEntries.map((te, i) => {
            const wdlAfter = wdlFromValueLogits(outputs[offset + i].logitsValue);
            // The WDL above is from the perspective of the player to move AFTER
            // our candidate move (i.e. the opponent). Invert to caller's POV.
            const wdl = {
                win: wdlAfter.loss,
                draw: wdlAfter.draw,
                loss: wdlAfter.win,
            };
            return {
                uci: te.entry.uci,
                probability: te.p,
                wdl,
                winProbability: winProbabilityFromWdl(wdl),
            };
        });
        return {
            bestMove: decoded.bestMove,
            moves: decoded.sortedMoves,
            candidates: moveCandidates,
            wdl: decoded.wdl,
            winProbability: decoded.winProbability,
        };
    }
}
export { LOGITS_MOVE_DIM, LOGITS_VALUE_DIM, TOKENS_PER_POSITION } from "./model.js";
export { DEFAULT_MAX_BATCH_SIZE } from "./infer-core.js";
export { BatchScheduler } from "./scheduler.js";
export { STARTPOS_FEN } from "./history.js";
export { VARIANTS, DEFAULT_VARIANT, getVariant } from "./variants.js";
export { getAllMoves, getMoveToIndex, getIndexToMove, generateAllMoves, NUM_MOVES, moveToIndex, indexToMove, } from "./moves.js";
export { buildHistoryTokens, tokenizeBoard, mirrorBoard, HISTORY, PIECE_DIMS, SEQ_LEN, FEATURE_DIM, } from "./encoding.js";
export { resolveHistory } from "./history.js";
export { mirrorMove, mirrorSquare, softmax, softmax3, sampleIndex, wdlFromValueLogits, winProbabilityFromWdl, clamp, } from "./utils.js";
//# sourceMappingURL=index.js.map