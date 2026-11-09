#!/usr/bin/env bash
# chess1-v3.zip の中身(js / css / test / .github / index.html / package.json)で、リポジトリを書き換える。
# 使い方: リポジトリの中で  bash apply-v3.sh chess1-v3.zip
set -euo pipefail

ZIP="${1:-chess1-v3.zip}"
[ -f "$ZIP" ] || { echo "エラー: $ZIP が見つかりません。リポジトリ直下に置いてください。"; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "エラー: gitリポジトリの中で実行してください。"; exit 1; }
cd "$(git rev-parse --show-toplevel)"

# 未コミットの変更があると、元に戻すときに混ざって分かりにくくなるので止める
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "エラー: 未コミットの変更があります。先に次を実行してください:"
  echo "  git add -A && git commit -m \"before v3\""
  exit 1
fi

BR="feat/v3-auto-eval-style-swap"
git checkout -b "$BR" 2>/dev/null || git checkout "$BR"
echo "ブランチ: $BR(ここで作業します。元の main は変わりません)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP" -d "$TMP"
SRC="$TMP/chess1"
[ -d "$SRC/js" ] || { echo "エラー: zipの中身が想定と違います(chess1/js が見つかりません)。"; exit 1; }

# エンジン本体(engines/)は触らない。アプリ本体とテストだけを差し替える
for d in js css test .github; do
  rm -rf "$d"
  cp -r "$SRC/$d" "$d"
done
cp "$SRC/index.html" "$SRC/package.json" .

echo "変更されたファイル:"
git status --short

echo "テストを実行します…"
npm test

echo ""
echo "OKなら、次でコミットします:"
echo "  git add index.html package.json js css test .github"
echo "戻したい時は(このブランチの変更を捨てて main に戻る):"
echo "  git checkout -- . && rm -f js/auto.js test/auto.test.js test/globals.test.js test/search.test.js && git checkout main"