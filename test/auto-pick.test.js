// おまかせの手の選び方: 評価の許容範囲の中から、期待勝率が最も高い手を選ぶ
const test=require("node:test"),assert=require("node:assert/strict");
const {load,pick}=require("./helpers");
const A=pick(load(["chess.js","auto.js"]),["pickBest"]);
const rows=[
  {sn:"Nf3",m:{f:1,t:2},cp:40,ew:0.62},     // 期待勝率は最高だが、評価が最善より…
  {sn:"d4",m:{f:3,t:4},cp:30,ew:0.55},
  {sn:"h3",m:{f:5,t:6},cp:-200,ew:0.70},    // 評価が大きく悪い → 許容外
];
test("評価が許容範囲内なら、期待勝率が最も高い手を選ぶ",()=>{
  const r=A.pickBest(rows,1500);   // tol = 30+700*0.07 ≈ 79cp
  assert.equal(r.engBest.sn,"Nf3");
  assert.equal(r.pick.sn,"Nf3");
});
test("評価が許容範囲を超える手は、期待勝率が高くても選ばない",()=>{
  const r=A.pickBest(rows,1500);
  assert.notEqual(r.pick.sn,"h3");
});
test("許容範囲は、レートが高いほど狭い",()=>{
  assert.ok(A.pickBest(rows,2600).tol<A.pickBest(rows,1000).tol);
  assert.equal(A.pickBest(rows,2200).tol,30);
  assert.equal(A.pickBest(rows,500).tol,149);
  assert.equal(A.pickBest(rows,0).tol,184);
});
test("評価が出ていない候補しかなければ、期待勝率順の先頭を選ぶ",()=>{
  const r=A.pickBest([{sn:"a",cp:null,ew:0.6},{sn:"b",cp:null,ew:0.5}],1500);
  assert.equal(r.pick.sn,"a");
  assert.equal(r.engBest,null);
});
