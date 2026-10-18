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
export const STARTPOS_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/**
 * Resolve `HistoryInput` to a list of Chess instances, oldest first with the
 * current position last. The returned array is never longer than 8 entries.
 */
export function resolveHistory(input) {
    if (input.priorFens && input.priorMoves) {
        throw new Error("resolveHistory: pass priorFens OR priorMoves, not both.");
    }
    const current = new Chess(input.fen);
    if (input.priorMoves && input.priorMoves.length > 0) {
        const base = input.baseFen ?? STARTPOS_FEN;
        const game = new Chess(base);
        const snapshots = [new Chess(game.fen())];
        for (const uci of input.priorMoves) {
            const result = game.move(uci, { strict: false });
            if (result === null) {
                throw new Error(`resolveHistory: priorMoves entry "${uci}" is not legal in position ${game.fen()}`);
            }
            snapshots.push(new Chess(game.fen()));
        }
        // The final snapshot should equal `fen`. If not, append `current` so the
        // user's intent (the explicit `fen`) is honored — the priorMoves provide
        // context but `fen` is authoritative.
        const finalFen = snapshots[snapshots.length - 1].fen();
        if (finalFen !== current.fen()) {
            snapshots.push(current);
        }
        return snapshots.length > 8 ? snapshots.slice(snapshots.length - 8) : snapshots;
    }
    if (input.priorFens && input.priorFens.length > 0) {
        const boards = input.priorFens.map((f) => new Chess(f));
        boards.push(current);
        return boards.length > 8 ? boards.slice(boards.length - 8) : boards;
    }
    return [current];
}
//# sourceMappingURL=history.js.map