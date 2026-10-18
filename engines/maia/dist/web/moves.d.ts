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
export declare const NUM_FROM_TO_MOVES = 4096;
export declare const NUM_PROMO_MOVES = 256;
export declare const NUM_MOVES: number;
/**
 * Generate the full move vocabulary (4352 UCI strings).
 *
 * Matches python-chess square indexing: square = rank*8 + file.
 * Iteration order is rank-outer, file-inner for both source and target squares.
 */
export declare function generateAllMoves(): string[];
export declare function getAllMoves(): string[];
export declare function getMoveToIndex(): Map<string, number>;
export declare function getIndexToMove(): string[];
export declare function moveToIndex(uci: string): number | undefined;
export declare function indexToMove(index: number): string | undefined;
//# sourceMappingURL=moves.d.ts.map