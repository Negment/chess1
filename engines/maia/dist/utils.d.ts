/**
 * Shared utilities for Maia3.
 *
 * Mirror helpers and softmax are ported from maia2-js. WDL / sampling are
 * specific to Maia3 (3-class value head, top-p multinomial sampling).
 */
/** Mirror a square vertically. `e7 → e2`, `a1 → a8`. */
export declare function mirrorSquare(square: string): string;
/** Mirror a UCI move vertically (preserves promotion piece). */
export declare function mirrorMove(uci: string): string;
/**
 * Numerically stable softmax. When `mask` is provided, entries where
 * `mask[i] === 0` are treated as -Infinity (i.e. excluded from the
 * distribution and assigned zero probability).
 */
export declare function softmax(logits: ArrayLike<number>, mask?: ArrayLike<number>): number[];
/** Three-element softmax used for the WDL head. */
export declare function softmax3(logits: ArrayLike<number>): [number, number, number];
/**
 * Convert the value-head logits to a WDL distribution.
 *
 * The maia3 value head outputs three logits in the order [loss, draw, win]
 * from the side-to-move's perspective (matches uci.py:wdl_from_value_logits).
 */
export declare function wdlFromValueLogits(logits: ArrayLike<number>): {
    win: number;
    draw: number;
    loss: number;
};
/** Convert a WDL distribution to a single win-probability scalar. */
export declare function winProbabilityFromWdl(wdl: {
    win: number;
    draw: number;
}): number;
/**
 * Sample an index from `probs` using nucleus (top-p) sampling.
 *
 * If `topP < 1`, retains the smallest set of top-probability indices whose
 * cumulative probability is ≥ topP (always keeping the top-1), renormalizes,
 * then samples multinomially. With topP === 1 it is a plain multinomial
 * sample over the full distribution.
 *
 * Ported from maia3/maia3/uci.py:sample_from_logits.
 */
export declare function sampleIndex(probs: number[], topP: number, rand?: () => number): number;
/** Argmax over a typed or plain array. */
export declare function argmax(arr: ArrayLike<number>): number;
/** Clamp `x` to the closed range [lo, hi]. */
export declare function clamp(x: number, lo: number, hi: number): number;
//# sourceMappingURL=utils.d.ts.map