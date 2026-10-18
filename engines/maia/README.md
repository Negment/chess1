# maia3-js

JavaScript inference for [Maia3 (Chessformer)](https://github.com/CSSLab/maia3) — predicts human-like chess moves and per-move WDL evaluations.

ESM-only. Node + browser. ONNX Runtime under the hood.

## Install

```bash
# Node
npm install maia3-js onnxruntime-node

# Browser
npm install maia3-js onnxruntime-web
```

`onnxruntime-node` and `onnxruntime-web` are optional peer dependencies — install whichever runtime you need.

## Quickstart (Node)

```ts
import { Maia3, STARTPOS_FEN } from "maia3-js";

const maia = new Maia3({ variant: "5m" });
await maia.load();

const result = await maia.predict({
  fen: STARTPOS_FEN,
  selfElo: 1500,
});

console.log(result.bestMove);          // e.g. "e2e4"
console.log(result.winProbability);    // e.g. 0.52
for (const c of result.candidates) {
  console.log(c.uci, c.probability.toFixed(3), c.wdl);
}
```

## Quickstart (Browser)

```ts
import { Maia3, STARTPOS_FEN } from "maia3-js/web";

const maia = new Maia3({
  variant: "5m",
  onProgress: (loaded, total) => console.log(loaded / total),
});
await maia.load();

const r = await maia.predict({ fen: STARTPOS_FEN, selfElo: 1500 });
```

`5m` is bundled with the npm package (~21 MB). `23m` and `79m` are downloaded on first use from Hugging Face and cached locally (Node) or in Cache Storage (browser).

## History

Maia3 conditions on up to 8 prior board positions. Supply this via one of two equivalent inputs:

```ts
// Option A: explicit prior FENs (oldest first, exclude the current position)
await maia.predict({
  fen: currentFen,
  priorFens: [prevFen, prevPrevFen, ...],
  selfElo: 1500,
});

// Option B: UCI moves applied to a base FEN (defaults to startpos)
await maia.predict({
  fen: currentFen,
  priorMoves: ["e2e4", "e7e5", "g1f3", "b8c6"],
  selfElo: 1500,
});
```

When no history is supplied the current position is used and silently padded to 8 — matches the default UCI engine behavior in the Python reference (`use_uci_history=False`).

Passing both `priorFens` and `priorMoves` throws.

## API

```ts
class Maia3 {
  constructor(options?: {
    variant?: "5m" | "23m" | "79m";   // default "5m"
    modelPath?: string;                // node: explicit path
    modelDir?: string;                 // node: cache dir
    url?: string;                      // web: override URL
    modelBytes?: ArrayBuffer;          // web: pre-fetched bytes
    onProgress?: (loaded: number, total: number) => void; // web
    executionProviders?: string[];     // pass-through to ORT
    temperature?: number;              // default 0 (argmax bestMove)
    topP?: number;                     // default 1.0
    topK?: number;                     // default 5
    autoBatch?: boolean | { maxBatchSize?: number; maxWaitMs?: number }; // default off

    // Node ORT tuning
    intraOpNumThreads?: number;        // default: cores/2, capped at 8
    interOpNumThreads?: number;        // default 1
    graphOptimizationLevel?: "disabled" | "basic" | "extended" | "all"; // default "all"
    enableCpuMemArena?: boolean;       // default true

    // Web ORT tuning
    numThreads?: number;               // default: cores/2 (max 4) if cross-origin isolated, else 1
    simd?: boolean;                    // default true
    proxy?: boolean;                   // run inference off the main thread
    wasmPaths?: string;                // self-host the ORT .wasm artifacts

    maxBatchSize?: number;             // positions per session.run, default 64
  });

  load(): Promise<void>;
  isLoaded(): boolean;
  predict(input: PredictInput): Promise<PredictionResult>;
  predictBatch(
    inputs: PredictInput[],
    opts?: {
      maxBatchSize?: number;           // default 64
      topK?: number;                   // default 0 — policy only
      onError?: "throw" | "collect";   // default "throw"
    }
  ): Promise<PredictionResult[]>;
  close(): Promise<void>;
}

interface PredictInput {
  fen: string;
  selfElo: number;
  oppoElo?: number;        // defaults to selfElo
  priorFens?: string[];    // exclusive with priorMoves
  priorMoves?: string[];
  baseFen?: string;        // for priorMoves; defaults to startpos
  temperature?: number;
  topP?: number;
  topK?: number;
}

interface PredictionResult {
  bestMove: string;                   // UCI of selected move
  moves: Map<string, number>;         // legal UCI → policy probability
  candidates: MoveCandidate[];        // top-K with per-move WDL
  wdl: { win: number; draw: number; loss: number }; // side-to-move POV
  winProbability: number;             // wdl.win + 0.5 * wdl.draw
}

interface MoveCandidate {
  uci: string;
  probability: number;
  wdl: { win: number; draw: number; loss: number };
  winProbability: number;
}
```

### Sampling

- `temperature === 0` (default): `bestMove` is argmax of the masked policy.
- `temperature > 0`: `bestMove` is sampled from the policy with optional nucleus filter (`topP < 1`). Matches the Python `sample_from_logits` routine.

### Per-candidate WDL

For each of the top-`topK` candidates, `maia3-js` runs an additional forward pass with swapped Elos to score the position *after* the candidate move. WDL is reported in the original player's frame (inverted from the post-move side-to-move).

## Batch inference

`predictBatch` evaluates many positions with batched forward passes instead of
one `session.run` per position. Results are index-aligned with the input array.

```ts
const results = await maia.predictBatch(
  fens.map((fen) => ({ fen, selfElo: 1500 }))
);
results.forEach((r, i) => console.log(fens[i], r.bestMove, r.winProbability));
```

**`topK` defaults to `0` here, unlike `predict()`.** Each candidate WDL costs an
extra forward pass, so the default keeps a batch of N positions at N passes
rather than N×(1+K). Pass `{ topK: 5 }` — or set `topK` on individual inputs —
to get candidates back.

On an 8-core M-series CPU with the 5m model, 120 positions:

| | wall clock | per position |
|---|---:|---:|
| `predict()` in a loop (`topK: 5`) | 2765 ms | 23.0 ms |
| `predictBatch` (`topK: 0`, default) | 531 ms | 4.4 ms |
| `predictBatch` (`topK: 5`) | 2393 ms | 19.9 ms |

One bad position doesn't have to sink the batch:

```ts
const results = await maia.predictBatch(inputs, { onError: "collect" });
for (const r of results) {
  if (r instanceof Error) continue; // illegal FEN, checkmate, …
}
```

### Auto-batching concurrent calls

When many `predict()` calls are in flight at once — a request handler, or a UI
evaluating several boards — `autoBatch` coalesces whatever is queued at the
same moment into a single batched run:

```ts
const maia = new Maia3({ variant: "5m", autoBatch: true });
await maia.load();
const results = await Promise.all(fens.map((fen) => maia.predict({ fen, selfElo: 1500 })));
```

It is off by default so single-call latency is unchanged, and it does not
affect `predictBatch`, which batches on its own. While a batch is running,
new arrivals accumulate and go out together as soon as it finishes.

### Threads

Node defaults `intraOpNumThreads` to half the available cores (capped at 8);
on an 8-core machine, 4 measured fastest for both single and batched runs, with
throughput degrading past that.

In the browser, multi-threaded WASM needs `SharedArrayBuffer`, which browsers
only expose to cross-origin isolated pages. Without these response headers
`numThreads` defaults to 1:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Note that `ort.env.wasm` is global to the page. `load()` writes `simd` and
`numThreads` to it, so if you run other onnxruntime-web models alongside
maia3-js, pass explicit values here to keep both in agreement.

## Variants

| Alias  | Repo                            | Parameters | Bundled |
|--------|---------------------------------|-----------:|---------|
| `5m`   | `UofTCSSLab/Maia3-5M`          |    ~5 M    | yes     |
| `23m`  | `UofTCSSLab/Maia3-23M`         |   ~23 M    | no      |
| `79m`  | `UofTCSSLab/Maia3-79M`         |   ~79 M    | no      |

ONNX checkpoints are hosted at `huggingface.co/cemoss17/maia3-onnx`.

## Parity with Python

Test fixtures are generated from the official Maia3 PyTorch implementation. The JS port matches it within:

- Encoding: bit-exact (1e-6) for the (64, 96) token tensor.
- Raw logits: 1e-3 absolute on Top-20 logits.
- Policy probabilities: 5% absolute.
- WDL: 5% absolute (current position and per-candidate).

`npm run validate` exercises this against 13 curated positions and 200 random parity positions in one go.

## Re-exporting weights

If you need to export a custom checkpoint or the 23m / 79m variants yourself, install the maia3 Python package and run:

```bash
.venv/bin/python scripts/export-onnx.py \
  --variant 5m \
  --output models/maia3_5m.onnx \
  --validate
```

The `--validate` flag runs a parity check between the PyTorch model and the
exported ONNX (atol=1e-4) at batch sizes 1, 2 and 8. The export also asserts
that dim 0 stayed symbolic on every input and output before writing the
sidecar — batching silently specializing to 1 is exactly the bug this catches.

Requires `torch`, `onnx`, `onnxruntime` and `onnxscript` in the Python
environment.

## Limitations

- Sampling uses `Math.random()` — no seed parameter in v0.1.
- ONNX artifacts exported before batching support declared a static `[1, 4352]` output shape and crash on any batch > 1. `maia3-js` detects those at load time and falls back to sequential runs with a warning; delete your model cache to pick up a current artifact.
- Only the policy / value heads are exported. The Maia3 ponder head (predicted clock time) is dropped.

## License

MIT.
