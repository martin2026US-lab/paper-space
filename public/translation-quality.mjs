export const QUALITY_KEY='paper-space-translation-quality';
const languages=new Set(['zh-CN','zh-TW','en','ja','ko','fr','de','es','pt','ru','ar','it']);
export function cleanQualitySettings(value={}){
 const reviewer=value.reviewer||{},entries=Array.isArray(value.glossary)?value.glossary:[];
 const glossary=[],seen=new Map();
 for(const item of entries.slice(0,10001)){
  if(glossary.length>=10000)throw Error('术语表最多支持 10,000 条。');
  if(!item||typeof item.source!=='string'||typeof item.target!=='string'||item.language&&!languages.has(item.language))throw Error('术语条目需要有效的原词、译词和目标语言。');
  const source=String(item.source||'').trim(),target=String(item.target||'').trim(),language=languages.has(item.language)?item.language:'zh-CN';
  if(!source||!target||source.length>200||target.length>400||/[\u0000-\u0008]/.test(source+target))throw Error('术语条目需要有效的原词、译词和目标语言。');
  const key=language+'\n'+source.toLocaleLowerCase();if(seen.has(key)){if(seen.get(key)!==target)throw Error('同一语言的术语存在冲突：'+source);continue;}seen.set(key,target);
  glossary.push({source,target,language,note:String(item.note||'').slice(0,500)});
 }
 return{version:1,enabled:value.enabled!==false,glossary,reviewer:{provider:reviewer.provider==='custom'?'custom':'reading',baseUrl:typeof reviewer.baseUrl==='string'?reviewer.baseUrl.slice(0,2000):'',format:reviewer.format==='anthropic'?'anthropic':'openai',model:typeof reviewer.model==='string'?reviewer.model.slice(0,300):''}};
}
export function loadQualitySettings(storage){try{return cleanQualitySettings(JSON.parse(storage?.getItem(QUALITY_KEY)||'{}'));}catch{return cleanQualitySettings();}}
export function matchingTerms(text,entries=[],language='zh-CN'){
 const normalized=text.toLocaleLowerCase();return entries.filter(e=>e.language===language).filter(e=>{
  const term=e.source.toLocaleLowerCase();let start=normalized.indexOf(term);while(start>=0){const before=normalized[start-1]||'',after=normalized[start+term.length]||'';if((!/[a-z0-9]/i.test(term[0])||!/[a-z0-9]/i.test(before))&&(!/[a-z0-9]/i.test(term.at(-1))||!/[a-z0-9]/i.test(after)))return true;start=normalized.indexOf(term,start+1);}return false;
 }).sort((a,b)=>b.source.length-a.source.length).slice(0,100);
}
export function glossaryContext(text,entries,language){return matchingTerms(text,entries,language).map(({source,target,language})=>({source,target,language}));}
export function qualityFindings({text,translation,targetLanguage='zh-CN',glossary=[]}){
 if(typeof text!=='string'||typeof translation!=='string'||text.length>24000||translation.length>100000)throw Error('质检需要有效的原文和译文。');
 const issues=[],push=(code,detail)=>issues.push({code,detail});
 const normalize=s=>s.normalize('NFKC').replaceAll('−','-').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g,'').replace(/\s+/g,' ');
 const source=normalize(text),target=normalize(translation);
 const numbers=s=>s.match(/(?<![\p{L}\p{N}])[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?%?/gu)||[];
 const missing=[...new Set(numbers(source))].filter(n=>!numbers(target).includes(n));if(missing.length)push('numbers',missing.join(' · '));
 const citations=s=>s.match(/\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]/g)||[];
 const lost=[...new Set(citations(source))].filter(c=>!target.replaceAll(' ','').includes(c.replaceAll(' ','')));if(lost.length)push('citations',lost.join(' · '));
 const units=['mm','cm','kg','mg','mL','Hz','MHz','kHz','MPa','μm','µm','°C'];const lostUnits=units.filter(u=>new RegExp('\\d\\s*'+u+'(?![a-zA-Z])').test(source)&&!target.includes(u));if(lostUnits.length)push('units',lostUnits.join(' · '));
 if(source.trim().length>40&&source.trim()===target.trim())push('unchanged','');
 if(text.length>160&&translation.length<text.length*.12)push('short','');
 if(/^\s*(?:translation|译文|翻译结果)\s*[:：]/i.test(translation)||/<think>|```/i.test(translation))push('format','');
 const terms=matchingTerms(text,glossary,targetLanguage);for(const term of terms)if(!translation.toLocaleLowerCase().includes(term.target.toLocaleLowerCase()))push('term',term.source+' → '+term.target);
 return{issues,terms,kind:'rules',checkedAt:Date.now()};
}
export function parseGlossary(text,{language='zh-CN'}={}){
 if(typeof text!=='string'||text.length>1500000)throw Error('术语表文件请控制在 1.5 MB 以内。');text=text.replace(/^\uFEFF/,'').trim();let entries;
 if(text.startsWith('[')||text.startsWith('{')){const data=JSON.parse(text);entries=Array.isArray(data)?data:data.entries||data.glossary;if(!Array.isArray(entries))throw Error('术语表 JSON 需要 entries 数组。');}
 else{
  const sep=text.split(/\r?\n/,1)[0].includes('\t')?'\t':',';const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else cell+=c;}else if(!quoted&&(c===sep||c==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(c==='\n'){if(row.some(v=>v.trim()))rows.push(row);row=[];}}else cell+=c;}
  if(quoted)throw Error('术语表引号未闭合。');row.push(cell.replace(/\r$/,''));if(row.some(v=>v.trim()))rows.push(row);
  let header=rows[0]?.map(c=>c.trim().toLowerCase()),start=header?.includes('source')?1:0;
  const col=(name,fallback)=>start?header.indexOf(name):fallback;
  if(start&&col('target')<0)throw Error('术语表需要 source 和 target 列。');
  entries=rows.slice(start).map(r=>({source:r[col('source',0)],target:r[col('target',1)],language:r[col('language',2)]||language,note:r[col('note',3)]||''}));
 }
 return cleanQualitySettings({glossary:entries.map(e=>({...e,language:e.language||language}))}).glossary;
}
export function exportGlossary(entries){return JSON.stringify({version:1,entries:cleanQualitySettings({glossary:entries}).glossary},null,2);}
