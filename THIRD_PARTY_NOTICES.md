# サードパーティ製ソフトウェアの表示

このアプリは、次の外部のソフトウェア・データを使っています。それぞれの作者のライセンスに従います。
この文書は法律上の助言ではありません。配布の前に、各項目の原典を確認してください。

## 1. Stockfish 19(チェスエンジン)

- **場所**: `engines/stockfish/stockfish-19-single.js` / `.wasm`(単一スレッド版)
- **ライセンス**: GNU General Public License v3.0(GPLv3)
- **原典**: https://github.com/official-stockfish/Stockfish
- **備考**: GPLv3のため、配布する場合は、ライセンス文の同梱と、対応するソースコードの入手方法の明示が必要です。このリポジトリには、ライセンス文の全文(`COPYING` など)はまだ含まれていません。
- **注意**: `engines/stockfish/` には、18版や「lite」版のファイルも含まれています。アプリは `stockfish-19-single` を使いますが、他の版は現在使われていません。

## 2. Maia3 の実装 `maia3-js` 0.2.0(同梱)

- **場所**: `engines/maia/`(`dist/`、`package.json`、`LICENSE`)
- **ライセンス(このパッケージ)**: MIT License。著作権表示は `engines/maia/LICENSE` のとおり(Copyright (c) 2026 Cem Unuvar)。
- **元になっている研究コード**: CSSLab の Maia3 本体(`CSSLab/maia3`)は **GNU AGPL-3.0**、研究用の `CSSLab/maia-chess` は **GNU GPL-3.0** です(公式リポジトリのLICENSEを確認済み)。
- **要確認**: `maia3-js` が、これらのコードを元にした派生物かどうかは確認できていません。派生物なら、MITで配布してよいかが問題になります。作者への確認か、法的な確認が必要です。

## 3. Maia3 のモデル重み

- **場所**: `engines/maia/models/maia3_5m.onnx`、`engines/maia/maia3_23m.onnx`(同梱)、79M版は初回に外部から取得
- **配布元**: Hugging Face の `UofTCSSLab/Maia3-5M`、`UofTCSSLab/Maia3-23M`、`UofTCSSLab/Maia3-79M`
- **ライセンス(配布元のモデルカードの記載)**:
  - 5M・23M: 「License: CC BY 4.0 (paper); see repo for code/weights license」。論文はCC BY 4.0ですが、重みの条件は明記されていません。リポジトリを参照するよう書かれていて、そのリポジトリにも重みの条件は見当たりません。**同梱の重みのライセンスは、未確定です。**
  - 79M: 「AGPLv3」(モデルカードの記載)。同梱していませんが、利用するなら、AGPL-3.0の条件を確認する必要があります。
- **注意**: 5M・23Mを同梱したまま公開するのは、重みの条件が確定するまで避けるのが安全です。

## 4. chess.js

- **用途**: Maia3 の依存として、ブラウザでは CDN(`cdn.jsdelivr.net/npm/chess.js@1.4.0`)から読み込みます。アプリ本体の `js/chess.js` は、このアプリ独自の実装で、chess.js のコードは含みません。
- **ライセンス**: BSD 2-Clause License(作者: Jeff Hlywa)。確認のうえ、必要なら版元の表示を入れてください。
- **原典**: https://github.com/jhlywa/chess.js

## 5. ONNX Runtime Web 1.22.0

- **用途**: Maia3 のモデル実行。ブラウザでは CDN(`cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0`)から読み込みます。
- **ライセンス**: MIT License(Microsoft)
- **原典**: https://github.com/microsoft/onnxruntime

## 6. Lichess のテーブルベース API

- **用途**: 7駒以下の局面の勝敗と最善手の照会(`tablebase.lichess.ovh`)。データ自体は同梱していません。
- **注意**: 局面(FEN)が Lichess のサーバーに送られます。利用にあたっては、Lichess の利用規約を確認してください。

## 7. 自作のコード

`js/`、`css/`、`test/`、`index.html` は、このプロジェクトで作成したものです。GNU General Public License v3.0(GPLv3)で公開します(`LICENSE` を参照)。

注意: このライセンスは、このプロジェクトの自作部分にだけ適用されます。上の 1〜6 の外部のソフトウェア・モデルには、それぞれの条件が適用されます。
