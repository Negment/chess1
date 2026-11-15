// おまかせ: 勝率の損失からレートの目安を出す(純粋な計算)と、候補の出どころの表示
const test=require("node:test"),assert=require("node:assert/strict");
const {load,pick}=require("./helpers");
const A=pick(load(["chess.js","auto.js"]),["lossToRating","winPct","srcNote"]);

test("損失が小さいほどレートが高い(単調減少)",()=>{
  let prev=Infinity;
  for(const x of [0.5,1,2,3,5,8,12,20,40]){
    const r=A.lossToRating(x);assert.ok(r<=prev,`loss ${x}`);prev=r;
  }
});
test("損失の端は表の端の値になる",()=>{
  assert.equal(A.lossToRating(0),2800);
  assert.equal(A.lossToRating(999),700);
});
test("損失 7.2% は表どおり 1850",()=>{assert.equal(A.lossToRating(7.2),1850)});
test("勝率は、互角なら50%、評価が大きいほど100%に近い",()=>{
  assert.equal(Math.round(A.winPct(0)),50);
  assert.ok(A.winPct(500)>90);
  assert.ok(A.winPct(-500)<10);
});
test("候補の出どころ: Stockfishと自作エンジンで、表示を変える",()=>{
  assert.match(A.srcNote({src:"sf"}),/Stockfish/);
  assert.match(A.srcNote({src:"se"}),/⚠/);     // 自作への切り替えは警告
  assert.equal(A.srcNote(null),"");
});
