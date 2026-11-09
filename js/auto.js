"use strict";
/* ---------- おまかせ ---------- */
const colorName=c=>c==="w"?"白":"黒";   // 注意: chess.js に nm() があるので別名にする

/* 平均損失(ACPL, cp)から目安のレートを求める。表の間は直線で補間する。 */
const ACPL_TABLE=[[10,2800],[20,2400],[30,2150],[50,1850],[80,1450],[120,1100],[200,700]];
function acplToRating(a){
  const T=ACPL_TABLE;
  if(a<=T[0][0])return T[0][1];
  if(a>=T[T.length-1][0])return T[T.length-1][1];
  for(let k=1;k<T.length;k++)if(a<=T[k][0]){
    const[x0,y0]=T[k-1],[x1,y1]=T[k];
    return Math.round(y0+(y1-y0)*(a-x0)/(x1-x0));
  }
  return T[T.length-1][1];
}

/* 復習タブの解析から、指定した側の平均損失(cp)。手が少なすぎれば null。 */
function sideAcpl(c){
  const done=rvRows().filter(r=>r.cls&&r.mover===c);
  if(done.length<8)return null;
  return done.reduce((t,x)=>t+Math.min(x.loss||0,500),0)/done.length;
}

function setElo(id,v){$(id).value=v;$(id+"R").value=v;if(typeof eloWarn==="function")eloWarn()}

/* 棋風が「設定されている」か。何も設定されていなければ最適解の計算では考慮しない */
const ST_NUMKEYS=["repeat","develop","center","forward","flank","capture","check","trade","pawn","castle","aggr"];
function styleSet(c){
  const x=STYLE[c];
  return !!STYLE.on&&(ST_NUMKEYS.some(k=>x[k])||["move","keep","prot"].some(k=>x[k]&&x[k].length));
}

/* レート算出: この棋譜の全手をエンジンで解析し、平均損失から両者の目安レートを入れる */
async function autoRate(){
  const out=$("autoRes");
  if(hist.length<2){out.textContent="手を指してから押してください";return}
  out.textContent="エンジンで全手を解析中…(手数によって時間がかかります)";
  await gaRun(false);
  const s=S(),mv=s.t,op=mv==="w"?"b":"w";
  const aM=sideAcpl(mv),aO=sideAcpl(op);
  const rate=a=>a==null?null:acplToRating(a);
  const lines=[];
    for(const c of["w","b"]){
    const a=sideAcpl(c);
    lines.push(a==null?`${colorName(c)}: 解析できた手が少ないため算出できません(各側8手以上が目安)`
      :`${colorName(c)}: 平均損失 ${(a/100).toFixed(2)} → レートの目安 ${rate(a)}`);
  }
  if(rate(aM)!=null)setElo("eloMe",rate(aM));
  if(rate(aO)!=null)setElo("eloOpp",rate(aO));
  out.innerHTML=lines.map(x=>`<div class="sub">${x}</div>`).join("")
    +`<div class="sub">今の手番側を「自分」、反対側を「相手」として、Maiaのレートに入れました。</div>`;
}

/* 最適解の算出: レート・履歴(Maia)・Stockfish の候補・Maia の応手予想を組み合わせる。棋風は設定があるときだけ。 */
async function autoBest(){
  const out=$("autoRes"),s=S(),err=validate(s);
  if(err){out.textContent=err;return}
  if(!legal(s).length){out.textContent="指せる手がありません";return}
  const me=s.t,fen0=toFen(s),useStyle=styleSet(me);
  const log=[];
  if(!$("maHist").checked){$("maHist").checked=true}
  log.push("履歴: 直近の棋譜をMaiaに渡して予想します");
  log.push(`レート: 自分 ${eloVal("eloMe")} / 相手 ${eloVal("eloOpp")}`);
  log.push(useStyle?`棋風: ${colorName(me)}の設定を考慮します`:`棋風: ${colorName(me)}は未設定のため考慮しません`);
  out.textContent="最適解を計算中…";
  const saved=STYLE.on;
  let rows=null,fail=null;
  if(!useStyle)STYLE.on=false;
  try{rows=await humanRun()}catch(e){fail=e}
  finally{STYLE.on=saved}
  if(fail){out.textContent="計算に失敗しました";return}
  if(!rows||!rows.length){
    out.innerHTML=log.map(x=>`<div class="sub">${x}</div>`).join("")
      +`<div class="sub">候補を出せませんでした。下の「対人で有利な手を探す」欄の表示を見てください。</div>`;
    return;
  }
  const top=rows[0];
  const list=rows.slice(0,3).map((x,i)=>`<div class="sub">${i+1}. ${x.sn} ／ 期待勝率 ${Math.round(x.ew*100)}%${x.top?` ／ 相手の予想応手 ${x.top}`:""}</div>`).join("");
  out.innerHTML=log.map(x=>`<div class="sub">${x}</div>`).join("")
    +`<div class="res" style="margin-top:6px"><b>最適解: ★${top.sn}</b> <span class="tag mh">期待勝率 ${Math.round(top.ew*100)}%</span></div>`
    +list
    +`<div class="row" style="margin-top:6px"><button id="autoPlay" class="go">この手を指す</button></div>`;
  const btn=$("autoPlay");
  if(btn)btn.onclick=()=>{
    if(toFen(S())!==fen0){msg("局面が変わったため、もう一度算出してください");return}
    if(top.m)doMove(top.m);
  };
}

/* 白と黒の棋風設定を入れ替える */
function swapStyle(){
  const t=STYLE.w;STYLE.w=STYLE.b;STYLE.b=t;
  stSave();
  if(typeof stRender==="function")stRender();
  msg("白と黒の棋風を入れ替えました");
}

/* 形勢タブの見出し: 手数と局面の段階 */
function phaseLine(s,v){
  const ph=v.eg>=0.5?"終盤":pos<=20?"序盤":"中盤";
  return `第${pos}手目(${ph}) ／ 手番:${s.t==="w"?"白":"黒"}(${s.n}手目)`;
}

/* 形勢の推移グラフ(復習タブで解析した局面だけ) */
function evalGraph(){
  let d;try{d=gaData()}catch(e){return""}
  const pts=d.filter(x=>x.w!=null);
  if(pts.length<2)return'<div class="sub" style="margin-top:8px">形勢の推移: 復習タブで棋譜を解析すると、ここに出ます。</div>';
  const W=320,H=90,n=Math.max(1,hist.length-1);
  const X=i=>(i/n)*W,Y=c=>H/2-Math.max(-500,Math.min(500,c))/500*(H/2-4);
  const path=pts.map((x,k)=>(k?"L":"M")+X(x.i).toFixed(1)+" "+Y(x.w).toFixed(1)).join(" ");
  const cx=X(pos).toFixed(1);
  return `<div class="sub" style="margin-top:8px"><b>形勢の推移(白視点・±5ポーン)</b></div>`
    +`<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px"><line x1="0" x2="${W}" y1="${H/2}" y2="${H/2}" stroke="#888" stroke-dasharray="3 3"/><path d="${path}" fill="none" stroke="currentColor" stroke-width="2"/><line x1="${cx}" x2="${cx}" y1="0" y2="${H}" stroke="#c0392b"/></svg>`
    +`<div class="sub">赤線が今の局面です。</div>`;
}

{
  const w=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn};
  w("autoRate",()=>{autoRate()});
  w("autoGo",()=>{autoBest()});
  w("stSwap",()=>swapStyle());
}
