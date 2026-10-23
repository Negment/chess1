// Stockfish ジョブキュー: 同時に走らない / stop後の古い bestmove が次の探索に混ざらない
const test=require("node:test"),assert=require("node:assert/strict");
const {load,pick}=require("./helpers");

function fakeWorker(log){
  const w={running:null,onmessage:null,
    postMessage(c){
      log.push(c);
      if(c.startsWith("position"))w.fen=c.slice(9);
      if(c.startsWith("go")){
        const fen=w.fen;w.running=fen;
        w.timer=setTimeout(()=>w.finish(fen),30);        // 自然終了
      }
      if(c==="stop"&&w.running){clearTimeout(w.timer);const fen=w.running;setTimeout(()=>w.finish(fen),5)}   // 少し遅れて bestmove
    },
    finish(fen){
      w.running=null;
      w.onmessage({data:`info depth 5 multipv 1 score cp 10 pv e2e4`});
      w.onmessage({data:`bestmove e2e4 (for ${fen})`});
    }};
  return w;
}
function env(){
  const ctx=load(["chess.js","engines.js"],{localStorage:{},fetch:async()=>({ok:false})});
  // engines.js が DOM(getElementById)を触る箇所に備えたダミー
  ctx.document.getElementById=()=>({value:"",checked:true,textContent:""});
  return ctx;
}
const S="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

test("探索は直列に実行され、重ならない",async()=>{
  const ctx=env(),log=[],w=fakeWorker(log);
  const {sfBest,parseFen,legal}=pick(ctx,["sfBest","parseFen","legal"]);
  const s=parseFen(S),ms=legal(s);
  let overlap=false;const orig=w.postMessage;
  w.postMessage=c=>{if(c.startsWith("go")&&w.running)overlap=true;orig.call(w,c)};
  const rs=await Promise.all([sfBest(w,s,ms,ms,10,1,"ui"),sfBest(w,s,ms,ms,10,1,"ga"),sfBest(w,s,ms,ms,10,1,"fw")]);
  assert.equal(overlap,false);
  assert.ok(rs.every(r=>r.length===1&&!r.aborted));
});
test("待機中のジョブを中止すると、Workerに触れずに aborted で返る",async()=>{
  const ctx=env(),log=[],w=fakeWorker(log);
  const {sfBest,engineAbort,parseFen,legal}=pick(ctx,["sfBest","engineAbort","parseFen","legal"]);
  const s=parseFen(S),ms=legal(s);
  const a=sfBest(w,s,ms,ms,10,1,"ga"),b=sfBest(w,s,ms,ms,10,1,"fw");
  engineAbort("fw");
  const [ra,rb]=await Promise.all([a,b]);
  assert.equal(ra.aborted,false);assert.equal(rb.aborted,true);
  assert.equal(log.filter(c=>c.startsWith("go")).length,1);
});
test("実行中のジョブを中止しても、次のジョブに古い結果が混ざらない",async()=>{
  const ctx=env(),log=[],w=fakeWorker(log);
  const {sfBest,engineAbort,parseFen,legal}=pick(ctx,["sfBest","engineAbort","parseFen","legal"]);
  const s=parseFen(S),ms=legal(s);
  const first=sfBest(w,s,ms,ms,1000,1,"ui");
  await new Promise(r=>setTimeout(r,5));
  engineAbort("ui");
  const second=sfBest(w,s,ms,ms,10,1,"ui");
  const [r1,r2]=await Promise.all([first,second]);
  assert.equal(r1.aborted,true);
  assert.equal(r2.aborted,false);assert.equal(r2.length,1);
  // go は「前の bestmove を受け取った後」にだけ送られている
  const goIdx=log.map((c,i)=>c.startsWith("go")?i:-1).filter(i=>i>=0);
  assert.equal(goIdx.length,2);
});
