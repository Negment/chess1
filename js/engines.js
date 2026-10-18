"use strict";
/* ---------- テーブルベース(Lichess) ---------- */
const CAT={win:"勝ち確定",loss:"負け確定",draw:"引き分け確定","cursed-win":"勝ち(50手ルールで引き分け)","blessed-loss":"負け(50手ルールで引き分け)","maybe-win":"おそらく勝ち","maybe-loss":"おそらく負け",unknown:"不明"};
const INV={win:"loss",loss:"win","cursed-win":"blessed-loss","blessed-loss":"cursed-win",draw:"draw"};
async function tb(s,ms,am,n){
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),5000);
  try{
    const r=await fetch("https://tablebase.lichess.ovh/standard?fen="+encodeURIComponent(toFen({...s,c:""})),{signal:ac.signal});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const j=await r.json();
    if(!j.moves||!j.moves.length)return null;
    const o=[];for(const x of j.moves){const m=am.find(y=>uci(y)===x.uci);if(m)o.push({m,c:x.category,top:x===j.moves[0]})}
    if(!o.length)return null;
    const tx=x=>CAT[INV[x.c]||x.c]||x.c;
    const ex=o[0].top&&j.dtm!=null?` / 詰みまで約${Math.ceil(Math.abs(j.dtm)/2)}手`:"";
    return {m:o[0].m,src:"tb",text:(o[0].top?CAT[j.category]||j.category:tx(o[0]))+ex,alts:o.slice(1,n).map(x=>({m:x.m,text:tx(x)}))};
  }finally{clearTimeout(t)}
}
/* ---------- Stockfish(同じフォルダのファイルをWeb Workerで起動) ---------- */
const SF_DIRS=["engines/stockfish/",""];   // まずこのフォルダ、なければ直下を探す
const SF_FILES=["stockfish-19-single.js","stockfish-18-single.js","stockfish-19-lite-single.js","stockfish-18-lite-single.js","stockfish.js"];
let sf=null,sfNone=false,sfP=null;
const setSt=(id,t)=>{const x=$(id);if(x)x.textContent=t};
function sfLoad(force){
  if(sf)return Promise.resolve(sf);
  if(force)sfNone=false;
  if(sfNone)return Promise.resolve(null);
  if(!sfP)sfP=sfInit().finally(()=>{sfP=null});
  return sfP;
}
async function sfInit(){
  const t0=Date.now();let cur="";
  const tick=setInterval(()=>setSt("sfSt",`起動中… ${cur}(${Math.round((Date.now()-t0)/1000)}秒)`),500);
  try{
    for(const f of SF_DIRS.flatMap(d=>SF_FILES.map(n=>d+n))){
      cur=f;setSt("sfSt","起動中… "+f);
      try{
        const w=new Worker(f);
        const ok=await new Promise(res=>{
          const to=setTimeout(()=>res(false),90000);
          w.onmessage=ev=>{if(String(ev.data).trim()==="uciok"){clearTimeout(to);res(true)}};
          w.onerror=()=>{clearTimeout(to);res(false)};
          w.postMessage("uci");
        });
        if(ok){w.fname=f;sf=w;setSt("sfSt","準備完了: "+f);return sf}
        w.terminate();
      }catch(x){}
    }
    sfNone=true;setSt("sfSt","起動できませんでした(自作エンジンで代替)");return null;
  }finally{clearInterval(tick)}
}
function sfBest(w,s,am,all,t,N){
  return new Promise(res=>{
    const L={},to=setTimeout(()=>w.postMessage("stop"),t+5000);
    w.onmessage=e=>{
      const l=String(e.data);
      if(l.startsWith("info")&&l.includes(" pv ")&&l.includes(" score ")&&!/lowerbound|upperbound/.test(l)){
        const i=+((l.match(/multipv (\d+)/)||[0,1])[1]),d=l.match(/ depth (\d+)/),c=l.match(/score cp (-?\d+)/),m=l.match(/score mate (-?\d+)/),p=l.match(/ pv (\S+)/);
        L[i]={dep:d?+d[1]:0,sc:c?{cp:+c[1]}:m?{mate:+m[1]}:null,u:p[1]};
      }
      if(l.startsWith("bestmove")){clearTimeout(to);res(Object.keys(L).sort((a,b)=>a-b).map(k=>({...L[k],m:am.find(x=>uci(x)===L[k].u)})).filter(x=>x.m))}
    };
    w.postMessage("setoption name MultiPV value "+Math.min(N,am.length));
    w.postMessage("position fen "+toFen(s));
    w.postMessage("go movetime "+t+(am.length<all.length?" searchmoves "+am.map(uci).join(" "):""));
  });
}
const sfTxt=sc=>!sc?"":sc.mate!=null?(sc.mate>0?`${sc.mate}手で詰み`:`${-sc.mate}手で詰まされる`):scoreText(sc.cp);
const CACHE=new Map(),MCACHE=new Map();
const cacheInfo=()=>setSt("cacheN","保存した計算結果: "+(CACHE.size+MCACHE.size)+"件");
function keep(key,N,t,r){CACHE.set(key,{N,t,res:{...r,alts:r.alts?r.alts.slice():undefined}});cacheInfo();return r}
async function best(s){
  const ms=legal(s);if(!ms.length)return null;
  const N=+$("npv").value,t=+$("tl").value,rm=$("rep").value,lim=rm==="ban3"?2:1;
  let am=ms,note="";
  if(rm!=="off"){
    const ok=ms.filter(m=>prior(make(s,m))<lim);
    if(ok.length&&ok.length<ms.length){am=ok;note=`繰り返しになる${ms.length-ok.length}手を除外`}
    else if(!ok.length)note="どの手も繰り返しになります";
  }
  const nt=note?" / "+note:"";
  const key=rkey(s)+"|"+(am.length<ms.length?am.map(uci).join(","):"*")+"|"+($("useTB").checked?1:0)+($("useSF").checked?1:0);
  const c=CACHE.get(key);
  if(c&&c.N>=N&&(c.res.src==="tb"||c.t>=t)&&(c.res.src!=="se"||sfNone||!$("useSF").checked))
    return {...c.res,text:c.res.text+" ／ 保存済みの結果を再利用",alts:(c.res.alts||[]).slice(0,N-1)};
  if(s.b.filter(Boolean).length<=7&&$("useTB").checked){
    try{const r=await tb(s,ms,am,N);if(r){r.text+=nt;return keep(key,N,t,r)}}catch(x){note=(note?note+" / ":"")+"テーブルベースに接続できないため探索に切替"}
  }
  if($("useSF").checked){
    const w=await sfLoad();
    if(w){
      const L=await sfBest(w,s,am,ms,t,N);
      if(L.length)return keep(key,N,t,{m:L[0].m,src:"sf",text:`${w.fname} / 深さ${L[0].dep}手 / ${sfTxt(L[0].sc)}${note?" / "+note:""}`,
        alts:L.slice(1).map(x=>({m:x.m,text:`深さ${x.dep}手 / ${sfTxt(x.sc)}`}))});
    }else note=(note?note+" / ":"")+"Stockfishを読み込めないため自作エンジンに切替";
  }
  await new Promise(r=>setTimeout(r,30));
  const r=search(s,am,t,8);
  return keep(key,N,t,{m:r.m,src:"se",text:`深さ${r.depth}手 / ${scoreText(r.score)}${note?" / "+note:""}`});
}

/* ---------- Maia(人間らしい手) ---------- */
// maia3-js を engines/maia/ に置く。ファイル名が違う場合は module をそれに合わせる。
const MAIA_CFG={
  module:"engines/maia/web.js",   // maia3-js の「/web」に当たるファイル
  variant:"5m",                   // 5m は npm パッケージに同梱
  modelUrl:null                   // 同梱以外のモデルを使うときだけURLを書く
};
let maia=null,maP=null;
function maiaLoad(prog){
  if(maia)return Promise.resolve(maia);
  if(!maP)maP=(async()=>{
    setSt("maSt","起動中…");
    try{
      const mod=await import(new URL(MAIA_CFG.module,location.href).href);
      const o={variant:MAIA_CFG.variant,onProgress:(l,t)=>{const p="モデル読み込み中"+(t?" "+Math.round(l/t*100)+"%":"");setSt("maSt",p);prog&&prog(p)}};
      if(MAIA_CFG.modelUrl)o.url=new URL(MAIA_CFG.modelUrl,location.href).href;
      const m=new mod.Maia3(o);await m.load();maia=m;setSt("maSt","準備完了("+MAIA_CFG.variant+")");return m;
    }catch(x){setSt("maSt","起動失敗: "+(x&&x.message||x));throw x}
  })().finally(()=>{maP=null});
  return maP;
}
async function maiaPredict(s,selfElo,oppoElo,N,prog){
  const key=rkey(s)+"|"+selfElo+"|"+oppoElo,c=MCACHE.get(key);
  if(c&&c.N>=N)return c.list.slice(0,N);
  const m=await maiaLoad(prog),mv=legal(s);
  const r=await m.predict({fen:toFen(s),selfElo,oppoElo,topK:N});
  const list=r.candidates.map(x=>({m:mv.find(y=>uci(y)===x.uci),p:x.probability,win:x.winProbability})).filter(x=>x.m).slice(0,N);
  MCACHE.set(key,{N,list});cacheInfo();
  return list;
}
