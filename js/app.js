"use strict";
/* ---------- 状態・履歴 ---------- */
let hist=[{s:parseFen(START),label:"初期配置"}],pos=0;
let mode="play",flipped=false,sel=null,pal="K",results=[],token=0,mres=null,kifuDirty=false;
const S=()=>hist[pos].s;
function validate(s){
  const wk=s.b.filter(p=>p==="K").length,bk=s.b.filter(p=>p==="k").length;
  if(wk!==1||bk!==1)return "白黒それぞれキングを1枚ずつ置いてください";
  for(let i=0;i<8;i++)if(/[Pp]/.test(s.b[i]+s.b[56+i]))return "ポーンを1段目・8段目に置くことはできません";
  if(inCheck(s,s.t!=="w"))return "手番でない側のキングがチェックされています(手番を入れ替えてください)";
  return "";
}
function msg(t){$("msg").textContent=t||""}
const rkey=s=>toFen(s).split(" ").slice(0,4).join(" ");
function cnt(s){const k=rkey(s);let c=0;for(let i=Math.max(0,pos-S().h);i<=pos;i++)if(rkey(hist[i].s)===k)c++;return c}
function prior(ns){return ns.h===0?0:cnt(ns)}
function kifuText(){
  let st=0;for(let i=pos;i>0;i--)if(!hist[i].mv){st=i;break}
  const base=toFen(hist[st].s);let o=base!==toFen(parseFen(START))?`[SetUp "1"]\n[FEN "${base}"]\n\n`:"",first=true;
  for(let i=st+1;i<=pos;i++){
    const s=hist[i-1].s,sn=hist[i].label.replace(/^\d+[.…]/,"");
    o+=(s.t==="w"?`${s.n}. `:first?`${s.n}... `:"")+sn+" ";first=false;
  }
  return o.trim();
}
function commit(ns,label,mv){
  hist.length=pos+1;hist.push({s:ns,label,mv});pos++;reset();
}
function reset(){kifuDirty=false;sel=null;results=[];mres=null;token++;render()}
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
  const s=S(),err=validate(s);
  const ms=mode==="play"&&!err?legal(s):[];
  const tg=new Set(sel!==null?ms.filter(m=>m.f===sel).map(m=>m.t):[]);
  const lm=hist[pos].mv,ck=!err&&inCheck(s,s.t==="w")?s.b.indexOf(s.t==="w"?"K":"k"):-1;
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
  if(!err&&!legal(s).length)ov=inCheck(s,s.t==="w")?`<div class="ov mate">チェックメイト<br><small>${s.t==="w"?"黒":"白"}の勝ち</small></div>`:$("jStale").checked?'<div class="ov stale">ステイルメイト<br><small>引き分け</small></div>':"";
  if(!ov&&!err&&$("jInsuf").checked&&insuf(s))ov='<div class="ov stale">引き分け<br><small>駒が足りません(チェックメイト不可)</small></div>';
  $("bd").innerHTML=h+'<svg id="ar" viewBox="0 0 8 8"></svg>'+ov;
  $("rk").innerHTML=[8,7,6,5,4,3,2,1].map(x=>`<div>${flipped?9-x:x}</div>`).join("");
  $("fl").innerHTML=[...F].map((x,i)=>`<div>${flipped?F[7-i]:x}</div>`).join("");
  drawArrows();
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
  $("st").textContent=st;
  $("st").className=err?"":!legal(s).length?(inCheck(s,s.t==="w")?"mate":$("jStale").checked?"stale":""):inCheck(s,s.t==="w")?"ck":$("jInsuf").checked&&insuf(s)?"stale":"";
  $("fen").value=toFen(s);
  if(!kifuDirty)$("kifu").value=kifuText();
  $("undo").disabled=pos===0;$("redo").disabled=pos>=hist.length-1;
  $("mPlay").classList.toggle("on",mode==="play");$("mEdit").classList.toggle("on",mode==="edit");
  $("editBox").hidden=mode!=="edit";
  document.querySelectorAll(".cr").forEach(x=>x.checked=s.c.includes(x.value));
  $("hl").innerHTML=hist.map((x,i)=>`<button data-i="${i}" class="${i===pos?"on":""}">${x.mv?x.label:"✎ "+x.label}</button>`).join("");
  renderRes();renderMaia();
}
function drawArrows(){
  const svg=$("ar");if(!svg)return;
  const P=q=>[(flipped?7-(q&7):q&7)+.5,(flipped?7-(q>>3):q>>3)+.5];
  let o='<defs>';
  for(const[k,c]of[["me","#1f9d55"],["opp","#d6452f"],["mh","#2f6fd6"]])o+=`<marker id="m${k}" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto"><path d="M0,0L3,1.5L0,3z" fill="${c}"/></marker>`;
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
      +(r.alts||[]).map((a,i)=>`<br><small>${i+2}番手: <b>${a.san}</b> ／ ${a.text}</small>`).join("")
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
    const b=s.b.slice();b[sq]=pal==="x"?"":(b[sq]===pal?"":pal);
    commit(norm({...s,b,e:-1}),"配置");return;
  }
  const err=validate(s);if(err){msg(err);return}
  msg("");
  if(sel!==null){
    const c=legal(s).filter(m=>m.f===sel&&m.t===sq);
    if(c.length){doMove(c.find(m=>!m.pr||m.pr===$("promo").value)||c[0]);return}
  }
  const p=s.b[sq];
  sel=p&&isW(p)===(s.t==="w")?sq:null;
  render();
});
$("hl").addEventListener("click",e=>{const b=e.target.closest("[data-i]");if(b){pos=+b.dataset.i;reset()}});
$("res").addEventListener("click",e=>{const b=e.target.closest("[data-play]");if(b){const r=results[+b.dataset.play];if(r&&r.m)doMove(r.m)}});
$("undo").onclick=()=>{if(pos>0){pos--;reset()}};
$("redo").onclick=()=>{if(pos<hist.length-1){pos++;reset()}};
document.addEventListener("keydown",e=>{
  if(e.target!==document.body||!(e.ctrlKey||e.metaKey))return;
  if(e.key==="z"){e.preventDefault();$("undo").click()}
  if(e.key==="y"){e.preventDefault();$("redo").click()}
});
$("flip").onclick=()=>{flipped=!flipped;render()};
$("turn").onclick=()=>{const s=S();commit({...s,t:s.t==="w"?"b":"w",e:-1},"手番交代")};
$("mPlay").onclick=()=>{mode="play";sel=null;render()};
$("mEdit").onclick=()=>{mode="edit";sel=null;render()};
$("clr").onclick=()=>commit({b:Array(64).fill(""),t:"w",c:"",e:-1,h:0,n:1},"全消去");
$("ini").onclick=()=>commit(parseFen(START),"初期配置");
document.querySelectorAll(".cr").forEach(x=>x.onchange=()=>{
  const s=S(),c=[...document.querySelectorAll(".cr")].filter(i=>i.checked).map(i=>i.value).join("");
  commit(norm({...s,c}),"キャスリング権");
});
$("fenLoad").onclick=()=>{
  try{commit(parseFen($("fen").value),"FEN読込");msg("")}catch(e){msg(e.message)}
};
$("kCopy").onclick=async()=>{try{await navigator.clipboard.writeText($("kifu").value);msg("棋譜をコピーしました")}catch(e){$("kifu").select();document.execCommand("copy")}};
$("kLoad").onclick=()=>{
  const tx=$("kifu").value,fm=tx.match(/\[FEN\s+"([^"]+)"\]/);
  let base;try{base=fm?parseFen(fm[1]):parseFen(START)}catch(e){msg("FENを読み込めません");return}
  const toks=tx.replace(/\[[^\]]*\]/g,"").replace(/\{[^}]*\}/g,"").replace(/\([^)]*\)/g,"").replace(/\$\d+/g,"").replace(/\d+\s*\.+/g,"").split(/\s+/).filter(t=>t&&!/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  if(!confirm("現在の履歴を、この棋譜で置き換えます。よろしいですか?"))return;
  hist=[{s:base,label:fm?"読込局面":"初期配置"}];pos=0;reset();
  for(const t of toks){
    const m=parseTok(S(),t);
    if(!m){msg(`「${t}」で止まりました(ここまでは読み込み済み)`);render();return}
    doMove(m);
  }
  msg("");render();
};
$("fenCopy").onclick=async()=>{
  try{await navigator.clipboard.writeText($("fen").value);msg("")}
  catch(e){$("fen").select();document.execCommand("copy")}
};
function inputMoves(){
  const toks=$("mv").value.replace(/\d+\s*\.+/g,"").replace(/\{[^}]*\}/g,"").split(/\s+/).filter(t=>t&&!/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  if(!toks.length)return;
  let err=validate(S());if(err){msg(err);return}
  for(const t of toks){
    const m=parseTok(S(),t);
    if(!m){msg(`「${t}」は今の局面で指せない、または曖昧な手です`);return}
    doMove(m);
  }
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
    const r=await best(st);
    if(tk!==token)return;
    if(r){const pc=prior(make(st,r.m));if(pc)r.text+=` ／ ※この手は同一局面${pc+1}回目になります`}
    results.push(r?{w,...r,san:san(st,r.m),alts:(r.alts||[]).map(a=>({...a,san:san(st,a.m)}))}:{w});
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
  let st=s,se=+$("eloMe").value||1500,oe=+$("eloOpp").value||1500;
  if(who==="opp"){
    if(inCheck(s,s.t==="w")){mres={items:[],note:"手番側がチェックされているため、相手の手番としては計算できません"};renderMaia();return}
    st={...s,t:s.t==="w"?"b":"w",e:-1};[se,oe]=[oe,se];
  }
  if(!legal(st).length){mres={items:[],note:"指せる手がありません"};renderMaia();return}
  const tk=++token;
  mres={items:[],note:"計算中…(初回はモデルの読み込みに時間がかかります)"};renderMaia();drawArrows();
  try{
    const it=await maiaPredict(st,se,oe,+$("mN").value,p=>{if(tk===token){mres.note=p;renderMaia()}});
    if(tk!==token)return;
    mres={items:it.map(x=>({...x,san:san(st,x.m)})),note:who==="opp"?"相手が指しそうな手":"自分が指しそうな手"};
  }catch(ex){
    mres={items:[],note:"Maiaを読み込めませんでした: "+(ex&&ex.message||ex)+"(engines/maia の配置と、ブラウザのコンソールを確認してください)"};
  }
  renderMaia();drawArrows();
}
$("mMe").onclick=()=>maiaRun("me");
$("mOpp").onclick=()=>maiaRun("opp");


$("kifu").addEventListener("input",()=>{kifuDirty=true});
$("sfGo").onclick=()=>{sfLoad(true)};
$("maGo").onclick=()=>{maiaLoad().catch(()=>{})};
$("cacheClr").onclick=()=>{CACHE.clear();MCACHE.clear();cacheInfo()};
cacheInfo();
