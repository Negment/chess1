// ブラウザ用のグローバルスクリプトを、DOMなしでNodeから読み込む
const fs=require("fs"),path=require("path"),vm=require("vm");
function load(files,extraGlobals={}){
  const ctx=vm.createContext({document:{getElementById:()=>({})},console,setTimeout,clearTimeout,Date,...extraGlobals});
  for(const f of files)vm.runInContext(fs.readFileSync(path.join(__dirname,"..","js",f),"utf8"),ctx,{filename:f});
  return ctx;
}
// スクリプト内の const/function を取り出す
const pick=(ctx,names)=>vm.runInContext("({"+names.join(",")+"})",ctx);
module.exports={load,pick};
