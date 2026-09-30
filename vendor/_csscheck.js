const fs=require('fs'),path=require('path');
const files=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()){if(!e.name.startsWith('vendor'))walk(p);} else if(e.name.endsWith('.css'))files.push(p);}}
walk('D:/vibe-coding/3D-web page');
let bad=0;
for(const f of files){
  const s=fs.readFileSync(f,'utf8');
  // strip comments and strings
  const clean=s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"[^"\n]*"/g,'""').replace(/'[^'\n]*'/g,"''");
  let depth=0,line=1,errs=[];
  for(let i=0;i<clean.length;i++){
    const c=clean[i];
    if(c==='\n')line++;
    if(c==='{')depth++;
    if(c==='}'){depth--; if(depth<0){errs.push('extra } line '+line);depth=0;}}
  }
  if(depth!==0)errs.push('unclosed braces: depth='+depth);
  if(/@media[^{]*\{\s*$/.test(clean))errs.push('dangling @media');
  const rel=path.relative('D:/vibe-coding/3D web page',f);
  if(errs.length){bad++;console.log('FAIL '+rel+' -> '+errs.join('; '));}
  else console.log('ok   '+rel+' ('+s.length+' bytes, balanced)');
}
console.log(bad?('\n'+bad+' CSS FILE(S) WITH ISSUES'):'\nALL CSS BALANCED');
