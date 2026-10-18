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
export const SEQ_LEN = 64;
export const PIECE_DIMS = 12;
export const HISTORY = 8;
export const FEATURE_DIM = HISTORY * PIECE_DIMS; // 96
export const TOKENS_PER_BOARD = SEQ_LEN * PIECE_DIMS; // 768
export const TOKENS_PER_POSITION = SEQ_LEN * FEATURE_DIM; // 6144
// PieceSymbol → channel offset matching the Python PIECE_MAP order:
//   PAWN=1, KNIGHT=2, BISHOP=3, ROOK=4, QUEEN=5, KING=6
// Channel = (mapped - 1) + (6 if black). With the maia3 ordering this is
// effectively [P, N, B, R, Q, K] for each color block.
const PIECE_CHANNEL = {
    p: 0,
    n: 1,
    b: 2,
    r: 3,
    q: 4,
    k: 5,
};
/**
 * Mirror a chess.js position vertically and swap colors.
 * Identical semantics to python-chess `board.mirror()` and matches the
 * existing mirror logic in maia2-js/src/encoding.ts.
 */
export function mirrorBoard(chess) {
    const board = chess.board();
    const fen = chess.fen();
    const parts = fen.split(" ");
    let mirroredFen = "";
    for (let rank = 7; rank >= 0; rank--) {
        let empty = 0;
        for (let file = 0; file < 8; file++) {
            const piece = board[rank][file];
            if (piece) {
                if (empty > 0) {
                    mirroredFen += empty;
                    empty = 0;
                }
                mirroredFen +=
                    piece.color === "w" ? piece.type.toLowerCase() : piece.type.toUpperCase();
            }
            else {
                empty++;
            }
        }
        if (empty > 0)
            mirroredFen += empty;
        if (rank > 0)
            mirroredFen += "/";
    }
    const turn = parts[1] === "w" ? "b" : "w";
    let castling = parts[2];
    if (castling !== "-") {
        let nc = "";
        if (castling.includes("k"))
            nc += "K";
        if (castling.includes("q"))
            nc += "Q";
        if (castling.includes("K"))
            nc += "k";
        if (castling.includes("Q"))
            nc += "q";
        castling = nc || "-";
    }
    let ep = parts[3];
    if (ep !== "-") {
        const file = ep[0];
        const rank = 9 - parseInt(ep[1], 10);
        ep = `${file}${rank}`;
    }
    return new Chess(`${mirroredFen} ${turn} ${castling} ${ep} ${parts[4]} ${parts[5]}`);
}
/**
 * Tokenize a single board to a (64, 12) Float32Array, mirroring first if it
 * is Black's turn. Layout is row-major over [square, channel].
 *
 * Square indexing matches python-chess: a1=0, b1=1, …, h8=63 (rank*8 + file).
 */
export function tokenizeBoard(chess) {
    const board = chess.turn() === "b" ? mirrorBoard(chess) : chess;
    const tokens = new Float32Array(TOKENS_PER_BOARD);
    const raw = board.board(); // raw[0] = rank 8, raw[7] = rank 1
    for (let square = 0; square < SEQ_LEN; square++) {
        const rank = square >> 3; // 0..7 (0 = rank 1)
        const file = square & 7;
        const piece = raw[7 - rank][file];
        if (!piece)
            continue;
        const colorOffset = piece.color === "w" ? 0 : 6;
        const channel = PIECE_CHANNEL[piece.type] + colorOffset;
        tokens[square * PIECE_DIMS + channel] = 1;
    }
    return tokens;
}
/**
 * Build the (64, 96) token tensor for a list of historical boards.
 *
 * `boards` is oldest → newest, with the CURRENT position last. If fewer than
 * 8 boards are provided the slot list is left-padded with the earliest entry.
 *
 * Returns a Float32Array of length 64*96 = 6144 in row-major order over
 * [square, slot, channel]: index = square*96 + slot*12 + channel.
 */
export function buildHistoryTokens(boards) {
    if (boards.length === 0) {
        throw new Error("buildHistoryTokens requires at least one board");
    }
    if (boards.length > HISTORY) {
        // The Python deque is bounded to `history`; if a caller passes more we
        // keep the most recent HISTORY (current is last).
        boards = boards.slice(boards.length - HISTORY);
    }
    // Tokenize each board once.
    const perBoard = boards.map(tokenizeBoard);
    // Build slot list with left-pad of the earliest tokenization.
    const padCount = HISTORY - perBoard.length;
    const earliest = perBoard[0];
    const slots = [];
    for (let i = 0; i < padCount; i++)
        slots.push(earliest);
    for (const t of perBoard)
        slots.push(t);
    const out = new Float32Array(TOKENS_PER_POSITION);
    for (let square = 0; square < SEQ_LEN; square++) {
        for (let slot = 0; slot < HISTORY; slot++) {
            const src = slots[slot];
            const srcOffset = square * PIECE_DIMS;
            const dstOffset = square * FEATURE_DIM + slot * PIECE_DIMS;
            for (let c = 0; c < PIECE_DIMS; c++) {
                out[dstOffset + c] = src[srcOffset + c];
            }
        }
    }
    return out;
}
//# sourceMappingURL=encoding.js.map