#!/usr/bin/env bash
# chess1 の zip の中身(js / css / test / .github / index.html / package.json)で、リポジトリを書き換える。
# 使い方(リポジトリの中で):  bash apply.sh chess1-v7.zip [作業ブランチ名]
# engines/ には触らない(Stockfish / Maia はそのまま残る)。
set -euo pipefail

ZIP="${1:?使い方: bash apply.sh <zip> [ブランチ名]}"
BR="${2:-feat/chess1-update}"
[ -f "$ZIP" ] || { echo "エラー: $ZIP が見つかりません。リポジトリ直下に置いてください。"; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "エラー: gitリポジトリの中で実行してください。"; exit 1; }
cd "$(git rev-parse --show-toplevel)"

# 追跡中のファイルに未コミットの変更があると、混ざって戻しにくいので止める
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "エラー: 未コミットの変更があります。先にコミットしてください:"
  echo "  git add -A && git commit -m \"before update\""
  exit 1
fi

git checkout -b "$BR" 2>/dev/null || git checkout "$BR"
echo "ブランチ: $BR(作業はここで行います。main は変わりません)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP" -d "$TMP"
SRC="$TMP/chess1"
[ -d "$SRC/js" ] || { echo "エラー: zipの中身が想定と違います(chess1/js が見つかりません)。"; exit 1; }

# アプリ本体とテストだけを差し替える。古いテストファイルも消える(testフォルダごと入れ替え)
for d in js css test .github; do
  rm -rf "$d"
  cp -r "$SRC/$d" "$d"
done
cp "$SRC/index.html" "$SRC/package.json" .

echo "変更されたファイル:"
git status --short

echo "テストを実行します…"
npm test > /tmp/apply-test.log 2>&1 && echo "テスト: 合格" || { echo "テスト: 失敗(詳細: /tmp/apply-test.log)"; exit 1; }
grep -E "^# (tests|pass|fail)" /tmp/apply-test.log

echo ""
echo "OKなら、次でコミットします(コードだけを入れる):"
echo "  git add index.html package.json js css test .github"
echo "  git commit -m \"feat: 最適解を Stockfish 中心の点数に作り直し、矢印・棋風の補正を追加\""
echo "戻したい時は(このブランチの変更を捨てて main に戻る):"
echo "  git checkout -- . && git checkout main && git branch -D $BR"
