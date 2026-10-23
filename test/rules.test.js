const test=require("node:test"),assert=require("node:assert/strict");
const {load,pick}=require("./helpers");
const R=pick(load(["chess.js"]),["START","parseFen","toFen","make","legal","san","parseTok","rkey","inCheck"]);
const {START,parseFen,toFen,make,legal,san,parseTok,rkey}=R;

const perft=(s,d)=>{if(!d)return 1;let n=0;for(const m of legal(s))n+=perft(make(s,m),d-1);return n};
for(const [name,fen,d,exp] of [
  ["初期配置",START,3,8902],
  ["Kiwipete","r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",3,97862],
  ["局面3(アンパッサン・ピン)","8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",4,43238],
  ["局面4(昇格・キャスリング)","r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",3,9467],
  ["局面5","rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",3,62379],
])test("perft: "+name,()=>assert.equal(perft(parseFen(fen),d),exp));

const play=(toks,s=parseFen(START))=>{const keys=[];for(const t of toks){const m=parseTok(s,t);assert.ok(m,t);s=make(s,m);keys.push(rkey(s))}return{s,keys}};

test("同一局面: 取れないアンパッサン欄は区別しない(1.e4直後 = 3.Nb1直後)",()=>{
  const {keys}=play(["e4","Nf6","Nc3","Ng8","Nb1"]);
  assert.equal(keys[0],keys[4]);
});
test("同一局面: 実際にアンパッサンで取れる局面は区別する",()=>{
  const a=parseFen("4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1");   // dxe3 e.p. が可能
  const b=parseFen("4k3/8/8/8/3pP3/8/8/4K3 b - - 0 1");
  assert.notEqual(rkey(a),rkey(b));
});
test("SAN: 往復変換(キャスリング・昇格・曖昧さ解消)",()=>{
  const cases=[["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",["O-O","O-O-O"]],
    ["4k3/1P6/8/8/8/8/8/4K3 w - - 0 1",["b8=Q+","b8=N"]],
    ["4k3/8/8/8/8/8/4K3/R6R w - - 0 1",["Rad1","Rhd1","Rag1"]]];
  for(const [f,toks] of cases)for(const t of toks){
    const s=parseFen(f),m=parseTok(s,t);assert.ok(m,t);
    assert.equal(san(s,m),t);
  }
});
test("FEN: 往復して同じ文字列になる",()=>{
  const f="r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
  assert.equal(toFen(parseFen(f)),f);
});
test("FEN: 不正な局面は例外",()=>{
  assert.throws(()=>parseFen("8/8/8/8/8/8/8/8 w - - 0 1"));                       // キングなし
  assert.throws(()=>parseFen("4k3/8/8/8/8/8/8/4K2P w - - 0 1"));                  // 1段目のポーン
});
