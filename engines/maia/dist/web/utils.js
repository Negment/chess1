/**
 * Shared utilities for Maia3.
 *
 * Mirror helpers and softmax are ported from maia2-js. WDL / sampling are
 * specific to Maia3 (3-class value head, top-p multinomial sampling).
 */
/** Mirror a square vertically. `e7 → e2`, `a1 → a8`. */
export function mirrorSquare(square) {
    const file = square[0];
    const rank = 9 - parseInt(square[1], 10);
    return `${file}${rank}`;
}
/** Mirror a UCI move vertically (preserves promotion piece). */
export function mirrorMove(uci) {
    const from = mirrorSquare(uci.slice(0, 2));
    const to = mirrorSquare(uci.slice(2, 4));
    return from + to + uci.slice(4);
}
/**
 * Numerically stable softmax. When `mask` is provided, entries where
 * `mask[i] === 0` are treated as -Infinity (i.e. excluded from the
 * distribution and assigned zero probability).
 */
export function softmax(logits, mask) {
    const n = logits.length;
    const out = new Array(n).fill(0);
    let max = -Infinity;
    for (let i = 0; i < n; i++) {
        if (mask && !mask[i])
            continue;
        const v = logits[i];
        if (v > max)
            max = v;
    }
    if (!Number.isFinite(max))
        return out;
    let sum = 0;
    for (let i = 0; i < n; i++) {
        if (mask && !mask[i])
            continue;
        const e = Math.exp(logits[i] - max);
        out[i] = e;
        sum += e;
    }
    if (sum > 0) {
        for (let i = 0; i < n; i++)
            out[i] /= sum;
    }
    return out;
}
/** Three-element softmax used for the WDL head. */
export function softmax3(logits) {
    if (logits.length !== 3) {
        throw new Error(`softmax3 requires 3 logits, got ${logits.length}`);
    }
    const m = Math.max(logits[0], logits[1], logits[2]);
    const a = Math.exp(logits[0] - m);
    const b = Math.exp(logits[1] - m);
    const c = Math.exp(logits[2] - m);
    const s = a + b + c;
    return [a / s, b / s, c / s];
}
/**
 * Convert the value-head logits to a WDL distribution.
 *
 * The maia3 value head outputs three logits in the order [loss, draw, win]
 * from the side-to-move's perspective (matches uci.py:wdl_from_value_logits).
 */
export function wdlFromValueLogits(logits) {
    const [loss, draw, win] = softmax3(logits);
    return { win, draw, loss };
}
/** Convert a WDL distribution to a single win-probability scalar. */
export function winProbabilityFromWdl(wdl) {
    return wdl.win + 0.5 * wdl.draw;
}
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
export function sampleIndex(probs, topP, rand = Math.random) {
    const n = probs.length;
    if (n === 0)
        throw new Error("sampleIndex called with empty distribution");
    // Sort indices by probability descending.
    const order = new Array(n);
    for (let i = 0; i < n; i++)
        order[i] = i;
    order.sort((a, b) => probs[b] - probs[a]);
    // Identify the top-p prefix (always keep index 0).
    let kept = 1;
    let cum = probs[order[0]];
    while (kept < n && cum < topP) {
        cum += probs[order[kept]];
        kept++;
    }
    // Renormalize over the kept prefix and sample.
    const r = rand() * cum;
    let acc = 0;
    for (let k = 0; k < kept; k++) {
        acc += probs[order[k]];
        if (r <= acc)
            return order[k];
    }
    return order[kept - 1];
}
/** Argmax over a typed or plain array. */
export function argmax(arr) {
    let best = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] > bestVal) {
            bestVal = arr[i];
            best = i;
        }
    }
    return best;
}
/** Clamp `x` to the closed range [lo, hi]. */
export function clamp(x, lo, hi) {
    return x < lo ? lo : x > hi ? hi : x;
}
//# sourceMappingURL=utils.js.map