// おまかせ: ACPL→レート換算(純粋な計算)
const test=require("node:test"),assert=require("node:assert/strict");
const {load,pick}=require("./helpers");
const A=pick(load(["chess.js","auto.js"]),["acplToRating"]);

test("ACPLが小さいほどレートが高い(単調減少)",()=>{
  let prev=Infinity;
  for(const a of [5,10,15,25,40,60,100,150,250]){
    const r=A.acplToRating(a);assert.ok(r<=prev,`acpl ${a}`);prev=r;
  }
});
test("ACPLの端は表の端の値になる",()=>{
  assert.equal(A.acplToRating(0),2800);
  assert.equal(A.acplToRating(999),700);
});
test("ACPL 50 は表どおり 1850",()=>{assert.equal(A.acplToRating(50),1850)});
