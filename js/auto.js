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

/* 点数の合成(純粋な計算)。ev は手番側から見た評価(cp)、style は棋風の点数(-1〜1 の目安)。
   棋風は、設定されているときだけ、kappa(cp/単位)で小さく加える。 */
const STYLE_KAPPA=20;
function scoreMoves(list,styleOn,kappa=STYLE_KAPPA){
  return list.map(x=>({...x,total:x.ev+(styleOn&&x.style?kappa*x.style:0)}))
             .sort((a,b)=>b.total-a.total);
}

/* 最適解の算出:
   点数(候補m) = Σ 相手の応手r × P_Maia(r | 相手のレート) × Stockfishの評価(mの後にrを指した局面、手番側から)
   Maiaの勝率は使わない。Maiaは「相手が何を指すか」の確率だけ出す。 */
async function autoBest(){
  const out=$("autoRes"),s=S(),err=validate(s);
  if(err){out.textContent=err;return}
  if(!legal(s).length){out.textContent="指せる手がありません";return}
  const me=s.t,op=me==="w"?"b":"w",fen0=toFen(s),useStyle=styleSet(me);
  const myElo=eloVal("eloMe"),opElo=eloVal("eloOpp");
  const ct=x=>x==null?"—":(x>=0?"+":"")+(x/100).toFixed(2);
  const log=[];
  if(!$("maHist").checked){$("maHist").checked=true}
  log.push("履歴: 直近の棋譜をMaiaに渡して、相手の応手を予想します");
  log.push(`レート: 自分 ${myElo} / 相手 ${opElo}(相手の応手の確率に使います)`);
  log.push(useStyle?`棋風: ${colorName(me)}の設定を、点数の小さな補正に使います`:`棋風: ${colorName(me)}は未設定のため使いません`);
  out.textContent="候補を計算中…";

  // 1. 候補手(エンジン。最大3手)
  const npvSel=$("npv"),savedN=npvSel.value;
  npvSel.value="3";
  let r=null;
  try{r=await best(s)}
  catch(e){if(e===ABORT){return}}
  finally{npvSel.value=savedN}
  if(!r||!r.m){out.textContent="候補を出せませんでした";return}
  const cands=[{m:r.m,cp:r.cp},...(r.alts||[]).map(a=>({m:a.m,cp:a.cp}))].slice(0,3);

  // 2. 各候補について、相手の応手の確率で重みづけしたStockfish評価を出す
  const t=Math.min(+$("tl").value,1000);   // 1局面あたりの時間(長くなりすぎないよう上限を付ける)
  const rows=[];
  try{
    for(let k=0;k<cands.length;k++){
      if(toFen(S())!==fen0)return;          // 途中で局面が変わったら止める
      const c=cands[k],ns=make(s,c.m),sn=san(s,c.m);
      out.textContent=`相手の応手を予想し、評価しています… ${k+1}/${cands.length}`;
      if(!legal(ns).length){
        rows.push({m:c.m,sn,ev:inCheck(ns,ns.t==="w")?3000:0,top:null,pTop:0});
        continue;
      }
      const L=await maiaPredict(ns,opElo,myElo,5,null,priorFens("after"));
      const P=L.reduce((a,x)=>a+x.p,0)||1;
      let ev=0;
      for(const x of L){
        const e=await evalPos(make(ns,x.m),t);   // 相手が手を指した後の局面。相手の手番から見た値
        ev+=(x.p/P)*(-e.cp);                      // 手番側(自分)の視点に直す
      }
      const tp=L.reduce((a,x)=>x.p>a.p?x:a,L[0]);
      rows.push({m:c.m,sn,ev,top:san(ns,tp.m),pTop:tp.p/P});
    }
  }catch(e){
    if(e===ABORT)return;
    out.textContent="計算に失敗しました: "+(e&&e.message||e);
    return;
  }

  // 3. 棋風(設定があるときだけ)
  const cfg=me==="w"?STYLE.w:STYLE.b;
  const ctx={prevTo:pos>0&&hist[pos-1].mv?hist[pos-1].mv.t:-1};
  const withStyle=rows.map(x=>{const st=useStyle?stScore(s,x.m,cfg,ctx):{score:0,why:""};return{...x,style:st.score,why:st.why}});
  const ranked=scoreMoves(withStyle,useStyle);
  const pick=ranked[0];

  // 4. 表示
  out.innerHTML=log.map(x=>`<div class="sub">${x}</div>`).join("")
    +`<div class="res" style="margin-top:6px"><b>最適解: ★${pick.sn}</b> <span class="tag mh">点数 ${ct(pick.total)}</span></div>`
    +ranked.map((x,i)=>`<div class="sub">${i+1}. ${x.sn}: 点数 ${ct(x.total)}(Stockfishの平均 ${ct(x.ev)}${x.top?` / 相手の予想応手 ${x.top}(${Math.round(x.pTop*100)}%)`:""})${useStyle&&x.why?" / 棋風: "+x.why:""}</div>`).join("")
    +`<div class="sub">点数は、相手の応手を確率で重みづけした、その後の局面のStockfish評価の平均です。黄色の矢印が最適解です。</div>`
    +`<div class="row" style="margin-top:6px"><button id="autoPlay" class="go">この手を指す</button></div>`;

  autoPick=pick.m||null;autoPickFen=fen0;
  if(mode==="play")drawArrows();
  const btn=$("autoPlay");
  if(btn)btn.onclick=()=>{
    if(toFen(S())!==fen0){msg("局面が変わったため、もう一度算出してください");return}
    if(pick.m)doMove(pick.m);
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

/* ルールの切り替え: 履歴の全局面に反映する(OFFのとき、キャスリング権とアンパッサン欄を消す) */
function applyRules(){
  RULES.castle=!!$("ruleCastle")?.checked;
  RULES.ep=!!$("ruleEP")?.checked;
  for(const h of hist){
    let c=h.s.c,e=h.s.e;
    if(!RULES.castle)c="";
    if(!RULES.ep)e=-1;
    h.s={...h.s,c,e};
  }
  if(typeof render==="function")render();
}
{
  const w=(id,fn)=>{const el=document.getElementById(id);if(el)el.onchange=fn};
  w("ruleCastle",()=>applyRules());
  w("ruleEP",()=>applyRules());
}
