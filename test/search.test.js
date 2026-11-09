// 自作探索: 詰みの正解(総当たりで確認済み)・評価の対称性・配置表・局面の鍵
const test=require("node:test"),assert=require("node:assert/strict");
const {load,pick}=require("./helpers");
const C=load(["chess.js"]);
const E=pick(C,["parseFen","legal","make","inCheck","search","ev","hashKey","PST_MG","PST_EG","MATE"]);
const {parseFen,legal,make,inCheck,search,ev,hashKey,PST_MG,PST_EG,MATE}=E;

// 手番側が n 手以内に詰ませられるか(総当たり。正解の基準に使う)
function can(s,n){
  if(n<=0)return false;
  for(const m of legal(s)){
    const ns=make(s,m),rep=legal(ns);
    if(!rep.length){if(inCheck(ns,ns.t==="w"))return true;continue}
    if(n===1)continue;
    if(rep.every(r=>can(make(ns,r),n-1)))return true;
  }
  return false;
}
const MATES=[
  ["6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",1],     // 1手詰め(バックランク)
  ["k7/8/1K6/8/8/8/8/7R w - - 0 1",1],          // 1手詰め(Rh8#)
  ["k7/8/2K5/8/8/8/8/7R w - - 0 1",2],          // 2手詰め
  ["k7/8/8/1K6/8/8/8/6Q1 w - - 0 1",2],         // 2手詰め
];
for(const [fen,n] of MATES){
  test(`詰み${n}手: 総当たりの正解と一致し、探索も同じ手数を返す (${fen.slice(0,20)}…)`,()=>{
    const s=parseFen(fen);
    assert.equal(can(s,n),true,"正解の確認");
    if(n>1)assert.equal(can(s,n-1),false,"より短い詰みはない");
    const r=search(s,legal(s),5000,8);
    assert.equal(r.score,MATE-(2*n-1));
  });
}

test("配置表はどれも64マス",()=>{
  for(const t of [PST_MG,PST_EG])for(const k of Object.keys(t))assert.equal(t[k].length,64,k);
});
test("初期局面の評価は0(左右・白黒が対称)",()=>{
  assert.equal(ev(parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")),0);
});
// 色を入れ替え、上下を反転した局面は、手番側から見て同じ評価になるはず
function mirror(s){
  const b=Array(64).fill("");
  for(let i=0;i<64;i++){
    const p=s.b[i];if(!p)continue;
    const r=i>>3,f=i&7,ni=((7-r)<<3)|f;
    b[ni]=p===p.toUpperCase()?p.toLowerCase():p.toUpperCase();
  }
  const c=s.c?s.c.split("").map(x=>x===x.toUpperCase()?x.toLowerCase():x.toUpperCase()).sort().join(""):"";
  return{b,t:s.t==="w"?"b":"w",c,e:s.e<0?-1:((7-(s.e>>3))<<3)|(s.e&7),h:s.h,n:s.n};
}
test("評価は色と上下を反転しても同じ(配置表の黒の引き方が正しい)",()=>{
  for(const f of ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
                  "4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1"]){
    const s=parseFen(f);
    assert.ok(Math.abs(ev(s)-ev(mirror(s)))<1e-9,f);
  }
});
test("局面の鍵: 手番・キャスリング権・アンパッサンの違いを区別する",()=>{
  const base="4k3/8/8/8/8/8/8/4K2R";
  const a=hashKey(parseFen(base+" w K - 0 1")),b=hashKey(parseFen(base+" b K - 0 1")),c=hashKey(parseFen(base+" w - - 0 1"));
  assert.notEqual(a,b);assert.notEqual(a,c);
  assert.equal(hashKey(parseFen(base+" w K - 0 1")),a);   // 同じ局面は同じ鍵
});
