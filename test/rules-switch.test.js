// ルールの切り替え: キャスリングとアンパッサンを、設定でON/OFFできる(既定は標準どおりON)
const test=require("node:test"),assert=require("node:assert/strict");
const vm=require("vm");
const {load,pick}=require("./helpers");
const ctx=load(["chess.js"]);
const E=pick(ctx,["parseFen","legal","make"]);
const setRules=(c,e)=>vm.runInContext(`RULES.castle=${c};RULES.ep=${e}`,ctx);
const withRules=(c,e,fn)=>{try{setRules(c,e);return fn()}finally{setRules(true,true)}};
const has=(ms,f,t)=>ms.some(m=>m.f===f&&m.t===t);

const CASTLE_FEN="r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";   // 白は e1→g1 でキャスリングできる
const EP_FEN="4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1";           // 黒の d4 が e3 でアンパッサンできる

test("既定(ON)では、キャスリングができる",()=>{
  const s=E.parseFen(CASTLE_FEN);
  assert.ok(has(E.legal(s),60,62));
});
test("キャスリングをOFFにすると、権利が消えて指せない",()=>{
  withRules(false,true,()=>{
    const s=E.parseFen(CASTLE_FEN);
    assert.equal(s.c,"");
    assert.equal(has(E.legal(s),60,62),false);
  });
});
test("既定(ON)では、アンパッサンができる",()=>{
  const s=E.parseFen(EP_FEN);
  assert.ok(has(E.legal(s),35,44));
});
test("アンパッサンをOFFにすると、欄を捨てて、取れなくなる",()=>{
  withRules(true,false,()=>{
    const s=E.parseFen(EP_FEN);
    assert.equal(s.e,-1);
    assert.equal(has(E.legal(s),35,44),false);
  });
});
test("アンパッサンをOFFにすると、二マス進みの記録を残さない",()=>{
  const start="4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
  assert.equal(E.make(E.parseFen(start),{f:52,t:36,pr:""}).e,44);   // ON: e3 を記録
  withRules(true,false,()=>{
    assert.equal(E.make(E.parseFen(start),{f:52,t:36,pr:""}).e,-1); // OFF: 記録しない
  });
});
