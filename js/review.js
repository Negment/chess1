"use strict";
/* ---------- 形勢評価(自作の簡易計算・白視点) ---------- */
const PVAL={p:1,n:3.2,b:3.3,r:5,q:9,k:0};
function evalParts(s){
  const b=s.b,o={mat:0,act:0,king:0,pawn:0,space:0,coord:0,threat:0,kact:0,eg:0,hang:{w:[],b:[]}},nb={w:{},b:{}};
  const pw={w:[],b:[]},kg={};let npm=0;
  for(const c of["w","b"])for(let f=0;f<8;f++)pw[c][f]=[];
  for(let i=0;i<64;i++){
    const p=b[i];if(!p)continue;
    const w=isW(p),c=w?"w":"b",l=p.toLowerCase(),r=i>>3,f=i&7,sg=w?1:-1,rk=w?7-r:r;
    o.mat+=sg*PVAL[l];nb[c][l]=(nb[c][l]||0)+1;
    if(l!=="p"&&l!=="k")npm+=PVAL[l];
    if(l==="p"){pw[c][f].push(r);if((f===3||f===4)&&rk>=3&&rk<=4)o.act+=sg*0.15}
    if(l==="k")kg[c]=i;
    if(l==="n"||l==="b"){if(rk>0)o.act+=sg*0.1;if(f>=2&&f<=5&&r>=2&&r<=5)o.act+=sg*0.1}
    if(l!=="k"){
      const dfd=attacked(b,i,w),atk=attacked(b,i,!w);
      o.coord+=sg*(l==="p"?(dfd?0.04:0):(dfd?0.06:-0.1));
      if(atk&&!dfd)o.hang[c].push(p.toUpperCase()+String.fromCharCode(97+f)+(8-r));
    }
  }
  for(let i=0;i<64;i++){
    const p=b[i];if(!p||p.toLowerCase()!=="r")continue;
    const w=isW(p),c=w?"w":"b",e=w?"b":"w",f=i&7,sg=w?1:-1;
    if(!pw[c][f].length)o.act+=sg*(pw[e][f].length?0.1:0.2);
  }
  if((nb.w.b||0)>=2)o.mat+=0.3;if((nb.b.b||0)>=2)o.mat-=0.3;
  const mob=c=>pseudo({...s,t:c,e:-1}).length;
  o.act+=Math.max(-2,Math.min(2,(mob("w")-mob("b"))*0.05));
  const ks=c=>{
    const w=c==="w",ki=kg[c],kr=ki>>3,kf=ki&7,dir=w?-1:1,e=w?"b":"w";let v=0;
    for(let df=-1;df<=1;df++){
      const f=kf+df;if(f<0||f>7)continue;
      if(pw[c][f].some(r=>r===kr+dir||r===kr+2*dir))v+=0.2;
      if(!pw[c][f].length)v-=pw[e][f].length?0.15:0.35;
    }
    if(kf>=3&&kf<=4){if(kr!==(w?7:0))v-=0.3;else if(!(w?/[KQ]/:/[kq]/).test(s.c))v-=0.2}
    let z=0;
    for(let dr=-1;dr<=1;dr++)for(let df=-1;df<=1;df++){
      const rr=kr+dr,ff=kf+df;if(rr<0||rr>7||ff<0||ff>7)continue;
      if(attacked(b,rr*8+ff,!w))z++;
    }
    return v-z*0.12;
  };
  o.king=ks("w")-ks("b");
  const ps=c=>{
    const e=c==="w"?"b":"w";let v=0;
    for(let f=0;f<8;f++){
      const L=pw[c][f];if(L.length>1)v-=0.25*(L.length-1);
      const iso=(f===0||!pw[c][f-1].length)&&(f===7||!pw[c][f+1].length);
      if(L.length&&iso)v-=0.25*L.length;
      for(const r of L){
        let pass=true;
        for(let g=f-1;g<=f+1;g++){if(g<0||g>7)continue;for(const er of pw[e][g])if(c==="w"?er<r:er>r)pass=false}
        if(pass){const adv=Math.max(0,Math.min(5,c==="w"?6-r:r-1));v+=[0.1,0.15,0.3,0.5,0.9,1.5][adv]}
      }
    }
    return v;
  };
  o.pawn=ps("w")-ps("b");
  for(let i=0;i<64;i++){
    const r=i>>3,f=i&7,aw=attacked(b,i,true),ab=attacked(b,i,false);
    if(aw&&r<=3)o.space+=0.03;if(ab&&r>=4)o.space-=0.03;
    if(r>=3&&r<=4&&f>=2&&f<=5){if(aw)o.space+=0.04;if(ab)o.space-=0.04}
  }
  const thr=c=>{
    const w=c==="w",st={...s,t:c,e:-1};let caps=0,chk=0;
    for(const m of pseudo(st)){
      const tp=b[m.t];
      if(tp&&(PVAL[tp.toLowerCase()]>=PVAL[b[m.f].toLowerCase()]||!attacked(b,m.t,!w)))caps++;
      const n=make(st,m);
      if(attacked(n.b,n.b.indexOf(w?"k":"K"),w))chk++;
    }
    return[caps,chk];
  };
  const[cw,kw]=thr("w"),[cb,kb]=thr("b");
  o.threat=(cw-cb)*0.12+(kw-kb)*0.06;
  o.eg=Math.max(0,Math.min(1,(30-npm)/20));
  const cen=i=>3.5-Math.max(Math.abs((i>>3)-3.5),Math.abs((i&7)-3.5));
  o.kact=o.eg*(cen(kg.w)-cen(kg.b))*0.12;
  o.total=o.mat+o.act+o.king+o.pawn+o.space+o.coord+o.threat+o.kact;
  return o;
}
/* ---------- 先読み(将来の予測) ---------- */
const FW={key:null,sf:null,sfD:0,se:null,seD:0,maia:null,busy:false,err:""};
async function fwRun(){
  const s=S(),err=validate(s);if(err)return;
  const key=rkey(s),ms=legal(s),t=+($("gaT")?$("gaT").value:1000)||1000;
  Object.assign(FW,{key,sf:null,se:null,maia:null,busy:true,err:""});renderEval();
  if(!ms.length){FW.busy=false;renderEval();return}
  SEARCH_HIST=histKeys();
  const r=search(s,ms,250,6);FW.se=(s.t==="w"?1:-1)*Math.max(-3000,Math.min(3000,r.score));FW.seD=r.depth;renderEval();
  try{
    if($("useSF").checked){
      const w=await sfLoad();
      if(w){const L=await sfBest(w,s,ms,ms,t,1,"fw");if(FW.key===key&&L.length){FW.sf=(s.t==="w"?1:-1)*cpOf(L[0].sc);FW.sfD=L[0].dep}}
    }
  }catch(e){FW.err="Stockfishを読み込めませんでした"}
  renderEval();
  try{
    const L=await maiaPredict(s,eloVal("eloMe"),eloVal("eloOpp"),5,null,priorFens("me"));
    if(FW.key===key)FW.maia=s.t==="w"?L.wp:1-L.wp;
  }catch(e){FW.err=(FW.err?FW.err+" / ":"")+"Maiaを読み込めませんでした"}
  FW.busy=false;renderEval();
}
function renderEval(){
  const e=$("evalBox");if(!e)return;
  const s=S(),v=evalParts(s),f=x=>(x>=0?"+":"")+x.toFixed(2);
  const bar=x=>x==null?'<span class="evbar"></span>':`<span class="evbar"><i class="${x<0?"neg":""}" style="${x<0?"right":"left"}:50%;width:${Math.min(50,Math.abs(x)*10)}%"></i></span>`;
  const row=(n,x,txt,bd)=>`<div class="ev"><span>${bd?"<b>"+n+"</b>":n}</span>${bar(x)}<b>${txt!=null?txt:x==null?"—":f(x)}</b></div>`;
  const wp=Math.round(100/(1+Math.pow(10,-v.total/4)));
  const fw=FW.key===rkey(s)?FW:null;
  const cp=x=>x==null?null:Math.abs(x)>=3000?(x>0?"詰み勝ち":"詰み負け"):f(x/100);
  e.innerHTML='<div class="sub"><b>現在の状態(盤面だけを見た簡易計算)</b></div>'
    +row("駒の価値",v.mat)+row("駒の働き",v.act)+row("キングの安全",v.king)+row("ポーン構造",v.pawn)
    +row("空間",v.space)+row("連携(守り)",v.coord)+row("攻撃の機会",v.threat)+row("終盤のキング",v.kact,v.eg>0?null:"—")
    +row("総合",v.total,null,true)
    +`<div class="wbar"><i style="width:${wp}%"></i><u></u></div><div class="sub">白の勝ちやすさの目安 ${wp}%(黒 ${100-wp}%)</div>`
    +`<div class="sub">取られそうな駒(守りなし): 白 ${v.hang.w.join(" ")||"なし"} / 黒 ${v.hang.b.join(" ")||"なし"}</div>`
    +'<div class="sub" style="margin-top:8px"><b>先読み(数手先・人間の見込み)</b></div>'
    +row("Stockfish"+(fw&&fw.sfD?`(深さ${fw.sfD})`:""),fw&&fw.sf!=null?fw.sf/100:null,fw?cp(fw.sf):null)
    +row("自作エンジン"+(fw&&fw.seD?`(深さ${fw.seD})`:""),fw&&fw.se!=null?fw.se/100:null,fw?cp(fw.se):null)
    +row("Maiaの勝率(白視点)",fw&&fw.maia!=null?(fw.maia-0.5)*10:null,fw&&fw.maia!=null?Math.round(fw.maia*100)+"%":null)
    +`<div class="row"><button id="fwGo">先読みを更新</button><span class="sub">${fw&&fw.busy?"計算中…":""}${fw&&fw.err?fw.err:""}</span></div>`
    +'<div class="sub">上の「現在の状態」は、自作の簡易計算です。駒の取り合いなどの戦術は読みません。「先読み」は、実際に探索や予測を行った結果で、プラスは白有利です。</div>';
}

/* ---------- 棋譜の再生 ---------- */
let rpT=null;
function rpStop(){if(rpT){clearTimeout(rpT);rpT=null}$("rpPlay").textContent="▶ 再生"}
function rpStep(){
  if(pos>=hist.length-1){rpStop();return}
  pos++;reset();
  rpT=setTimeout(rpStep,+$("rpSpeed").value);
}
$("rpPlay").onclick=()=>{
  if(rpT){rpStop();return}
  if(pos>=hist.length-1){pos=0;reset()}
  $("rpPlay").textContent="⏸ 停止";
  rpT=setTimeout(rpStep,+$("rpSpeed").value);
};
$("rpFirst").onclick=()=>{rpStop();pos=0;reset()};
$("rpLast").onclick=()=>{rpStop();pos=hist.length-1;reset()};
$("evalBox").addEventListener("click",e=>{if(e.target.id==="fwGo")fwRun()});

/* ---------- 棋譜の解析・分類・重要局面 ---------- */
const GA=new Map(),GM=new Map();let gaTok=0;
const RV_CLS=[[10,"最善手","best"],[40,"好手","good"],[120,"疑問手","dub"],[300,"悪手","bad"],[Infinity,"大悪手","blun"]];
const CLS_KEY={"最善手":"best","好手":"good","疑問手":"dub","悪手":"bad","大悪手":"blun","強制手":"forced"};
function gaBase(){for(let i=hist.length-1;i>0;i--)if(!hist[i].mv)return i;return 0}
const gaKey=(s,t)=>toFen(s)+"|"+t+"|"+($("useSF").checked?$("sfSel").value:"se");
const rvMove=i=>{const a=hist[i-1].s,f=toFen(hist[i].s);return legal(a).find(m=>toFen(make(a,m))===f)||null};
const rvU=m=>String(uci(m)).slice(0,4)+(m.pr||"");
const rvElo=c=>eloVal(c==="w"?"rvEloW":"rvEloB");
const gmKey=(i,mv)=>toFen(hist[i-1].s)+"|"+rvU(mv)+"|"+rvElo("w")+"|"+rvElo("b")+"|"+MAIA_CFG.variant+"|"+($("maHist").checked?1:0);
function rvCfg(){
  const n=(id,d)=>{const v=parseFloat($(id).value);return isNaN(v)?d:v};
  return{big:n("rvBig",1.5)*100,top:n("rvMaiaTop",30)/100,pl:n("rvMaiaPl",10)/100,
    c:[1,2,3,4].map(k=>$("rvC"+k).checked)};
}
async function gaRun(){
  const tk=++gaTok,t=+$("gaT").value,b=gaBase(),n=hist.length-b;
  for(let k=0;k<n;k++){
    if(tk!==gaTok)return;
    const s=hist[b+k].s,key=gaKey(s,t);
    $("gaSt").textContent=`エンジンで解析中… ${k+1}/${n}`;
    if(!GA.has(key)){
      const r=await evalPos(s,t);
      GA.set(key,{cp:r.cp,u:r.m?rvU(r.m):"",m:r.m?san(s,r.m):"",cp2:r.cp2,n:r.n});
      renderReview();
    }
  }
  if($("rvMaia").checked){
    for(let i=b+1;i<hist.length;i++){
      if(tk!==gaTok)return;
      const a=hist[i-1].s,mv=rvMove(i);if(!mv)continue;
      const mk=gmKey(i,mv);if(GM.has(mk))continue;
      $("gaSt").textContent=`Maiaと比較中… ${i-b}/${hist.length-b-1}`;
      try{
        const me=a.t==="w"?rvElo("w"):rvElo("b"),op=a.t==="w"?rvElo("b"):rvElo("w");
        const L=await maiaPredict(a,me,op,5,null,priorFensAt(i-1,false));
        GM.set(mk,{top:L[0]?rvU(L[0].m):"",topSan:L[0]?san(a,L[0].m):"",pTop:L[0]?L[0].p:0,pPlayed:(L.all&&L.all.get(rvU(mv)))||0});
        renderReview();
      }catch(e){$("gaSt").textContent="Maiaを読み込めませんでした: "+(e&&e.message||e);return}
    }
  }
  if(tk===gaTok)$("gaSt").textContent="解析が終わりました";
  renderReview();
}
function gaData(){
  const t=+$("gaT").value,b=gaBase(),a=[];
  for(let i=b;i<hist.length;i++){const s=hist[i].s,r=GA.get(gaKey(s,t));a.push({i,s,r,w:r?(s.t==="w"?1:-1)*r.cp:null})}
  return a;
}
function rvRows(){
  const t=+$("gaT").value,b=gaBase(),rows=[],cfg=rvCfg();
  for(let i=b+1;i<hist.length;i++){
    const a=hist[i-1].s,mv=rvMove(i);if(!mv)continue;
    const A=GA.get(gaKey(a,t)),B=GA.get(gaKey(hist[i].s,t));
    const row={i,label:hist[i].label,mover:a.t,u:rvU(mv),reasons:[],tags:[]};
    if(A&&B){
      const before=A.cp,after=-B.cp,loss=Math.max(0,before-after),gap=A.cp2==null?null:A.cp-A.cp2;
      const wB=a.t==="w"?before:-before,wA=a.t==="w"?after:-after;
      Object.assign(row,{before,after,loss,best:A.m,swing:Math.abs(wA-wB)});
      row.isBest=(A.u&&A.u===row.u)||loss<=10;
      row.forced=A.n===1;
      const only=row.isBest&&gap!=null&&gap>=150;
      row.cls=row.forced?"強制手":only?"好手":row.isBest?"最善手":RV_CLS.find(x=>loss<=x[0])[1];
      if(only)row.tags.push("唯一手");
      if(before>=3000&&after<3000)row.tags.push("詰み見逃し");
      if(after<=-3000&&before>-3000)row.tags.push("詰みを許した");
      if((before>=100&&after<=-100)||(before<=-100&&after>=100))row.tags.push("勝敗が入れ替わった");
      if(cfg.c[0]&&row.swing>=cfg.big)row.reasons.push("評価が大きく変わった");
      if(cfg.c[1]&&row.tags.some(x=>/詰み|勝敗/.test(x)))row.reasons.push("勝敗を左右した可能性");
      if(cfg.c[2]&&!row.isBest&&!row.forced&&loss>=70)row.reasons.push("最善手と大きく違う");
    }
    const M=GM.get(gmKey(i,mv));
    if(M){row.M=M;if(cfg.c[3]&&M.top!==row.u&&M.pTop>=cfg.top&&M.pPlayed<=cfg.pl)row.reasons.push("Maiaの予測と違う")}
    rows.push(row);
  }
  for(let k=1;k<rows.length;k++){
    const p=rows[k-1],c=rows[k];
    if(p.cls&&c.cls&&(p.cls==="悪手"||p.cls==="大悪手")&&(c.cls==="最善手"||c.cls==="好手"))c.tags.push("相手のミスを咎めた");
  }
  return rows;
}
const rvCt=x=>x>=3000?"詰み勝ち":x<=-3000?"詰み負け":(x>=0?"+":"")+(x/100).toFixed(2);
const rvPct=x=>(x*100).toFixed(x<0.1?1:0)+"%";
function rvImportant(rows){return rows.filter(r=>r.reasons.length)}
function rvRender(){
  const sum=$("gaSum"),ls=$("gaList");if(!sum||!$("rvAll"))return;
  const rows=rvRows(),done=rows.filter(r=>r.cls);
  if(!done.length){sum.innerHTML="";ls.innerHTML='<div class="sub">解析を行うと、ここに重要な局面が出ます。</div>';return}
  const side=c=>{
    const a=done.filter(r=>r.mover===c),n=a.length||1,avg=a.reduce((t,x)=>t+Math.min(x.loss||0,500),0)/n;
    return`${c==="w"?"白":"黒"}: 平均損失 ${(avg/100).toFixed(2)} / `+["最善手","好手","疑問手","悪手","大悪手","強制手"].map(k=>`${k} ${a.filter(x=>x.cls===k).length}`).join(" ・ ");
  };
  const sp=["詰み見逃し","詰みを許した","勝敗が入れ替わった","相手のミスを咎めた","唯一手"].map(k=>`${k} ${done.filter(x=>x.tags.includes(k)).length}`).join(" ・ ");
  sum.innerHTML=`<div class="sub">${side("w")}</div><div class="sub">${side("b")}</div><div class="sub">特別な手: ${sp}</div>`;
  const list=$("rvAll").checked?done:rvImportant(rows);
  ls.innerHTML=list.map(r=>{
    const M=r.M?` / Maia予測 ${r.M.topSan}(${rvPct(r.M.pTop)})・実際の手 ${rvPct(r.M.pPlayed)}`:"";
    return`<div class="res gi" data-j="${r.i-1}"><b>${r.label}</b> <span class="tag cl-${CLS_KEY[r.cls]||"best"}">${r.cls||""}</span>`
      +r.tags.map(x=>` <span class="chip">${x}</span>`).join("")+r.reasons.map(x=>` <span class="chip rs">${x}</span>`).join("")
      +(r.before==null?"":`<br><small>評価 ${rvCt(r.before)} → ${rvCt(r.after)}(動かした側から見て) / 損失 ${(r.loss/100).toFixed(2)}${r.best&&!r.isBest?" / 最善: "+r.best:""}${M}</small>`)+"</div>";
  }).join("")||'<div class="sub">条件に合う重要な局面はありません。</div>';
}
function rvJump(dir){
  const js=rvImportant(rvRows()).map(r=>r.i-1).sort((a,b)=>a-b);
  const j=dir>0?js.find(x=>x>pos):[...js].reverse().find(x=>x<pos);
  if(j!=null){pos=j;reset()}
}
function gaDraw(){
  const g=$("gaGraph");if(!g)return;
  const d=gaData(),n=d.length;
  if(n<2){g.innerHTML="";return}
  const X=k=>k*300/(n-1),Y=w=>50-Math.max(-500,Math.min(500,w))/10;
  let path="",open=false;
  d.forEach((x,k)=>{if(x.w==null){open=false;return}path+=(open?"L":"M")+X(k).toFixed(1)+" "+Y(x.w).toFixed(1)+" ";open=true});
  const cur=Math.max(0,Math.min(n-1,pos-gaBase()));
  g.innerHTML=`<svg viewBox="0 0 300 100" preserveAspectRatio="none" style="width:100%;height:110px;background:var(--bg);border:1px solid var(--line);border-radius:6px"><line x1="0" y1="50" x2="300" y2="50" stroke="var(--dk)" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/><line x1="${X(cur)}" y1="0" x2="${X(cur)}" y2="100" stroke="#d6452f" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg><div class="sub">上が白有利、下が黒有利(±5ポーンで頭打ち)。クリックでその局面へ移動します。</div>`;
}
function reviewMount(){
  $("reviewMount").innerHTML=`<div class="card"><h2>棋譜の解析</h2>
  <div class="row"><label class="sub">1局面あたり <select id="gaT"><option value="300">0.3秒</option><option value="1000" selected>1秒</option><option value="3000">3秒</option></select></label>
    <label class="sub"><input type="checkbox" id="rvMaia">Maiaとの比較も行う</label></div>
  <div class="row"><label class="sub">白のレート <input type="number" id="rvEloW" min="0" max="5000" value="1500" style="width:5em"></label>
    <label class="sub">黒のレート <input type="number" id="rvEloB" min="0" max="5000" value="1500" style="width:5em"></label></div>
  <div class="row"><button id="gaGo" class="go">解析を開始</button><button id="gaStop">中止</button></div>
  <div class="sub" id="gaSt"></div>
  <div id="gaGraph"></div><div id="gaSum"></div>
  <div class="sub">各手を、最善手・好手・疑問手・悪手・大悪手に分類します(損失が10・40・120・300センチポーン以内の区切りで、最善手に近い順です)。唯一手、詰み見逃し、勝敗が入れ替わった手、相手のミスを咎めた手は、別の印で出します。解析中は、最善手などのボタンを押さないでください(同じエンジンを使うためです)。</div>
</div>
<div class="card"><h2>重要な局面だけを見る</h2>
  <div class="row"><label class="sub"><input type="checkbox" id="rvC1" checked>評価が大きく変わった手</label><label class="sub"><input type="checkbox" id="rvC2" checked>勝敗を左右した可能性</label>
    <label class="sub"><input type="checkbox" id="rvC3" checked>最善手と大きく違う手</label><label class="sub"><input type="checkbox" id="rvC4" checked>Maiaの予測と違う手</label></div>
  <div class="row"><label class="sub">大きい変化(ポーン) <input type="number" id="rvBig" value="1.5" step="0.1" min="0.1" style="width:4.5em"></label>
    <label class="sub">Maiaの予測の確率 <input type="number" id="rvMaiaTop" value="30" min="1" max="100" style="width:4em">%以上、実際の手は <input type="number" id="rvMaiaPl" value="10" min="0" max="100" style="width:4em">%以下</label></div>
  <div class="row"><button id="rvPrev">◀ 前の重要局面</button><button id="rvNext">次の重要局面 ▶</button><label class="sub"><input type="checkbox" id="rvAll">全手の分類も表示</label></div>
  <div id="gaList"></div>
  <div class="sub">一覧をクリックすると、その手を指す直前の局面に移動します。</div>
</div>`;
  $("gaGo").onclick=()=>{gaRun()};
  $("gaStop").onclick=()=>{gaTok++;$("gaSt").textContent="中止しました"};
  $("rvPrev").onclick=()=>rvJump(-1);$("rvNext").onclick=()=>rvJump(1);
  for(const id of["rvC1","rvC2","rvC3","rvC4","rvBig","rvMaiaTop","rvMaiaPl","rvAll","gaT","rvEloW","rvEloB"])$(id).onchange=renderReview;
  $("gaList").addEventListener("click",e=>{const d=e.target.closest(".gi");if(d){pos=+d.dataset.j;reset()}});
  $("gaGraph").onclick=e=>{
    const sv=$("gaGraph").querySelector("svg");if(!sv)return;
    const r=sv.getBoundingClientRect(),n=hist.length-gaBase(),k=Math.round((e.clientX-r.left)/r.width*(n-1));
    pos=gaBase()+Math.max(0,Math.min(n-1,k));reset();
  };
}

/* ---------- 独自機能: 対人で有利な手(Stockfish × Maia) ---------- */
async function humanRun(){
  const s=S(),err=validate(s),out=$("hres");
  if(err){out.textContent=err;return}
  if(!legal(s).length){out.textContent="指せる手がありません";return}
  out.textContent="候補手を計算中…";
  let r;try{r=await best(s)}catch(e){if(e!==ABORT)out.textContent="最善手の計算に失敗しました";return}
  if(!r){out.textContent="候補がありません";return}
  const cands=[{m:r.m,cp:r.cp},...(r.alts||[]).map(a=>({m:a.m,cp:a.cp}))].slice(0,Math.max(1,+$("npv").value));
  const me=eloVal("eloMe"),op=eloVal("eloOpp"),rows=[];
  for(let k=0;k<cands.length;k++){
    out.textContent=`相手の応手を予想中… ${k+1}/${cands.length}(初回はMaiaの読み込みで時間がかかります)`;
    const c=cands[k],ns=make(s,c.m),sn=san(s,c.m);
    if(!legal(ns).length){rows.push({sn,cp:c.cp,ew:sn.endsWith("#")?1:0.5,end:true});continue}
    let L;try{L=await maiaPredict(ns,op,me,5,null,priorFens("after"))}catch(e){out.textContent="Maiaを読み込めませんでした: "+(e&&e.message||e);return}
    const P=L.reduce((a,x)=>a+x.p,0)||1,ow=L.reduce((a,x)=>a+x.p*x.win,0)/P;
    const br=L.reduce((a,x)=>x.win>a.win?x:a,L[0]),tp=L.reduce((a,x)=>x.p>a.p?x:a,L[0]);
    rows.push({sn,cp:c.cp,ew:1-ow,top:san(ns,tp.m),pTop:tp.p/P,bst:san(ns,br.m),pBest:br.p/P});
  }
  rows.sort((a,b)=>b.ew-a.ew);
  const ct=x=>x==null?"—":(x>=0?"+":"")+(x/100).toFixed(2);
  out.innerHTML=rows.map((x,i)=>`<div class="res"><b>${i===0?"★ ":""}${x.sn}</b> <span class="tag mh">期待勝率 ${Math.round(x.ew*100)}%</span><br><small>エンジン評価 ${ct(x.cp)}(手番側から見て)${x.end?" / 対局が終わる手です":` / 相手の予想応手 ${x.top}(${Math.round(x.pTop*100)}%) / Maiaが相手に最も有利と見る応手 ${x.bst} を選ぶ確率 ${Math.round(x.pBest*100)}%`}</small></div>`).join("")
    +`<div class="sub">★は、あなた(${me})が相手(${op})に対して期待勝率が最も高い手です。エンジン評価が大きく下がる手を選ぶときは、見比べてください。</div>`;
}
$("huGo").onclick=()=>{humanRun()};

function renderReview(){renderEval();gaDraw();rvRender()}
reviewMount();renderReview();
