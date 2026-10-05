import {paragraphCandidates} from './paragraph-notes.mjs';

// The inventory comes from PDFPageProxy.getTextContent, independently of Docling.
// Keep whole native items: a partial glyph range cannot have a trustworthy box.
export function nativeText(runs){
  let text='',previous;
  for(const run of runs){
    if(previous){
      const height=Math.max(previous.bottom-previous.y,run.bottom-run.y);
      const nextLine=Math.abs(run.y-previous.y)>height*.7;
      const gap=run.x-previous.right;
      if(nextLine)text+='\n';
      else if(gap>height*.12&&!/\s$/.test(text)&&!/^\s|^[,.;:!?，。；：！？)\]]/.test(run.text))text+=' ';
    }
    text+=run.text;previous=run;
  }
  return text.trim();
}

export function recoveryOptions(doc,source){
  if(!source||source.docId!==doc.id||source.fileFingerprint!==doc.fileFingerprint)return [];
  const blocks=doc.blocks.filter(b=>b.page===source.page),active=new Set(paragraphCandidates(doc,source.page).flatMap(b=>b.sourceSegments?.map(s=>s.id)||[b.id]));
  const available=new Map(source.runs.map(r=>[r.itemIndex,r])),owned=new Set(blocks.flatMap(b=>b.itemIndices||[]));
  const options=[];
  for(const b of blocks){
    const indices=b.itemIndices||[];
    if(active.has(b.id)||!indices.length||!indices.every(n=>available.has(n)))continue;
    options.push({id:'hidden:'+b.id,itemIndices:indices,reason:b.continuation?'跨页续段':b.heading?'被识别为标题':b.artifact?'被识别为页眉 / 注释等':'短文本未显示旁注',text:nativeText(indices.map(n=>available.get(n)).sort((a,b)=>a.itemIndex-b.itemIndex))});
  }
  const used=new Set();
  function add(indices){if(!indices.length)return;indices.forEach(n=>used.add(n));options.push({id:'missing:'+indices.join(','),itemIndices:indices,reason:'未纳入识别结果',text:nativeText(indices.map(n=>available.get(n)).sort((a,b)=>a.itemIndex-b.itemIndex))});}
  // Geometry only proposes candidates; the user always checks the full source first.
  for(const group of source.groups||[]){let pending=[];for(const n of group.itemIndices){if(owned.has(n)||!available.has(n)||used.has(n)){add(pending);pending=[];}else pending.push(n);}add(pending);}
  for(const run of source.runs)if(!owned.has(run.itemIndex)&&!used.has(run.itemIndex))add([run.itemIndex]);
  return options.sort((a,b)=>Math.min(...a.itemIndices)-Math.min(...b.itemIndices));
}

export function expandRecoverySelection(doc,source,indices){
  const set=new Set(indices);
  const active=new Set(paragraphCandidates(doc,source.page).flatMap(b=>b.sourceSegments?.map(s=>s.id)||[b.id]));
  // Hidden semantic units are replaced whole, so no residual text is lost.
  for(const b of doc.blocks.filter(b=>b.page===source.page&&!active.has(b.id)))if(b.itemIndices?.some(n=>set.has(n)))for(const n of b.itemIndices)set.add(n);
  return [...set].sort((a,b)=>a-b);
}

export function prepareRecovery(doc,source,indices){
  if(!source||source.docId!==doc.id||source.fileFingerprint!==doc.fileFingerprint)throw Error('原文页面已变化，请重新选择。');
  if(!indices?.length||indices.some(n=>!Number.isInteger(n)))throw Error('请先选择可核对的 PDF 原始文字。');
  const selected=new Set(indices),runs=source.runs.filter(r=>selected.has(r.itemIndex)).sort((a,b)=>a.itemIndex-b.itemIndex);
  if(runs.length!==selected.size)throw Error('选区中的原始文字项已不可用，请重新选择。');
  const owners=doc.blocks.filter(b=>b.page===source.page&&b.itemIndices?.some(n=>selected.has(n)));
  const active=new Set(paragraphCandidates(doc,source.page).flatMap(b=>b.sourceSegments?.map(s=>s.id)||[b.id]));
  if(owners.some(b=>active.has(b.id)))throw Error('选区包含已有解读段落。请只选择缺失文字；已有段落可在“调整已识别”中合并或拆分。');
  if(owners.some(b=>!b.itemIndices.every(n=>selected.has(n))))throw Error('请纳入完整的未显示单元，避免丢失剩余原文。');
  const text=nativeText(runs);if(!text)throw Error('没有可补入的原文。');
  const boxes=runs.map(({x,y,right,bottom})=>({x,y,right,bottom}));
  return {page:source.page,text,itemIndices:runs.map(r=>r.itemIndex),lines:structuredClone(runs),boxes,replacedIds:owners.map(b=>b.id),sourceRefs:[...new Set(owners.flatMap(b=>b.sourceRefs||[]))],column:owners[0]?.column??source.groups?.find(g=>g.itemIndices.some(n=>selected.has(n)))?.column??0};
}

// Conservative attention hints. Full inventory remains available in manual recovery.
export function suspectedGaps(doc,source){
  if(doc.parser!=='docling')return [];
  const dismissed=new Set(doc.pdfReview?.dismissed||[]);
  return recoveryOptions(doc,source).filter(c=>{
    const b=c.id.startsWith('hidden:')?doc.blocks.find(b=>'hidden:'+b.id===c.id):null;
    const text=c.text.trim(),letters=(text.match(/[\p{L}\p{N}]/gu)||[]).length;
    if(letters<35||/^(https?:|doi\s*:|copyright|©|arxiv:)/i.test(text))return false;
    const runs=source.runs.filter(r=>c.itemIndices.includes(r.itemIndex));
    const body=runs.some(r=>r.y>(source.height||800)*.065&&r.bottom<(source.height||800)*.94);
    if(!body)return false;
    if(b?.heading)return letters>=100&&/[.!?。！？]\s*$/.test(text);
    if(b?.artifact)return letters>=100&&/[.!?。！？]\s*$/.test(text)&&!/^(references|参考文献|\[\d+\])/.test(text);
    return true;
  }).map(c=>({...c,key:JSON.stringify([doc.fileFingerprint,source.page,c.itemIndices,c.text])})).filter(c=>!dismissed.has(c.key));
}
