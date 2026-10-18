/**
 * History resolution.
 *
 * Maia3 conditions on up to 8 prior positions (the model's `history=8`).
 * Callers can supply that history in one of two ways:
 *
 *   1. priorFens: array of FEN strings, oldest first, EXCLUDING the current
 *      position. The current position is supplied via `fen`.
 *   2. priorMoves: array of UCI moves applied to `baseFen` (default startpos).
 *      Each move's resulting position becomes a history entry.
 *
 * Passing both throws. Passing neither produces a single-element history
 * containing only the current position; `buildHistoryTokens` will then
 * left-pad with that same tokenization.
 */
import { Chess } from "chess.js";
export declare const STARTPOS_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export interface HistoryInput {
    /** Current position (always required). */
    fen: string;
    /** Prior positions, oldest first, EXCLUDING the current position. */
    priorFens?: string[];
    /** UCI moves to apply on top of `baseFen` to reconstruct the history. */
    priorMoves?: string[];
    /** Starting FEN for `priorMoves`. Defaults to the standard starting position. */
    baseFen?: string;
}
/**
 * Resolve `HistoryInput` to a list of Chess instances, oldest first with the
 * current position last. The returned array is never longer than 8 entries.
 */
export declare function resolveHistory(input: HistoryInput): Chess[];
//# sourceMappingURL=history.d.ts.map