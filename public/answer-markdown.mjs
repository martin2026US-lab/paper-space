import {renderMarkdown} from './rich-text.mjs';
// Some model responses put whitespace just inside **. Preserve literal code blocks/spans.
export function normalizeAnswerMarkdown(text){
 let fence=null;
 return String(text||'').split('\n').map(line=>{
  const marker=line.match(/^\s{0,3}(`{3,}|~{3,})/);
  if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence=null;return line;}
  if(fence||/^(?: {4}|\t)/.test(line))return line;
  const fix=s=>s.replace(/(?<!\\)\*\*([^*\n]+?)\*\*/g,(raw,body)=>body.trim()?'**'+body.trim()+'**':raw);
  let at=0,result='';for(const m of line.matchAll(/(`+)(.*?)\1/g)){result+=fix(line.slice(at,m.index))+m[0];at=m.index+m[0].length;}return result+fix(line.slice(at));
 }).join('\n');
}
export function renderAnswer(host,text){return renderMarkdown(host,normalizeAnswerMarkdown(text));}
