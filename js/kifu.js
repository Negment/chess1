"use strict";
/* ---------- 棋譜の入出力(PGN / SAN / LAN / FAN / UCI / ICCF数字 / FEN) ---------- */
const kfStd=()=>toFen(parseFen(START));
function kfBase(end){for(let i=end;i>0;i--)if(!hist[i].mv)return i;return 0}
function kfBetween(a,b){const f=toFen(b);return legal(a).find(m=>toFen(make(a,m))===f)||null}
function kfMoves(all){
  const end=all?hist.length-1:pos,b=kfBase(end),o=[];
  for(let i=b+1;i<=end;i++){
    const a=hist[i-1].s,m=kfBetween(a,hist[i].s);
    if(!m)break;
    o.push({s:a,m,san:san(a,m),uci:uci(m)});
  }
  return{base:hist[b].s,moves:o};
}
function kfResult(d){
  const last=d.moves.length?make(d.moves[d.moves.length-1].s,d.moves[d.moves.length-1].m):d.base;
  if(!legal(last).length)return inCheck(last,last.t==="w")?(last.t==="w"?"0-1":"1-0"):"1/2-1/2";
  if(last.h>=150||insuf(last))return "1/2-1/2";   // 75手ルール・駒不足は自動で引き分け
  return "*";
}
function kfWrap(t,w){
  const o=[];let l="";
  for(const x of t.split(" ")){if(l&&(l+" "+x).length>w){o.push(l);l=x}else l=l?l+" "+x:x}
  if(l)o.push(l);
  return o.join("\n");
}
/* 手の書き方 */
const kfSuffix=x=>(/[+#]$/.exec(x.san)||[""])[0];
function kfLanStr(x){
  const s=x.s,m=x.m,u=s.b[m.f].toUpperCase();
  if(u==="K"&&Math.abs(m.t-m.f)===2)return(m.t>m.f?"O-O":"O-O-O")+kfSuffix(x);
  const cap=s.b[m.t]||(u==="P"&&(m.t&7)!==(m.f&7));
  return(u==="P"?"":u)+sqName(m.f)+(cap?"x":"-")+sqName(m.t)+(m.pr?"="+m.pr.toUpperCase():"")+kfSuffix(x);
}
const KF_W={K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘"},KF_B={K:"♚",Q:"♛",R:"♜",B:"♝",N:"♞"};
function kfFanStr(x){
  const g=x.s.t==="w"?KF_W:KF_B;
  return x.san.replace(/^[KQRBN]/,c=>g[c]).replace(/=([QRBN])/,(_,c)=>"="+g[c]);
}
function kfIccfStr(m){return`${(m.f&7)+1}${8-(m.f>>3)}${(m.t&7)+1}${8-(m.t>>3)}${m.pr?"qrbn".indexOf(m.pr)+1:""}`}
function kfSeq(d,num,fn){
  const o=[];let first=true;
  for(const x of d.moves){
    if(num){if(x.s.t==="w")o.push(x.s.n+".");else if(first)o.push(x.s.n+"...")}
    o.push(fn(x));first=false;
  }
  return o.join(" ");
}
const KF_FN={san:x=>x.san,lan:kfLanStr,fan:kfFanStr};
function kfExport(){
  const fmt=$("kfFmt").value,d=kfMoves($("kfRange").value==="all"),f=toFen(d.base),std=f===kfStd();
  if(KF_FN[fmt])return kfSeq(d,true,KF_FN[fmt]);
  if(fmt==="uci")return d.moves.map(x=>x.uci).join(" ");
  if(fmt==="uci2")return "position "+(std?"startpos":"fen "+f)+(d.moves.length?" moves "+d.moves.map(x=>x.uci).join(" "):"");
  if(fmt==="iccf")return d.moves.map(x=>kfIccfStr(x.m)).join(" ");
  if(fmt==="fen")return toFen(S());
  if(fmt==="fens"){const o=[f];let s=d.base;for(const x of d.moves){s=make(s,x.m);o.push(toFen(s))}return o.join("\n")}
  const fn=fmt==="pgnlan"?kfLanStr:fmt==="pgnfan"?kfFanStr:x=>x.san;
  const res=$("kfRes").value==="auto"?kfResult(d):$("kfRes").value;
  const q=x=>(x||"?").replace(/"/g,"'");
  const dt=new Date(),z=n=>String(n).padStart(2,"0");
  let h=`[Event "?"]\n[Site "?"]\n[Date "${dt.getFullYear()}.${z(dt.getMonth()+1)}.${z(dt.getDate())}"]\n[Round "-"]\n[White "${q($("kfW").value)}"]\n[Black "${q($("kfB").value)}"]\n[Result "${res}"]\n`;
  if(!std)h+=`[SetUp "1"]\n[FEN "${f}"]\n`;
  return h+"\n"+kfWrap((kfSeq(d,true,fn)+" "+res).trim(),80)+"\n";
}
function renderKifu(){
  if(!$("kfOut")||curTab!=="kf")return;
  $("kfPgnOpt").hidden=!/^pgn/.test($("kfFmt").value);
  $("kfOut").value=kfExport();
}

/* ----- 入力 ----- */
const KF_FIG={"♔":"K","♕":"Q","♖":"R","♗":"B","♘":"N","♚":"K","♛":"Q","♜":"R","♝":"B","♞":"N","♙":"","♟":""};
function kfNorm(t){
  return t.replace(/[♔♕♖♗♘♚♛♜♝♞♙♟]/g,c=>KF_FIG[c]).replace(/[–−—]/g,"-").replace(/×/g,"x").replace(/[+#!?‼⁇]+$/,"");
}
function kfMoveFrom(s,tok){
  const t=kfNorm(tok);
  if(/^[1-8]{4}[1-4]?$/.test(t)){
    const f=(8-t[1])*8+(t.charCodeAt(0)-49),g=(8-t[3])*8+(t.charCodeAt(2)-49),pr=t[4]?"qrbn"[t[4]-1]:"";
    return legal(s).find(x=>x.f===f&&x.t===g&&(x.pr||"")===pr);
  }
  const g=t.match(/^([KQRBN])?([a-h][1-8])[-x:]?([a-h][1-8])(?:=?([QRBNqrbn]))?$/);
  if(g){
    const f=nameSq(g[2]),to=nameSq(g[3]);
    const c=legal(s).filter(x=>x.f===f&&x.t===to&&(!g[1]||s.b[x.f].toUpperCase()===g[1]));
    if(!c.length)return undefined;
    const pr=g[4]?g[4].toLowerCase():"";
    return c.find(x=>(x.pr||"")===pr)||(!pr?c.find(x=>x.pr==="q"):undefined);
  }
  return parseTok(s,t);
}
function kfTokens(t){
  t=t.replace(/\r/g,"").replace(/^%.*$/gm,"").replace(/;[^\n]*/g,"").replace(/\{[^}]*\}/g,"");
  let o="",d=0;
  for(const ch of t){if(ch==="(")d++;else if(ch===")"){if(d)d--}else if(!d)o+=ch}
  return o.replace(/\$\d+/g," ").replace(/\d+\s*\.(\s*\.\.)?/g," ").replace(/…/g," ")
    .split(/\s+/).filter(x=>x&&!/^(1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(x)&&!/^\.+$/.test(x)&&!/^e\.?p\.?$/i.test(x));
}
const kfUciRe=/^[a-h][1-8][a-h][1-8][qrbn]?$/i;
function kfDetect(t){
  if(/\[\s*(Event|Site|Date|White|Black|Result|FEN|SetUp)\s+"/.test(t))return "pgn";
  if(/^\s*position\s+(startpos|fen)\b/m.test(t))return "uci";
  const tk=t.trim().split(/\s+/);
  if(tk.length&&tk.every(x=>kfUciRe.test(x)))return "uci";
  if(tk.length&&tk.every(x=>/^[1-8]{4}[1-4]?$/.test(x)))return "iccf";
  if(/^\s*([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+\s+[wb]\b/m.test(t))return "fen";
  return "san";
}
function kfParse(t,fmt,game){
  if(fmt==="fen")return{fens:t.split("\n").map(x=>x.trim()).filter(Boolean).map(parseFen)};
  if(fmt==="uci"){
    let base=null,mv=t;
    const m=t.match(/position\s+fen\s+([\s\S]*?)(?:\s+moves\b|$)/i);
    if(m){base=parseFen(m[1].trim());const i=t.search(/\bmoves\b/i);mv=i>=0?t.slice(i+5):""}
    else mv=t.replace(/position\s+startpos/i,"").replace(/^\s*moves\b/i,"");
    return{base,toks:mv.split(/\s+/).filter(Boolean)};
  }
  let games=[t];
  if(/\[Event\s/.test(t))games=t.split(/\n(?=\[Event\s)/).filter(x=>x.trim());
  if(game>games.length)throw new Error(`PGNは${games.length}局分です。局番号を確認してください`);
  const g=games[Math.max(0,game-1)],fm=g.match(/\[FEN\s+"([^"]+)"\]/);
  const body=g.replace(/^\s*\[\w+\s+"[^"]*"\]\s*$/gm,"");
  return{base:fm?parseFen(fm[1]):null,toks:kfTokens(body),n:games.length};
}
const kfApply=(P,mode)=>batched(()=>kfApplyRaw(P,mode));
function kfApplyRaw(P,mode){
  if(P.fens){
    if(mode==="replace"){hist=[{s:P.fens[0],label:"読込局面"}];pos=0;reset()}
    else commit(P.fens[0],"FEN読込");
    for(const s of P.fens.slice(1))commit(s,"FEN読込");
    return "";
  }
  if(mode==="replace"){
    const b=P.base||parseFen(START);
    hist=[{s:b,label:P.base?"読込局面":"初期配置"}];pos=0;reset();
  }else if(P.base)commit(P.base,"読込局面");
  for(let i=0;i<P.toks.length;i++){
    const m=kfMoveFrom(S(),P.toks[i]);
    if(!m)return `${i+1}手目「${P.toks[i]}」が、その局面で指せない(または曖昧な)手です。手前までは読み込みました。`;
    doMove(m);
  }
  return "";
}
const KF_NAME={pgn:"PGN",uci:"UCI",fen:"FEN",san:"SAN/LAN/FAN",iccf:"ICCF数字"};
function kifuMount(){
  $("kifuMount").innerHTML=`<div class="card"><h2>棋譜の出力</h2>
  <div class="row">
    <label class="sub">形式 <select id="kfFmt"><option value="pgn" selected>PGN(SAN)</option><option value="pgnlan">PGN(ロング・アルジェブラ / LAN)</option><option value="pgnfan">PGN(図形駒 / FAN)</option><option value="san">SAN(手の列)</option><option value="lan">LAN(手の列)</option><option value="fan">FAN(手の列)</option><option value="uci">UCI(座標の列)</option><option value="uci2">UCI(position付き)</option><option value="iccf">ICCF数字</option><option value="fen">現在のFEN</option><option value="fens">FEN(全局面の一覧)</option></select></label>
    <label class="sub">範囲 <select id="kfRange"><option value="all" selected>最後まで</option><option value="cur">現在の局面まで</option></select></label>
  </div>
  <div class="row" id="kfPgnOpt"><input type="text" id="kfW" placeholder="白の名前" style="width:7em"><input type="text" id="kfB" placeholder="黒の名前" style="width:7em"><select id="kfRes"><option value="auto">結果: 自動</option><option value="*">*</option><option value="1-0">1-0</option><option value="0-1">0-1</option><option value="1/2-1/2">1/2-1/2</option></select></div>
  <textarea id="kfOut" readonly spellcheck="false"></textarea>
  <div class="row"><button id="kfCopy">コピー</button></div>
</div>
<div class="card"><h2>棋譜の入力</h2>
  <textarea id="kfIn" spellcheck="false" placeholder="PGN / SAN / LAN / FAN / UCI / ICCF数字 / FEN を貼り付け(形式は自動で判定します)"></textarea>
  <div class="row">
    <label class="sub">取り込み方 <select id="kfMode"><option value="replace" selected>履歴を置き換える</option><option value="append">今の局面から続けて追加</option></select></label>
    <label class="sub">形式 <select id="kfInFmt"><option value="auto" selected>自動判定</option><option value="pgn">PGN(手の書き方は自動)</option><option value="san">SAN/LAN/FAN</option><option value="uci">UCI</option><option value="iccf">ICCF数字</option><option value="fen">FEN</option></select></label>
    <label class="sub">PGNの局番号 <input type="number" id="kfGame" min="1" value="1" style="width:4.5em"></label>
  </div>
  <div class="row"><button id="kfLoad" class="go">読み込む</button></div>
  <div class="sub" id="kfMsg"></div>
  <div class="sub">対応: PGN(見出し・コメント・変化・複数局)、SAN、LAN(Ng1-f3、e4xd5 など)、FAN(♘f3 など)、UCI(position付きも可)、ICCF数字(5254 など)、FEN(1行または複数行)。PGNの中の手は、SAN・LAN・FANが混ざっていても読めます。</div>
</div>`;
  for(const id of["kfFmt","kfRange","kfRes"])$(id).onchange=renderKifu;
  for(const id of["kfW","kfB"])$(id).oninput=renderKifu;
  $("kfCopy").onclick=async()=>{
    try{await navigator.clipboard.writeText($("kfOut").value);$("kfMsg").textContent="コピーしました"}
    catch(e){$("kfOut").select();document.execCommand("copy")}
  };
  $("kfLoad").onclick=()=>{
    const t=$("kfIn").value,ms=$("kfMsg");
    if(!t.trim()){ms.textContent="棋譜が空です";return}
    try{
      const fmt=$("kfInFmt").value==="auto"?kfDetect(t):$("kfInFmt").value;
      const P=kfParse(t,fmt,+$("kfGame").value||1),mode=$("kfMode").value;
      if(mode==="replace"&&hist.length>1&&!confirm("現在の履歴を置き換えます。よろしいですか?"))return;
      const er=kfApply(P,mode);
      ms.textContent=er||`読み込みました(形式: ${KF_NAME[fmt]||fmt}${P.n>1?`、${P.n}局中${+$("kfGame").value||1}局目`:""})`;
    }catch(e){ms.textContent="読み込めません: "+e.message}
  };
}
kifuMount();
