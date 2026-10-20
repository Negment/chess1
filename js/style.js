"use strict";
/* ---------- 棋風(評価が近い候補の中から、好みで選び直す。Maia には影響しない) ---------- */
const ST_PIECES={K:"キング",Q:"クイーン",R:"ルーク",B:"ビショップ",N:"ナイト",P:"ポーン"};
const stDef=()=>({move:[],moveW:1,keep:[],keepW:1,prot:[],protW:1,maxDist:7,distW:0,
  repeat:0,develop:0,center:0,forward:0,flank:0,capture:0,check:0,trade:0,pawn:0,castle:0,aggr:0});
let STYLE={on:false,tol:30,n:5,side:"w",w:stDef(),b:stDef()};
try{
  const j=JSON.parse(localStorage.getItem("chessStyle")||"null");
  if(j)STYLE={...STYLE,...j,w:{...stDef(),...(j.w||{})},b:{...stDef(),...(j.b||{})}};
}catch(e){}
const stSave=()=>{try{localStorage.setItem("chessStyle",JSON.stringify(STYLE))}catch(e){}};
const styleN=()=>STYLE.on?STYLE.n:0;

/* 駒に対する、最も価値の低い攻撃駒の価値(なければ Infinity) */
function stMinAtt(b,sq,byW){
  const r=sq>>3,c=sq&7,dr=byW?1:-1;let best=Infinity;
  const ok=(rr,cc)=>rr>=0&&rr<8&&cc>=0&&cc<8;
  for(const dc of[-1,1]){const rr=r+dr,cc=c+dc;if(ok(rr,cc)&&b[rr*8+cc]===(byW?"P":"p"))best=Math.min(best,1)}
  for(const[a,d]of NN){const rr=r+a,cc=c+d;if(ok(rr,cc)&&b[rr*8+cc]===(byW?"N":"n"))best=Math.min(best,3.2)}
  for(const[a,d]of KK){const rr=r+a,cc=c+d;if(ok(rr,cc)&&b[rr*8+cc]===(byW?"K":"k"))best=Math.min(best,100)}
  for(const[ds,x,v]of[[DG,"B",3.3],[RK,"R",5]])for(const[a,d]of ds){
    let rr=r+a,cc=c+d;
    while(ok(rr,cc)){
      const p=b[rr*8+cc];
      if(p){const u=p.toUpperCase();if(isW(p)===byW){if(u===x)best=Math.min(best,v);else if(u==="Q")best=Math.min(best,9)}break}
      rr+=a;cc+=d;
    }
  }
  return best;
}
function stRisk(b,color,list){   // 捨てたくない駒が、危険な度合い
  if(!list.length)return 0;
  const w=color==="w";let v=0;
  for(let i=0;i<64;i++){
    const p=b[i];if(!p||isW(p)!==w)continue;
    const u=p.toUpperCase(),k=list.indexOf(u);if(k<0||u==="K")continue;
    const att=stMinAtt(b,i,!w);if(att===Infinity)continue;
    if(!attacked(b,i,w)||att<PVAL[u.toLowerCase()]-0.5)v+=(list.length-k)/list.length;
  }
  return v;
}
function stProt(b,color,list){   // 守りたい駒が、守られている度合い
  if(!list.length)return 0;
  const w=color==="w";let v=0;
  for(let i=0;i<64;i++){
    const p=b[i];if(!p||isW(p)!==w)continue;
    const u=p.toUpperCase(),k=list.indexOf(u);if(k<0||u==="K")continue;
    if(attacked(b,i,w))v+=(list.length-k)/list.length;
  }
  return v;
}
function stScore(s,m,cfg,ctx){
  const w=s.t==="w",b=s.b,p=b[m.f],u=p.toUpperCase(),ns=make(s,m);
  const rk=q=>w?7-(q>>3):(q>>3),cen=q=>3.5-Math.max(Math.abs((q>>3)-3.5),Math.abs((q&7)-3.5));
  const dist=Math.max(Math.abs((m.f>>3)-(m.t>>3)),Math.abs((m.f&7)-(m.t&7)));
  const cap=!!b[m.t]||(u==="P"&&(m.f&7)!==(m.t&7)),parts=[];
  const add=(n,v)=>{if(v&&isFinite(v))parts.push([n,v])};
  if(cfg.move.length&&cfg.moveW){const k=cfg.move.indexOf(u);if(k>=0)add("動かす駒の優先",cfg.moveW*(1-k/cfg.move.length))}
  if(cfg.keep.length&&cfg.keepW)add("捨てない駒",-cfg.keepW*(stRisk(ns.b,s.t,cfg.keep)-stRisk(b,s.t,cfg.keep)));
  if(cfg.prot.length&&cfg.protW)add("守る駒",cfg.protW*(stProt(ns.b,s.t,cfg.prot)-stProt(b,s.t,cfg.prot)));
  if(cfg.distW&&dist>cfg.maxDist)add("長い移動を避ける",-cfg.distW*(dist-cfg.maxDist)/2);
  if(cfg.repeat&&ctx.prevTo===m.f)add(cfg.repeat>0?"同じ駒を続ける":"同じ駒の連続を避ける",cfg.repeat);
  if(cfg.develop&&(u==="N"||u==="B")&&rk(m.f)===0)add("駒の展開",cfg.develop);
  add(cfg.center>0?"中央へ":"端へ",cfg.center*(cen(m.t)-cen(m.f))/3);
  add(cfg.forward>0?"前進":"後退",cfg.forward*Math.max(-1,Math.min(1,(rk(m.t)-rk(m.f))/3)));
  add(cfg.flank>0?"キング側":"クイーン側",cfg.flank*(((m.t&7)-3.5)/3.5));
  if(cap)add(cfg.capture>0?"駒を取る":"取りを避ける",cfg.capture);
  if(/[+#]$/.test(san(s,m)))add(cfg.check>0?"チェック":"チェックを避ける",cfg.check);
  if(cap){
    const tv=PVAL[(b[m.t]||"p").toLowerCase()],mv=PVAL[u.toLowerCase()];
    if(tv>=0.8*mv&&attacked(ns.b,m.t,!w))add(cfg.trade>0?"駒の交換":"交換を避ける",cfg.trade);
  }
  if(u==="P")add(cfg.pawn>0?"ポーンを突く":"ポーンを控える",cfg.pawn);
  if(u==="K"&&Math.abs(m.t-m.f)===2)add("キャスリング",cfg.castle*1.5);
  if(cfg.aggr&&u!=="K"){
    const ek=b.indexOf(w?"k":"K"),dk=q=>Math.max(Math.abs((q>>3)-(ek>>3)),Math.abs((q&7)-(ek&7)));
    add(cfg.aggr>0?"敵キングに近づく":"敵キングから離れる",cfg.aggr*Math.max(-1,Math.min(1,(dk(m.f)-dk(m.t))/3)));
  }
  const score=parts.reduce((a,x)=>a+x[1],0);
  parts.sort((x,y)=>Math.abs(y[1])-Math.abs(x[1]));
  return{score,why:parts.filter(x=>Math.abs(x[1])>=0.05).slice(0,2).map(x=>x[0]+"("+(x[1]>0?"+":"")+x[1].toFixed(2)+")").join("、")};
}
/* st: 指す側の局面、r: best() の結果。評価が近い候補の中から、棋風に合う手を選ぶ */
function styleApply(st,r,who){
  if(!STYLE.on||!r||!r.m)return null;
  const cfg=st.t==="w"?STYLE.w:STYLE.b;
  const c0=[{m:r.m,cp:r.cp,cat:r.cat},...(r.alts||[]).map(a=>({m:a.m,cp:a.cp,cat:a.cat}))];
  if(c0.length<2)return{none:true,note:"候補が1つだけです(Stockfish かテーブルベースが必要です)"};
  let eq;
  if(r.src==="tb")eq=c0.filter(c=>c.cat===c0[0].cat);
  else if(c0[0].cp==null)return{none:true,note:"評価値がないため、棋風は使えません"};
  else eq=c0.filter(c=>c.cp!=null&&c.cp>=c0[0].cp-STYLE.tol);
  if(eq.length<2)return{none:true,note:"評価が近い候補がほかにないため、1番手のままです"};
  const prev=who==="opp"?hist[pos].mv:(pos>0?hist[pos-1].mv:null),ctx={prevTo:prev?prev.t:-1};
  const sc=eq.map(c=>({...c,...stScore(st,c.m,cfg,ctx)})).sort((a,b)=>b.score-a.score||(b.cp??0)-(a.cp??0));
  const ch=sc[0];
  return{m:ch.m,cp:ch.cp,diff:ch.cp!=null&&c0[0].cp!=null?ch.cp-c0[0].cp:0,why:ch.why,set:sc,same:ch.m===c0[0].m};
}

/* ---------- 設定画面 ---------- */
const ST_SL=[["repeat","同じ駒を続けて動かす","避ける","続ける"],["develop","駒の展開(ナイト・ビショップを動かす)","控える","重視"],
  ["center","位置: 中央・端","端を好む","中央を好む"],["forward","位置: 前進・後退","後退(守り)","前進"],["flank","攻める側","クイーン側","キング側"],
  ["capture","駒を取る","取りを避ける","取りを好む"],["check","チェックをかける","避ける","好む"],["trade","駒の交換","避ける","好む"],
  ["pawn","ポーンを突く","控える","突く"],["castle","キャスリング(早く行う)","気にしない","早く行う"],["aggr","攻めと守り","守備的","攻撃的"]];
const ST_PRESET={
  "攻撃的":{aggr:0.75,forward:0.5,capture:0.5,check:0.5,pawn:0.25,castle:0.5,develop:0.5},
  "守備的":{aggr:-0.75,forward:-0.25,capture:-0.25,castle:1,develop:0.5,keep:["Q","R","B","N"],keepW:1.5,prot:["Q","R"],protW:1},
  "堅実(捨てない)":{keep:["Q","R","B","N","P"],keepW:2,prot:["Q","R","B","N"],protW:1,trade:-0.25},
  "展開重視":{develop:1,move:["N","B","Q","R","P","K"],moveW:1,castle:0.75,pawn:-0.25,repeat:-0.5}
};
function stList(cfg,key,label,hint){
  const L=cfg[key],opts=Object.keys(ST_PIECES).filter(x=>key==="move"||x!=="K").filter(x=>!L.includes(x));
  return`<div class="stl"><div class="sub"><b>${label}</b> ${hint}</div><div class="row">`
    +(L.length?L.map((u,i)=>`<span class="chip">${i+1}. ${ST_PIECES[u]} <button data-st="up" data-k="${key}" data-i="${i}">▲</button><button data-st="dn" data-k="${key}" data-i="${i}">▼</button><button data-st="rm" data-k="${key}" data-i="${i}">×</button></span>`).join(""):'<span class="sub">未設定</span>')
    +`</div><div class="row"><select data-add="${key}">${opts.map(x=>`<option value="${x}">${ST_PIECES[x]}</option>`).join("")}</select><button data-st="add" data-k="${key}">追加</button>`
    +`<label class="sub">強さ <input type="range" min="0" max="3" step="0.5" value="${cfg[key+"W"]}" data-w="${key}W"> <b>${cfg[key+"W"]}</b></label></div></div>`;
}
function stRender(){
  const m=$("styleMount");if(!m)return;
  const cfg=STYLE[STYLE.side],sd=STYLE.side==="w"?"白":"黒";
  m.innerHTML=`<div class="card"><h2>棋風</h2>
  <div class="row"><label class="sub"><input type="checkbox" id="stOn" ${STYLE.on?"checked":""}>棋風を使う</label>
    <label class="sub">許容する評価差 <input type="number" id="stTol" min="0" max="300" step="5" value="${STYLE.tol}" style="width:4.5em">cp</label>
    <label class="sub">候補の数 <input type="number" id="stN" min="2" max="8" value="${STYLE.n}" style="width:3.5em"></label></div>
  <div class="sub">エンジンの1番手と評価が近い候補(許容する評価差の中)だけを対象に、下の好みで選び直します。1番手を大きく変えるものではなく、あくまで目安です。Maia の予想には影響しません。結果は、「解析」タブの最善手の欄に、「棋風」として出ます。</div>
  <div class="row"><button data-st="side" data-k="w" class="${STYLE.side==="w"?"on":""}">白の棋風</button><button data-st="side" data-k="b" class="${STYLE.side==="b"?"on":""}">黒の棋風</button>
    <button data-st="copy" data-k="w">白→黒にコピー</button><button data-st="copy" data-k="b">黒→白にコピー</button></div>
  <div class="row"><span class="sub">${sd}にプリセットを適用:</span>${Object.keys(ST_PRESET).map(k=>`<button data-st="preset" data-k="${k}">${k}</button>`).join("")}<button data-st="reset">初期化</button></div></div>
<div class="card"><h2>${sd}の棋風</h2>
  ${stList(cfg,"move","動かす駒の優先順位","(上ほど優先。入れた駒だけが対象)")}
  ${stList(cfg,"keep","捨てない駒の順位","(上ほど捨てたくない。危険にさらす手を避ける)")}
  ${stList(cfg,"prot","守る駒の順位","(上ほど、守られた状態を保ちたい)")}
  <div class="stsl"><span>一度に動かす距離</span><span class="sub">上限 <input type="range" min="1" max="7" step="1" value="${cfg.maxDist}" data-w="maxDist"> <b>${cfg.maxDist}</b>マス / 超えたら減点の強さ <input type="range" min="0" max="3" step="0.5" value="${cfg.distW}" data-w="distW"> <b>${cfg.distW}</b></span></div>
  ${ST_SL.map(([k,n,lo,hi])=>`<div class="stsl"><span>${n}</span><span class="sub">${lo}<input type="range" min="${k==="castle"?0:-1}" max="1" step="0.25" value="${cfg[k]}" data-w="${k}">${hi} <b>${cfg[k]}</b></span></div>`).join("")}
</div>`;
}
function stMount(){
  const m=$("styleMount");
  m.addEventListener("click",e=>{
    const b=e.target.closest("[data-st]");if(!b)return;
    const a=b.dataset.st,k=b.dataset.k,cfg=STYLE[STYLE.side],i=+b.dataset.i;
    if(a==="side")STYLE.side=k;
    else if(a==="up"&&i>0)[cfg[k][i-1],cfg[k][i]]=[cfg[k][i],cfg[k][i-1]];
    else if(a==="dn"&&i<cfg[k].length-1)[cfg[k][i+1],cfg[k][i]]=[cfg[k][i],cfg[k][i+1]];
    else if(a==="rm")cfg[k].splice(i,1);
    else if(a==="add"){const v=m.querySelector(`[data-add="${k}"]`).value;if(v&&!cfg[k].includes(v))cfg[k].push(v)}
    else if(a==="copy"){const to=k==="w"?"b":"w";STYLE[to]=JSON.parse(JSON.stringify(STYLE[k]))}
    else if(a==="preset")Object.assign(STYLE[STYLE.side],JSON.parse(JSON.stringify(ST_PRESET[k])));
    else if(a==="reset")STYLE[STYLE.side]=stDef();
    stSave();stRender();
  });
  m.addEventListener("input",e=>{
    const t=e.target,cfg=STYLE[STYLE.side];
    if(t.dataset.w){cfg[t.dataset.w]=parseFloat(t.value);let n=t.nextSibling;while(n&&n.tagName!=="B")n=n.nextSibling;if(n)n.textContent=t.value;stSave()}
  });
  m.addEventListener("change",e=>{
    const t=e.target;
    if(t.id==="stOn")STYLE.on=t.checked;
    if(t.id==="stTol")STYLE.tol=Math.max(0,Math.min(300,parseInt(t.value,10)||0));
    if(t.id==="stN")STYLE.n=Math.max(2,Math.min(8,parseInt(t.value,10)||5));
    stSave();
  });
  stRender();
}
stMount();
