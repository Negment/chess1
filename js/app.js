"use strict";
/* ---------- 状態・履歴 ---------- */
let hist=[{s:parseFen(START),label:"初期配置"}],pos=0;
let curTab="ana",batch=0;
let mode="play",flipped=false,sel=null,pal="K",results=[],token=0,mres=null,draft=null;
const S=()=>hist[pos].s;
function validate(s){
  const wk=s.b.filter(p=>p==="K").length,bk=s.b.filter(p=>p==="k").length;
  if(wk!==1||bk!==1)return "白黒それぞれキングを1枚ずつ置いてください";
  for(let i=0;i<8;i++)if(/[Pp]/.test(s.b[i]+s.b[56+i]))return "ポーンを1段目・8段目に置くことはできません";
  if(inCheck(s,s.t!=="w"))return "手番でない側のキングがチェックされています(手番を入れ替えてください)";
  return "";
}
function msg(t){$("msg").textContent=t||""}
function cnt(s){const k=rkey(s);let c=0;for(let i=Math.max(0,pos-S().h);i<=pos;i++)if(rkey(hist[i].s)===k)c++;return c}
function prior(ns){return ns.h===0?0:cnt(ns)}
function commit(ns,label,mv){
  hist.length=pos+1;hist.push({s:ns,label,mv});pos++;reset();
}
function reset(){engineAbort("ui");engineAbort("fw");draft=null;sel=null;results=[];mres=null;token++;if(!batch)render()}
// 複数手をまとめて指す・読み込む時は、描画を最後の1回だけにする
function batched(fn){batch++;try{return fn()}finally{batch--;if(!batch)render()}}
function doMove(m){
  const s=S();
  const lb=`${s.n}${s.t==="w"?".":"…"}${san(s,m)}`;
  commit(make(s,m),lb,{f:m.f,t:m.t});
}

/* ---------- 描画 ---------- */
function insuf(s){
  const ps=[];s.b.forEach((p,i)=>{if(p&&p.toLowerCase()!=="k")ps.push([p.toLowerCase(),((i>>3)+(i&7))%2])});
  if(!ps.length)return true;
  if(ps.length===1)return ps[0][0]==="n"||ps[0][0]==="b";
  return ps.every(x=>x[0]==="b"&&x[1]===ps[0][1]);
}
function render(){
  const real=S();
  if(mode==="edit"&&!draft)draft={...real,b:real.b.slice()};
  const s=mode==="edit"?draft:real,err=validate(s);
  const ms=mode==="play"&&!err?legal(s):[];
  const tg=new Set(sel!==null?ms.filter(m=>m.f===sel).map(m=>m.t):[]);
  const lm=mode==="edit"?null:hist[pos].mv,ck=mode==="play"&&!err&&inCheck(s,s.t==="w")?s.b.indexOf(s.t==="w"?"K":"k"):-1;
  let h="";
  for(let dr=0;dr<8;dr++)for(let dc=0;dc<8;dc++){
    const q=flipped?(7-dr)*8+(7-dc):dr*8+dc,p=s.b[q];
    const cl=["sq",(dr+dc)%2?"d":"l"];
    if(lm&&(q===lm.f||q===lm.t))cl.push("lm");
    if(q===sel)cl.push("sel");
    if(q===ck)cl.push("ck");
    if(tg.has(q))cl.push("t"+(p?" cp":""));
    h+=`<div class="${cl.join(" ")}" data-q="${q}">`
      +(p?`<span class="pc ${isW(p)?"w":"k"}">${glyph(p)}</span>`:"")+"</div>";
  }
  let ov="";
  if(mode==="play"&&!err&&!legal(s).length)ov=inCheck(s,s.t==="w")?`<div class="ov mate">チェックメイト<br><small>${s.t==="w"?"黒":"白"}の勝ち</small></div>`:$("jStale").checked?'<div class="ov stale">ステイルメイト<br><small>引き分け</small></div>':"";
  if(mode==="play"&&!ov&&!err&&$("jInsuf").checked&&insuf(s))ov='<div class="ov stale">引き分け<br><small>駒が足りません(チェックメイト不可)</small></div>';
  $("bd").innerHTML=h+'<svg id="ar" viewBox="0 0 8 8"></svg>'+ov;
  $("rk").innerHTML=[8,7,6,5,4,3,2,1].map(x=>`<div>${flipped?9-x:x}</div>`).join("");
  const fls=[...F].map((x,i)=>`<div>${flipped?F[7-i]:x}</div>`).join(""),rks=[8,7,6,5,4,3,2,1].map(x=>`<div>${flipped?9-x:x}</div>`).join("");
  $("fl").innerHTML=fls;$("ft").innerHTML=fls;$("rr").innerHTML=rks;
  if(mode==="play")drawArrows();
  let st=`手番:${s.t==="w"?"白":"黒"}`;
  if(err)st+=" ／ "+err;
  else{
    const n=legal(s).length,c=inCheck(s,s.t==="w");
    if(!n)st+=c?" ／ チェックメイト!("+(s.t==="w"?"黒":"白")+"の勝ち)":$("jStale").checked?" ／ ステイルメイト(引き分け)":" ／ 指せる手がありません";
    else if(c)st+=" ／ ⚠ チェック!";
    if($("jInsuf").checked&&insuf(s))st+=" ／ 引き分け(駒不足でチェックメイトできません)";
    if($("jFifty").checked&&s.h>=100)st+=" ／ 50手ルール(引き分け請求可)";
    const rc=$("jRep").checked?cnt(s):0;if(rc>=3)st+=" ／ 同一局面3回(引き分け請求可)";else if(rc===2)st+=" ／ 同一局面2回目";
  }
  if(mode==="edit")st="配置中(未確定) ／ 手番:"+(s.t==="w"?"白":"黒")+(err?" ／ "+err:"")+(toFen(draft)!==toFen(real)?" ／ 変更あり。「確定」で盤面に反映します":"");
  $("st").textContent=st;
  $("st").className=mode==="edit"||err?"":!legal(s).length?(inCheck(s,s.t==="w")?"mate":$("jStale").checked?"stale":""):inCheck(s,s.t==="w")?"ck":$("jInsuf").checked&&insuf(s)?"stale":"";
  $("fen").value=toFen(s);
  if(typeof renderKifu==="function")renderKifu();
  $("undo").disabled=pos===0;$("redo").disabled=pos>=hist.length-1;
  document.querySelectorAll(".cr").forEach(x=>x.checked=s.c.includes(x.value));
  if(curTab==="kf")$("hl").innerHTML=hist.map((x,i)=>`<button data-i="${i}" class="${i===pos?"on":""}">${x.mv?x.label:"✎ "+x.label}</button>`).join("");
  renderRes();renderMaia();if(typeof renderEval==="function")renderEval();if(typeof renderReview==="function")renderReview();
}
function drawArrows(){
  const svg=$("ar");if(!svg)return;
  const P=q=>[(flipped?7-(q&7):q&7)+.5,(flipped?7-(q>>3):q>>3)+.5];
  let o='<defs>';
  for(const[k,c]of[["me","#1f9d55"],["opp","#d6452f"],["mh","#2f6fd6"],["st","#8e44ad"]])o+=`<marker id="m${k}" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto"><path d="M0,0L3,1.5L0,3z" fill="${c}"/></marker>`;
  o+="</defs>";
  for(const r of results){
    if(!r.m)continue;
    const c=r.w==="me"?"#1f9d55":"#d6452f";
    [[r.m,.8,.16],...(r.alts||[]).map(a=>[a.m,.35,.1])].forEach(([m,op,wd])=>{
      const[x1,y1]=P(m.f);let[x2,y2]=P(m.t);
      const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1;
      x2-=dx/L*.3;y2-=dy/L*.3;
      o+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${wd}" stroke-opacity="${op}" marker-end="url(#m${r.w})"/>`;
    });
  }
  for(const r of results){
    if(!r.style||!r.style.m||r.style.same)continue;
    const[x1,y1]=P(r.style.m.f);let[x2,y2]=P(r.style.m.t);
    const dx=x2-x1,dy=y2-y1,Ln=Math.hypot(dx,dy)||1;x2-=dx/Ln*.3;y2-=dy/Ln*.3;
    o+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8e44ad" stroke-width=".13" stroke-dasharray=".25 .15" stroke-opacity=".9" marker-end="url(#mst)"/>`;
  }
  if(mres&&mres.items)for(const it of mres.items){
    const[x1,y1]=P(it.m.f);let[x2,y2]=P(it.m.t);
    const dx=x2-x1,dy=y2-y1,Ln=Math.hypot(dx,dy)||1;x2-=dx/Ln*.3;y2-=dy/Ln*.3;
    o+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2f6fd6" stroke-width="${.06+.12*it.p}" stroke-opacity="${.3+.6*it.p}" marker-end="url(#mmh)"/>`;
  }
  svg.innerHTML=o;
}
function renderRes(pending){
  const s=S();
  let h="";
  for(const r of results){
    const who=r.w==="me"?`自分(${s.t==="w"?"白":"黒"})`:`相手(${s.t==="w"?"黒":"白"})`;
    if(!r.m){h+=`<div class="res"><b class="${r.w}">${who}</b> <span class="sub">${r.note||"指せる手がありません"}</span></div>`;continue}
    h+=`<div class="res"><b class="${r.w}">${who}</b><span class="san">${r.san}</span>`
      +`<span class="tag ${r.src}">${r.src==="tb"?"確定(テーブルベース)":r.src==="sf"?"予想(Stockfish)":"予想(探索)"}</span><br><small>${r.text}</small>`
      +(r.sure?`<br><span class="tag s${r.sure.level==="確定"?1:r.sure.level==="一部確定"?2:3}">${r.sure.level}</span> <small>${r.sure.text}</small>`:"")
      +(r.alts||[]).map((a,i)=>`<br><small>${i+2}番手: <b>${a.san}</b> ／ ${a.text}</small>`).join("")
      +(r.style?(r.style.none?`<br><span class="tag st">棋風</span> <small>${r.style.note}</small>`
        :`<br><span class="tag st">棋風</span> <small>推奨 <b>${r.style.san}</b>${r.style.same?"(エンジンの1番手と同じ)":`(1番手との差 ${(r.style.diff/100).toFixed(2)})`}${r.style.why?" ／ "+r.style.why:""}</small>`
        +`<br><small>評価が近い候補: ${r.style.set.map(x=>x.san+"("+x.score.toFixed(2)+")").join(" / ")}</small>`
        +(r.w==="me"&&!r.style.same?` <button data-playst="${results.indexOf(r)}">棋風の手を指す</button>`:"")):"")
      +(r.w==="me"?` <button data-play="${results.indexOf(r)}">この手を指す</button>`:` <small>※相手が手番ならの手</small>`)+"</div>";
  }
  if(pending)h+=`<div class="res sub">${pending}</div>`;
  if(!h)h='<span class="sub">最善手は表示するだけで、自動では指しません。</span>';
  $("res").innerHTML=h;
}

/* ---------- 操作 ---------- */
$("bd").addEventListener("click",e=>{
  const q=e.target.closest("[data-q]");if(!q)return;
  const sq=+q.dataset.q,s=S();
  if(mode==="edit"){
    const b=draft.b.slice();b[sq]=pal==="x"?"":(b[sq]===pal?"":pal);
    draft=norm({...draft,b,e:-1});render();return;
  }
  const err=validate(s);if(err){msg(err);return}
  msg("");
  if(sel!==null){
    const c=legal(s).filter(m=>m.f===sel&&m.t===sq);
    if(c.length){
      const pm=c.filter(m=>m.pr);
      if(pm.length&&$("promo").value==="ask"){showPromo(pm);return}
      doMove(c.find(m=>!m.pr||m.pr===$("promo").value)||c[0]);return;
    }
  }
  const p=s.b[sq];
  sel=p&&isW(p)===(s.t==="w")?sq:null;
  render();
});
$("hl").addEventListener("click",e=>{const b=e.target.closest("[data-i]");if(b){pos=+b.dataset.i;reset()}});
$("res").addEventListener("click",e=>{
  const b=e.target.closest("[data-play]");if(b){const r=results[+b.dataset.play];if(r&&r.m)doMove(r.m)}
  const c=e.target.closest("[data-playst]");if(c){const r=results[+c.dataset.playst];if(r&&r.style&&r.style.m)doMove(r.style.m)}
});
$("undo").onclick=()=>{if(pos>0){pos--;reset()}};
$("redo").onclick=()=>{if(pos<hist.length-1){pos++;reset()}};
document.addEventListener("keydown",e=>{
  if(e.target!==document.body||!(e.ctrlKey||e.metaKey))return;
  if(e.key==="z"){e.preventDefault();$("undo").click()}
  if(e.key==="y"){e.preventDefault();$("redo").click()}
});
$("flip").onclick=()=>{flipped=!flipped;render()};
$("turn").onclick=()=>{if(mode!=="edit")return;draft={...draft,t:draft.t==="w"?"b":"w",e:-1};render()};
$("clr").onclick=()=>{if(mode!=="edit")return;draft={b:Array(64).fill(""),t:draft.t,c:"",e:-1,h:0,n:1};render()};
$("ini").onclick=()=>{if(mode!=="edit")return;draft=parseFen(START);render()};
$("edNo").onclick=()=>{draft=null;msg("");render()};
$("edOk").onclick=()=>{
  if(mode!=="edit"||!draft)return;
  const d=norm({...draft,e:-1,h:0}),pr=fenProblems(d);
  if(pr){msg("確定できません: "+pr);return}
  commit(d,"配置");msg("配置を確定しました");
};
document.querySelectorAll(".cr").forEach(x=>x.onchange=()=>{
  if(mode!=="edit"){render();return}
  const c=[...document.querySelectorAll(".cr")].filter(i=>i.checked).map(i=>i.value).join("");
  draft=norm({...draft,c});render();
});
$("fenLoad").onclick=()=>{
  try{commit(parseFen($("fen").value),"FEN読込");msg("")}catch(e){msg(e.message)}
};
$("fenCopy").onclick=async()=>{
  try{await navigator.clipboard.writeText($("fen").value);msg("")}
  catch(e){$("fen").select();document.execCommand("copy")}
};
function inputMoves(){
  if(mode==="edit"){msg("配置の編集中です。別のタブに切り替えると、指せます");return}
  const toks=$("mv").value.replace(/\d+\s*\.+/g,"").replace(/\{[^}]*\}/g,"").split(/\s+/).filter(t=>t&&!/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  if(!toks.length)return;
  let err=validate(S());if(err){msg(err);return}
  let bad=null;
  batched(()=>{for(const t of toks){const m=parseTok(S(),t);if(!m){bad=t;return}doMove(m)}});
  if(bad){msg(`「${bad}」は今の局面で指せない、または曖昧な手です`);return}
  $("mv").value="";msg("");
}
$("mvGo").onclick=inputMoves;
$("mv").addEventListener("keydown",e=>{if(e.key==="Enter")inputMoves()});
$("pal").innerHTML="KQRBNP".split("").map(p=>`<button data-p="${p}" style="color:#fff;text-shadow:0 0 2px #000,0 0 2px #000">${glyph(p)}</button>`).join("")
  +"kqrbnp".split("").map(p=>`<button data-p="${p}" style="color:#111">${glyph(p)}</button>`).join("")
  +'<button data-p="x" style="font-size:14px">消す</button>';
$("pal").addEventListener("click",e=>{
  const b=e.target.closest("[data-p]");if(!b)return;
  pal=b.dataset.p;
  document.querySelectorAll("#pal button").forEach(x=>x.classList.toggle("on",x===b));
});
document.querySelector('#pal [data-p="K"]').classList.add("on");

async function analyze(which){
  const s=S(),err=validate(s);
  if(err){msg(err);return}
  msg("");
  const tk=++token;results=[];render();
  const jobs=which==="me"?["me"]:which==="opp"?["opp"]:["me","opp"];
  for(const w of jobs){
    renderRes(`${w==="me"?"自分":"相手"}の最善手を計算中…`);
    let st=s;
    if(w==="opp"){
      if(inCheck(s,s.t==="w")){results.push({w,note:"手番側がチェックされているため、相手の手番としては計算できません"});continue}
      st={...s,t:s.t==="w"?"b":"w",e:-1};
    }
    let r;try{r=await best(st)}catch(ex){if(ex===ABORT)return;throw ex}
    if(tk!==token)return;
    if(r){r.sure=await confirmInfo(st,r);if(tk!==token)return}
    if(r){const pc=prior(make(st,r.m));if(pc)r.text+=` ／ ※この手は同一局面${pc+1}回目になります`}
    let sty=null;
    if(r&&typeof styleApply==="function"){
      sty=styleApply(st,r,w);
      if(sty&&sty.m)sty={...sty,san:san(st,sty.m),set:sty.set.map(x=>({...x,san:san(st,x.m)}))};
      r.alts=(r.alts||[]).slice(0,Math.max(0,+$("npv").value-1));   // 表示する候補数は、設定の数だけ
    }
    results.push(r?{w,...r,san:san(st,r.m),alts:(r.alts||[]).map(a=>({...a,san:san(st,a.m)})),style:sty}:{w});
  }
  if(tk===token){renderRes();drawArrows()}
}
$("aMe").onclick=()=>analyze("me");
$("aOpp").onclick=()=>analyze("opp");
$("aBoth").onclick=()=>analyze("both");

document.querySelectorAll(".jd").forEach(x=>x.onchange=render);
render();

/* ---------- Maia 表示 ---------- */
function renderMaia(){
  const e=$("mres");if(!e)return;
  if(!mres){e.innerHTML='<span class="sub">レートを入れてボタンを押すと、その強さの人間が指しそうな手を確率つきで出します(青い矢印)。</span>';return}
  let h=mres.note?`<div class="sub">${mres.note}</div>`:"";
  h+=mres.items.map((x,i)=>`<div class="res"><b>${i+1}. ${x.san}</b> <span class="tag mh">${(x.p*100).toFixed(1)}%</span> <small>指した側の勝率目安 ${(x.win*100).toFixed(0)}%</small></div>`).join("");
  e.innerHTML=h;
}
async function maiaRun(who){
  const s=S(),err=validate(s);if(err){msg(err);return}
  let st=s,se=eloVal("eloMe"),oe=eloVal("eloOpp");
  if(who==="opp"){
    if(inCheck(s,s.t==="w")){mres={items:[],note:"手番側がチェックされているため、相手の手番としては計算できません"};renderMaia();return}
    st={...s,t:s.t==="w"?"b":"w",e:-1};[se,oe]=[oe,se];
  }
  if(!legal(st).length){mres={items:[],note:"指せる手がありません"};renderMaia();return}
  const tk=++token;
  mres={items:[],note:"計算中…(初回はモデルの読み込みに時間がかかります)"};renderMaia();drawArrows();
  try{
    const it=await maiaPredict(st,se,oe,+$("mN").value,p=>{if(tk===token){mres.note=p;renderMaia()}},priorFens(who==="opp"?"after":"me"));
    if(tk!==token)return;
    mres={items:it.map(x=>({...x,san:san(st,x.m)})),note:who==="opp"?"相手が指しそうな手":"自分が指しそうな手"};
  }catch(ex){
    mres={items:[],note:"Maiaを読み込めませんでした: "+(ex&&ex.message||ex)+"(engines/maia の配置と、ブラウザのコンソールを確認してください)"};
  }
  renderMaia();drawArrows();
}
$("mMe").onclick=()=>maiaRun("me");
$("mOpp").onclick=()=>maiaRun("opp");


$("sfGo").onclick=()=>{sfProbe().then(()=>sfLoad(true))};
$("maGo").onclick=()=>{maiaLoad().catch(()=>{})};
$("cacheClr").onclick=()=>{CACHE.clear();MCACHE.clear();cacheInfo()};
cacheInfo();

function showTab(t){
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("on",x.dataset.t===t));
  document.querySelectorAll(".tab").forEach(x=>{x.hidden=x.dataset.t!==t});
  curTab=t;
  const m=t==="ed"?"edit":"play";   // 配置タブを開いている間だけ配置モード。他のタブでは通常の対局操作
  if(m!==mode){mode=m;sel=null;msg("")}
  render();
}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>showTab(b.dataset.t));
function showPromo(pm){
  const w=S().t==="w",pp=$("pp");
  pp.innerHTML='<div class="box"><div class="sub">昇格する駒を選んでください</div><div class="row">'
    +"qrbn".split("").map(x=>`<button data-pr="${x}" class="pcb ${w?"w":"k"}">${glyph(w?x.toUpperCase():x)}</button>`).join("")
    +'</div><button data-pr="">やめる</button></div>';
  pp.hidden=false;
  pp.onclick=e=>{
    const b=e.target.closest("[data-pr]");if(!b)return;
    pp.hidden=true;
    const m=pm.find(x=>x.pr===b.dataset.pr);
    if(m)doMove(m);
  };
}

$("sfSel").onchange=sfReset;
$("maVar").onchange=maiaVariant;
function eloVal(id){const v=parseInt($(id).value,10);return isNaN(v)?1500:Math.max(0,Math.min(5000,v))}
function eloWarn(){
  const o=["eloMe","eloOpp"].some(i=>{const v=eloVal(i);return v<700||v>2500});
  $("eloWarn").textContent=o?"目安の範囲(700〜2500)の外です。予想の精度が落ちる可能性があります。":"";
}
for(const[n,r]of[["eloMe","eloMeR"],["eloOpp","eloOppR"]]){
  $(r).oninput=()=>{$(n).value=$(r).value;eloWarn()};
  $(n).oninput=()=>{const v=parseInt($(n).value,10);if(!isNaN(v))$(r).value=Math.max(0,Math.min(5000,v));eloWarn()};
  $(n).onchange=()=>{$(n).value=eloVal(n);$(r).value=$(n).value;eloWarn()};
}
sfProbe();
