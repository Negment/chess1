// ブラウザでは全スクリプトが1つのグローバル空間を共有する。
// トップレベルの名前が重複すると、読み込み時に SyntaxError で全体が止まるので、ここで検出する。
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("fs"),path=require("path");
test("js/ の トップレベル名に重複がない",()=>{
  const dir=path.join(__dirname,"..","js"),seen={},dup=[];
  for(const f of fs.readdirSync(dir).filter(x=>x.endsWith(".js"))){
    const src=fs.readFileSync(path.join(dir,f),"utf8");
    for(const m of src.matchAll(/^(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/gm)){
      const n=m[1];if(seen[n]&&seen[n]!==f)dup.push(`${n}: ${seen[n]} / ${f}`);
      seen[n]=f;
    }
  }
  assert.deepEqual(dup,[]);
});
