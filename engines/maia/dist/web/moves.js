/**
 * Maia3 move vocabulary.
 *
 * The model emits 4352 move logits per position. The mapping from index to
 * UCI string is fixed and identical to maia3.utils.get_all_possible_moves
 * (https://github.com/CSSLab/maia3/blob/main/maia3/utils.py).
 *
 * Layout:
 *   - Indices 0..4095:   from_square * 64 + to_square (python-chess ordering: a1=0, b1=1, …, h8=63)
 *   - Indices 4096..4351: 32*from_file + 4*to_file + promo_idx (promotions a7→a8 .. h7→h8, with promo q,r,b,n)
 *
 * Because the model always sees the board mirrored to white-to-move, all promotions
 * in the vocabulary are white pawn promotions from rank 7 to rank 8.
 */
const FILES = "abcdefgh";
const PROMO_PIECES = ["q", "r", "b", "n"];
export const NUM_FROM_TO_MOVES = 4096;
export const NUM_PROMO_MOVES = 256;
export const NUM_MOVES = NUM_FROM_TO_MOVES + NUM_PROMO_MOVES; // 4352
let _allMoves = null;
let _moveToIndex = null;
let _indexToMove = null;
/**
 * Generate the full move vocabulary (4352 UCI strings).
 *
 * Matches python-chess square indexing: square = rank*8 + file.
 * Iteration order is rank-outer, file-inner for both source and target squares.
 */
export function generateAllMoves() {
    const moves = new Array(NUM_MOVES);
    let idx = 0;
    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            const from = FILES[file] + (rank + 1);
            for (let tRank = 0; tRank < 8; tRank++) {
                for (let tFile = 0; tFile < 8; tFile++) {
                    const to = FILES[tFile] + (tRank + 1);
                    moves[idx++] = from + to;
                }
            }
        }
    }
    for (let f = 0; f < 8; f++) {
        for (let t = 0; t < 8; t++) {
            for (const piece of PROMO_PIECES) {
                moves[idx++] = `${FILES[f]}7${FILES[t]}8${piece}`;
            }
        }
    }
    return moves;
}
export function getAllMoves() {
    if (_allMoves === null) {
        _allMoves = generateAllMoves();
    }
    return _allMoves;
}
export function getMoveToIndex() {
    if (_moveToIndex === null) {
        const all = getAllMoves();
        const m = new Map();
        for (let i = 0; i < all.length; i++)
            m.set(all[i], i);
        _moveToIndex = m;
    }
    return _moveToIndex;
}
export function getIndexToMove() {
    if (_indexToMove === null) {
        _indexToMove = getAllMoves();
    }
    return _indexToMove;
}
export function moveToIndex(uci) {
    return getMoveToIndex().get(uci);
}
export function indexToMove(index) {
    const all = getAllMoves();
    return index >= 0 && index < all.length ? all[index] : undefined;
}
//# sourceMappingURL=moves.js.map