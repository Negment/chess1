// 最適解の点数の合成(純粋な計算)
const test=require("node:test"),assert=require("node:assert/strict");
const {load,pick}=require("./helpers");
const A=pick(load(["chess.js","auto.js"]),["scoreMoves","STYLE_KAPPA"]);

const cands=[
  {sn:"A",ev:30,style:0},
  {sn:"B",ev:25,style:0},
  {sn:"C",ev:-40,style:0},
];
test("棋風が未設定なら、評価の高い手を選ぶ(棋風の値は無視)",()=>{
  const r=A.scoreMoves(cands.map(x=>({...x,style:1})),false);
  assert.equal(r[0].sn,"A");
});
test("棋風が設定されていれば、評価が近い手の中で好みの手に傾く",()=>{
  const list=[{sn:"A",ev:30,style:0},{sn:"B",ev:25,style:1}];   // 差5cp。棋風で逆転する
  const r=A.scoreMoves(list,true);
  assert.equal(r[0].sn,"B");
});
test("棋風の補正は小さい: 評価の差が大きい手は、棋風では逆転しない",()=>{
  const list=[{sn:"A",ev:100,style:0},{sn:"B",ev:0,style:1}];
  const r=A.scoreMoves(list,true);
  assert.equal(r[0].sn,"A");
  assert.ok(A.STYLE_KAPPA<=30);
});
test("点数は、評価と棋風の補正を足したもの",()=>{
  const r=A.scoreMoves([{sn:"X",ev:10,style:0.5}],true);
  assert.equal(r[0].total,10+A.STYLE_KAPPA*0.5);
});
test("並びは点数の高い順",()=>{
  const r=A.scoreMoves(cands,false);
  assert.deepEqual(r.map(x=>x.sn),["A","B","C"]);
});
