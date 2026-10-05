// Keep exact UTF-16 offsets so ranges can highlight the original text.
export function splitSentences(text) {
  const out=[];let start=0;
  const abbreviation=/(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Fig|Figs|Eq|Eqs|Ref|Refs|vs|etc|al|No|Vol|pp|Inc|Jr|Sr)|\b(?:e\.g|i\.e))\.$/i;
  const initial=/\b(?:[A-Z]\.)*[A-Z]\.$/;
  // Intl provides language-aware candidates; explicit punctuation catches compact
  // Chinese text and joins false boundaries at scientific abbreviations.
  const candidates=new Set();
  if(typeof Intl.Segmenter==='function')for(const s of new Intl.Segmenter('en',{granularity:'sentence'}).segment(text))candidates.add(s.index+s.segment.trimEnd().length);
  for(let i=0;i<text.length;i++){
    const c=text[i];if(!/[。！？.!?]/.test(c))continue;
    if(c==='.' && (/\d/.test(text[i-1]||'')&&/\d/.test(text[i+1]||'') || abbreviation.test(text.slice(Math.max(0,i-30),i+1)) || initial.test(text.slice(Math.max(0,i-30),i+1)) || /[A-Za-z]/.test(text[i-1]||'')&&/[A-Za-z]/.test(text[i+1]||'')))continue;
    let end=i+1;while(end<text.length&&/[。！？.!?"'”’）)]/.test(text[end]))end++;
    while(/^\s*\[\d+(?:\s*[,–-]\s*\d+)*\]/.test(text.slice(end))){const ref=text.slice(end).match(/^\s*\[\d+(?:\s*[,–-]\s*\d+)*\]/)[0];end+=ref.length;}
    if(c==='.'&&!candidates.has(end)&&!/^\s|$/.test(text.slice(end)))continue;
    let a=start;while(/\s/.test(text[a]||'')&&a<end)a++;if(end>a)out.push({text:text.slice(a,end),start:a,end});start=end;i=end-1;
  }
  while(/\s/.test(text[start]||'')&&start<text.length)start++;let end=text.trimEnd().length;if(end>start)out.push({text:text.slice(start,end),start,end});return out;
}
export function translationKey(sentence,config){return JSON.stringify([sentence,'zh-CN',new URL(config.baseUrl).href,config.format||'openai',config.model]);}
export class RequestSlot {
  constructor(){this.serial=0;this.controller=null;}
  cancel(){this.serial++;this.controller?.abort();this.controller=null;}
  begin(){this.cancel();this.controller=new AbortController();return{serial:this.serial,signal:this.controller.signal};}
  current(token){return token.serial===this.serial&&!token.signal.aborted;}
}
