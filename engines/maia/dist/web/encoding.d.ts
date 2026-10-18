/**
 * Maia3 board encoding.
 *
 * Each position is tokenized as a (64, 12) one-hot matrix:
 *   - 64 squares in python-chess order (a1=0, b1=1, …, h8=63)
 *   - 12 piece channels: [wP, wN, wB, wR, wQ, wK, bP, bN, bB, bR, bQ, bK]
 *
 * Before tokenization the board is mirrored to white-to-move (so when it is
 * Black's turn we swap colors AND flip ranks). Each history slot is mirrored
 * independently based on whose turn it was at that ply.
 *
 * The model expects 8 history slots concatenated along the feature axis,
 * giving final shape (64, 96). When fewer than 8 history positions are
 * available we left-pad with the EARLIEST tokenization (not zeros).
 *
 * The Python reference is maia3/maia3/dataset.py:tokenize_board /
 * get_historical_tokens.
 */
import { Chess } from "chess.js";
export declare const SEQ_LEN = 64;
export declare const PIECE_DIMS = 12;
export declare const HISTORY = 8;
export declare const FEATURE_DIM: number;
export declare const TOKENS_PER_BOARD: number;
export declare const TOKENS_PER_POSITION: number;
/**
 * Mirror a chess.js position vertically and swap colors.
 * Identical semantics to python-chess `board.mirror()` and matches the
 * existing mirror logic in maia2-js/src/encoding.ts.
 */
export declare function mirrorBoard(chess: Chess): Chess;
/**
 * Tokenize a single board to a (64, 12) Float32Array, mirroring first if it
 * is Black's turn. Layout is row-major over [square, channel].
 *
 * Square indexing matches python-chess: a1=0, b1=1, …, h8=63 (rank*8 + file).
 */
export declare function tokenizeBoard(chess: Chess): Float32Array;
/**
 * Build the (64, 96) token tensor for a list of historical boards.
 *
 * `boards` is oldest → newest, with the CURRENT position last. If fewer than
 * 8 boards are provided the slot list is left-padded with the earliest entry.
 *
 * Returns a Float32Array of length 64*96 = 6144 in row-major order over
 * [square, slot, channel]: index = square*96 + slot*12 + channel.
 */
export declare function buildHistoryTokens(boards: Chess[]): Float32Array;
//# sourceMappingURL=encoding.d.ts.map