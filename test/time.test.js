// 時間管理: 次の深さを始めるかの判断と、時間内の探索
const test=require("node:test"),assert=require("node:assert/strict");
const {load,pick}=require("./helpers");
const C=load(["chess.js"]);
const E=pick(C,["shouldDeepen","parseFen","legal","search"]);

test("時間が十分なら、次の深さを始める",()=>{
  // 直前の深さが100ms、その前が50ms。次は約200ms。経過100msで上限1000msなら始める
  assert.equal(E.shouldDeepen(100,100,50,1000),true);
});
test("次の深さが明らかに間に合わないなら、始めない",()=>{
  assert.equal(E.shouldDeepen(900,800,400,1000),false);
});
test("深さが増えるときの時間の伸びは、2〜4倍の範囲で見積もる",()=>{
  assert.equal(E.shouldDeepen(0,10,1,1000),true);      // 伸び4倍でも 10*4*0.8=32 は収まる
  assert.equal(E.shouldDeepen(990,10,1,1000),false);
});
test("制限時間を指定すると、その時間を大きく超えずに、完了した深さを返す",()=>{
  const s=E.parseFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
  const t0=Date.now();
  const r=E.search(s,E.legal(s),300);
  const used=Date.now()-t0;
  assert.ok(r.depth>=1);
  assert.ok(r.m);
  assert.ok(used<300*1.15+200,`used ${used}ms`);   // 猶予を含めて、大きく超えないこと
});
