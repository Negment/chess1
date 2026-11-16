// 悪手の分類(純粋な計算)
const test=require("node:test"),assert=require("node:assert/strict");
const {load,pick}=require("./helpers");
const A=pick(load(["chess.js","auto.js"]),["classifyMoves"]);
const mv=(sn,sc)=>({m:{f:0,t:1},sn,sc});
test("詰まされる手は、負けの一覧に入る",()=>{
  const r=A.classifyMoves([mv("良い",{cp:50}),mv("詰まされる",{mate:-2})]);
  assert.equal(JSON.stringify(r.lose.map(x=>x.sn)),JSON.stringify(["詰まされる"]));
});
test("負けの手が無ければ、勝率の損失が15%以上の手を推奨しない手にする",()=>{
  const r=A.classifyMoves([mv("最善",{cp:100}),mv("大損",{cp:-400})]);
  assert.equal(r.lose.length,0);
  assert.equal(JSON.stringify(r.bad.map(x=>x.sn)),JSON.stringify(["大損"]));
});
test("損失が5〜15%の手は注意に入り、最善手は入らない",()=>{
  const r=A.classifyMoves([mv("最善",{cp:100}),mv("やや損",{cp:20}),mv("ほぼ同じ",{cp:95})]);
  assert.ok(r.meh.some(x=>x.sn==="やや損"));
  assert.ok(!r.bad.length&&!r.lose.length);
  assert.ok(!r.meh.some(x=>x.sn==="最善"));
});
test("どの手も大きく損しなければ、どの一覧も空",()=>{
  const r=A.classifyMoves([mv("A",{cp:30}),mv("B",{cp:28})]);
  assert.equal(r.lose.length+r.bad.length+r.meh.length,0);
});
