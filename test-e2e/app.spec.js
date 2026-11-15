// 画面の動作確認: 起動 → Stockfishの状態 → 手の入力 → 最適解 → ルールの切り替え
const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  await page.goto("/");
});

test("画面が開き、JavaScriptのエラーが出ない", async ({ page }) => {
  await expect(page.locator(".tabs button[data-t=ana]")).toBeVisible();
  await expect(page.locator(".tabs button[data-t=set]")).toBeVisible();
  expect(page.errors).toEqual([]);
});

test("Stockfishは、起動ボタンを押すと準備完了か失敗のどちらかに落ち着く", async ({ page }) => {
  test.setTimeout(400000);
  await expect(page.locator("#sfSt")).toContainText("未起動", { timeout: 60000 });
  // 10秒で押せなければ、押せない理由(他の要素に隠れている等)をエラーに出す
  await page.locator(".tabs button[data-t=set]").click();   // 起動ボタンは「設定」タブの中
  await page.locator("#sfGo").click({ timeout: 10000 });
  // 5秒ごとに状態を出す(準備完了か失敗が出たら終わる)
  let text = "";
  for (let i = 0; i < 70; i++) {
    text = (await page.locator("#sfSt").textContent()) || "";
    console.log(`[Stockfish ${i * 5}秒] ${text}`);
    if (/準備完了|起動できませんでした/.test(text)) break;
    await page.waitForTimeout(5000);
  }
  expect(text).toMatch(/準備完了|起動できませんでした/);
});

test("手を入力して、最適解が出る", async ({ page }) => {
  await page.locator(".tabs button[data-t=ana]").click();
  await page.locator("#mv").fill("1. e4 e5 2. Nf3 Nc6 3. Bb5");
  await page.locator("#mvGo").click();
  await page.locator("#autoGo").click();
  await expect(page.locator("#autoRes")).toContainText("最適解", { timeout: 150000 });
  expect(page.errors).toEqual([]);
});

test("ルールのチェックを切り替えても、エラーが出ない", async ({ page }) => {
  await page.locator(".tabs button[data-t=set]").click();
  const castle = page.locator("#ruleCastle");
  await castle.uncheck();
  await castle.check();
  expect(page.errors).toEqual([]);
});
