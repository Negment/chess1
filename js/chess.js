"use strict";
const $=id=>document.getElementById(id);
const F="abcdefgh",MATE=100000;
const sqName=i=>F[i&7]+(8-(i>>3));
const nameSq=s=>(8-+s[1])*8+F.indexOf(s[0]);
const isW=p=>p>="A"&&p<="Z";
const GL={K:"♚",Q:"♛",R:"♜",B:"♝",N:"♞",P:"♟"};
const glyph=p=>GL[p.toUpperCase()]+"\uFE0E";
const START="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/* ---------- 盤面・FEN ---------- */
function norm(s){
  const b=s.b;let c="";
  if(b[60]==="K"&&b[63]==="R"&&s.c.includes("K"))c+="K";
  if(b[60]==="K"&&b[56]==="R"&&s.c.includes("Q"))c+="Q";
  if(b[4]==="k"&&b[7]==="r"&&s.c.includes("k"))c+="k";
  if(b[4]==="k"&&b[0]==="r"&&s.c.includes("q"))c+="q";
  return {...s,c};
}
function fenProblems(s){
  const b=s.b,cnt={};
  for(const p of b)if(p)cnt[p]=(cnt[p]||0)+1;
  const n=x=>cnt[x]||0;
  if(n("K")!==1||n("k")!==1)return "キングは白黒1枚ずつ必要です";
  for(const[nm,L]of[["白","PNBRQ"],["黒","pnbrq"]]){
    const tot=[...L].reduce((a,x)=>a+n(x),0)+1;
    if(tot>16)return nm+"の駒が16枚を超えています";
    if(n(L[0])>8)return nm+"のポーンが8枚を超えています";
    const ex=[[1,2],[2,2],[3,2],[4,1]].reduce((a,[i,base])=>a+Math.max(0,n(L[i])-base),0);
    if(n(L[0])+ex>8)return nm+"の駒の数が、昇格を考えても合いません";
  }
  const wk=b.indexOf("K"),bk=b.indexOf("k");
  if(Math.abs((wk>>3)-(bk>>3))<=1&&Math.abs((wk&7)-(bk&7))<=1)return "キング同士が隣り合っています";
  for(let i=0;i<8;i++)if(/[Pp]/.test(b[i]+b[56+i]))return "ポーンが1段目・8段目にあります";
  if(inCheck(s,s.t!=="w"))return "手番でない側のキングがチェックされています";
  if(s.e>=0){
    const w=s.t==="w";
    if((s.e>>3)!==(w?2:5))return "アンパッサンのマスの段が不正です";
    if(b[s.e]||b[s.e+(w?-8:8)])return "アンパッサンのマスが空いていません";
    if(b[s.e+(w?8:-8)]!==(w?"p":"P"))return "アンパッサンのマスの手前に、取られるポーンがありません";
  }
  if(!(s.h>=0)||!(s.n>=1))return "手数の値が不正です";
  return "";
}
function parseFen(f){
  const p=f.trim().split(/\s+/),b=[];
  if(p.length<2||p.length>6)throw new Error("FENの項目数が合いません(盤面・手番・キャスリング・アンパッサン・半手数・手数)");
  const rows=p[0].split("/");
  if(rows.length!==8)throw new Error("FENの盤面が8段になっていません");
  for(const row of rows){
    let n=0;
    for(const ch of row){
      if(/[1-8]/.test(ch)){for(let i=0;i<+ch;i++)b.push("");n+=+ch}
      else if(/[KQRBNPkqrbnp]/.test(ch)){b.push(ch);n++}
      else throw new Error("FENに使えない文字「"+ch+"」があります");
    }
    if(n!==8)throw new Error("FENの1段が8マスになっていません: "+row);
  }
  if(!/^[wb]$/.test(p[1]))throw new Error("FENの手番は w か b です");
  if(p[2]&&!/^(-|[KQkq]{1,4})$/.test(p[2]))throw new Error("FENのキャスリング欄が不正です");
  if(p[3]&&!/^(-|[a-h][36])$/.test(p[3]))throw new Error("FENのアンパッサン欄が不正です");
  if((p[4]&&!/^\d+$/.test(p[4]))||(p[5]&&!/^[1-9]\d*$/.test(p[5])))throw new Error("FENの手数欄が不正です");
  const s=norm({b,t:p[1],c:p[2]&&p[2]!=="-"?p[2]:"",e:p[3]&&p[3]!=="-"?nameSq(p[3]):-1,h:+p[4]||0,n:+p[5]||1});
  const pr=fenProblems(s);if(pr)throw new Error("FENが不正です: "+pr);
  return s;
}
function toFen(s){
  let o="";
  for(let r=0;r<8;r++){let e=0;for(let c=0;c<8;c++){const p=s.b[r*8+c];if(p){if(e)o+=e;e=0;o+=p}else e++}if(e)o+=e;if(r<7)o+="/"}
  return `${o} ${s.t} ${s.c||"-"} ${s.e<0?"-":sqName(s.e)} ${s.h} ${s.n}`;
}

/* ---------- 手の生成 ---------- */
const NN=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KK=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const DG=[[-1,-1],[-1,1],[1,-1],[1,1]],RK=[[-1,0],[1,0],[0,-1],[0,1]];
const inb=(r,c)=>r>=0&&r<8&&c>=0&&c<8;

function attacked(b,sq,byW){
  const r=sq>>3,c=sq&7,pr=byW?r+1:r-1,pp=byW?"P":"p";
  for(const dc of[-1,1])if(inb(pr,c+dc)&&b[pr*8+c+dc]===pp)return true;
  const n=byW?"N":"n",k=byW?"K":"k";
  for(const[dr,dc]of NN)if(inb(r+dr,c+dc)&&b[(r+dr)*8+c+dc]===n)return true;
  for(const[dr,dc]of KK)if(inb(r+dr,c+dc)&&b[(r+dr)*8+c+dc]===k)return true;
  const B=byW?"B":"b",R=byW?"R":"r",Q=byW?"Q":"q";
  for(const[dr,dc]of DG){let y=r+dr,x=c+dc;while(inb(y,x)){const p=b[y*8+x];if(p){if(p===B||p===Q)return true;break}y+=dr;x+=dc}}
  for(const[dr,dc]of RK){let y=r+dr,x=c+dc;while(inb(y,x)){const p=b[y*8+x];if(p){if(p===R||p===Q)return true;break}y+=dr;x+=dc}}
  return false;
}
function inCheck(s,w){const k=s.b.indexOf(w?"K":"k");return k>=0&&attacked(s.b,k,!w)}

function pseudo(s){
  const b=s.b,w=s.t==="w",out=[];
  for(let i=0;i<64;i++){
    const p=b[i];if(!p||isW(p)!==w)continue;
    const r=i>>3,c=i&7,u=p.toUpperCase();
    const add=(t,pr)=>out.push({f:i,t,pr:pr||""});
    if(u==="P"){
      const d=w?-1:1,st=w?6:1,last=w?0:7,r1=r+d;
      if(r1<0||r1>7)continue;
      if(!b[r1*8+c]){
        if(r1===last)for(const x of"qrbn")add(r1*8+c,x);
        else{add(r1*8+c);if(r===st&&!b[(r+2*d)*8+c])add((r+2*d)*8+c)}
      }
      for(const dc of[-1,1]){
        const cc=c+dc;if(cc<0||cc>7)continue;
        const t=r1*8+cc,q=b[t];
        if((q&&isW(q)!==w)||t===s.e){if(r1===last)for(const x of"qrbn")add(t,x);else add(t)}
      }
    }else if(u==="N"||u==="K"){
      for(const[dr,dc]of u==="N"?NN:KK){
        if(!inb(r+dr,c+dc))continue;
        const t=(r+dr)*8+c+dc,q=b[t];
        if(!q||isW(q)!==w)add(t);
      }
      if(u==="K"&&i===(w?60:4)&&!inCheck(s,w)){
        const base=i,ks=w?"K":"k",qs=w?"Q":"q";
        if(s.c.includes(ks)&&!b[base+1]&&!b[base+2]&&!attacked(b,base+1,!w)&&!attacked(b,base+2,!w))add(base+2);
        if(s.c.includes(qs)&&!b[base-1]&&!b[base-2]&&!b[base-3]&&!attacked(b,base-1,!w)&&!attacked(b,base-2,!w))add(base-2);
      }
    }else{
      for(const[dr,dc]of u==="B"?DG:u==="R"?RK:DG.concat(RK)){
        let y=r+dr,x=c+dc;
        while(inb(y,x)){
          const t=y*8+x,q=b[t];
          if(!q)add(t);else{if(isW(q)!==w)add(t);break}
          y+=dr;x+=dc;
        }
      }
    }
  }
  return out;
}
function make(s,m){
  const b=s.b.slice(),p=b[m.f],w=isW(p),cap=b[m.t],u=p.toUpperCase();
  let e=-1,c=s.c;
  b[m.t]=m.pr?(w?m.pr.toUpperCase():m.pr):p;b[m.f]="";
  if(u==="P"&&m.t===s.e&&!cap)b[m.t+(w?8:-8)]="";
  if(u==="P"&&Math.abs(m.t-m.f)===16)e=(m.f+m.t)/2;
  if(u==="K"&&Math.abs(m.t-m.f)===2){
    if(m.t>m.f){b[m.f+1]=b[m.f+3];b[m.f+3]=""}else{b[m.f-1]=b[m.f-4];b[m.f-4]=""}
  }
  if(p==="K")c=c.replace("K","").replace("Q","");
  if(p==="k")c=c.replace("k","").replace("q","");
  for(const q of[m.f,m.t]){if(q===63)c=c.replace("K","");if(q===56)c=c.replace("Q","");if(q===7)c=c.replace("k","");if(q===0)c=c.replace("q","")}
  return {b,t:w?"b":"w",c,e,h:(u==="P"||cap)?0:s.h+1,n:s.n+(w?0:1)};
}
function legal(s,caps){
  const w=s.t==="w";
  return pseudo(s).filter(m=>{
    if(caps&&!(s.b[m.t]||m.pr||(s.b[m.f].toUpperCase()==="P"&&m.t===s.e)))return false;
    return !inCheck(make(s,m),w);
  });
}

/* ---------- 局面の同一判定(FIDE: アンパッサンは「実際に取れる時」だけ区別する) ---------- */
function epLegal(s){
  if(s.e<0)return false;
  return legal(s).some(m=>s.b[m.f].toUpperCase()==="P"&&m.t===s.e);
}
function rkey(s){
  const f=toFen(s).split(" ");
  if(f[3]!=="-"&&!epLegal(s))f[3]="-";
  return f.slice(0,4).join(" ");
}

/* ---------- 棋譜表記 ---------- */
const uci=m=>sqName(m.f)+sqName(m.t)+m.pr;
function san(s,m){
  const p=s.b[m.f],u=p.toUpperCase();let o;
  if(u==="K"&&Math.abs(m.t-m.f)===2)o=m.t>m.f?"O-O":"O-O-O";
  else{
    const cap=s.b[m.t]||(u==="P"&&m.t===s.e);
    if(u==="P")o=(cap?F[m.f&7]+"x":"")+sqName(m.t)+(m.pr?"="+m.pr.toUpperCase():"");
    else{
      o=u;
      const am=legal(s).filter(x=>x.t===m.t&&x.f!==m.f&&s.b[x.f]===p);
      if(am.length){
        const sf=am.some(x=>(x.f&7)===(m.f&7)),sr=am.some(x=>(x.f>>3)===(m.f>>3));
        if(!sf)o+=F[m.f&7];else if(!sr)o+=8-(m.f>>3);else o+=sqName(m.f);
      }
      if(cap)o+="x";
      o+=sqName(m.t);
    }
  }
  const n=make(s,m);
  if(inCheck(n,n.t==="w"))o+=legal(n).length?"+":"#";
  return o;
}
const nz=x=>x.replace(/[+#!?x=:]/g,"").replace(/0/g,"O");
function parseTok(s,t){
  const ms=legal(s),k=nz(t);if(!k)return null;
  let r=ms.filter(m=>nz(san(s,m))===k||uci(m)===k.toLowerCase());
  if(!r.length){const kl=k.toLowerCase();r=ms.filter(m=>nz(san(s,m)).toLowerCase()===kl)}
  return r.length===1?r[0]:null;
}

/* ---------- 探索エンジン ---------- */
const V={P:100,N:320,B:330,R:500,Q:900,K:0};
function ev(s){
  const b=s.b,cnt=b.filter(Boolean).length;let v=0;
  for(let i=0;i<64;i++){
    const p=b[i];if(!p)continue;
    const w=isW(p),u=p.toUpperCase(),r=i>>3,c=i&7,d=Math.abs(c-3.5)+Math.abs(r-3.5);
    let x=V[u];
    if(u==="P")x+=(w?6-r:r-1)*6;
    else if(u==="N"||u==="B"||u==="Q")x+=(4-d)*4;
    else if(u==="K"&&cnt<=10)x+=(4-d)*8;
    v+=w?x:-x;
  }
  return s.t==="w"?v:-v;
}
let nodes=0,tEnd=0;
const chk=()=>{if((++nodes&1023)===0&&Date.now()>tEnd)throw"T"};
function order(s,ms,first){
  const sc=m=>{
    let x=0;const v=s.b[m.t]||(s.b[m.f].toUpperCase()==="P"&&m.t===s.e?"P":"");
    if(v)x+=10*V[v.toUpperCase()]-V[s.b[m.f].toUpperCase()]/10+1000;
    if(m.pr)x+=800;
    if(first&&m.f===first.f&&m.t===first.t&&m.pr===first.pr)x+=1e6;
    return x;
  };
  return ms.map(m=>[sc(m),m]).sort((a,b)=>b[0]-a[0]).map(x=>x[1]);
}
const keyOf=s=>s.b.map(p=>p||".").join("")+s.t+s.c;
let SEARCH_HIST=new Set(),PATHK=[];
function qs(s,a,b,ply){
  chk();ply=ply||0;
  const ic=inCheck(s,s.t==="w");
  if(ic&&ply<30){
    const ms=legal(s);if(!ms.length)return -(MATE-ply);
    for(const m of order(s,ms)){const sc=-qs(make(s,m),-b,-a,ply+1);if(sc>=b)return sc;if(sc>a)a=sc}
    return a;
  }
  const st=ev(s);if(st>=b)return st;if(st>a)a=st;
  const cs=legal(s,true);
  if(!cs.length&&!ic){let n=0;for(const p of s.b)if(p)n++;if(n<=8&&!legal(s).length)return 0}
  for(const m of order(s,cs)){
    const sc=-qs(make(s,m),-b,-a,ply+1);
    if(sc>=b)return sc;if(sc>a)a=sc;
  }
  return a;
}
function nm(s,d,a,b,ply){
  chk();
  if(s.h>=100)return 0;
  let rk=null;
  if(s.h>=4){rk=keyOf(s);if(SEARCH_HIST.has(rk)||PATHK.includes(rk))return 0}
  const w=s.t==="w",ic=inCheck(s,w);
  if((d<=0&&!ic)||ply>16)return qs(s,a,b,ply);
  const ms=legal(s);
  if(!ms.length)return ic?-(MATE-ply):0;
  PATHK.push(rk);
  try{
    for(const m of order(s,ms)){
      const sc=-nm(make(s,m),d-1,-b,-a,ply+1);
      if(sc>=b)return sc;if(sc>a)a=sc;
    }
  }finally{PATHK.pop()}
  return a;
}
function search(s,ms,limit,maxD){
  nodes=0;tEnd=Date.now()+limit;PATHK.length=0;PATHK.push(s.h>=4?keyOf(s):null);
  let best=ms[0],bs=0,depth=0;
  try{
    for(let d=1;d<=maxD;d++){
      let a=-MATE-1,cb=null,cs=-Infinity;
      for(const m of order(s,ms,best)){
        const sc=-nm(make(s,m),d-1,-MATE-1,-a,1);
        if(sc>cs){cs=sc;cb=m}
        if(sc>a)a=sc;
      }
      best=cb;bs=cs;depth=d;
      if(Math.abs(bs)>MATE-100)break;
    }
  }catch(e){if(e!=="T")throw e}
  return {m:best,score:bs,depth};
}
function scoreText(sc){
  if(Math.abs(sc)>MATE-100){const n=Math.ceil((MATE-Math.abs(sc))/2);return sc>0?`${n}手で詰み`:`${n}手で詰まされる`}
  return (sc>=0?"+":"")+(sc/100).toFixed(2)+"(手番側から見た評価)";
}
