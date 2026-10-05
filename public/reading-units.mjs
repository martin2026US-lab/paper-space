// Logical reading units keep one immutable source fragment per physical page.
const clone=x=>structuredClone(x);
const eligible=b=>!b.heading&&!b.artifact&&b.kind!=='table'&&b.kind!=='formula';
export function readingUnits(doc){
  const blocks=doc.blocks||[], groups=[], used=new Set();
  for(const link of doc.crossPageLinks||[]){
    if(link.deletedAt)continue;
    const parts=link.sources.map(s=>blocks.find(b=>b.id===s.id&&b.text===s.text&&b.page===s.page));
    if(parts.some(b=>!b)||parts.some(b=>used.has(b)))continue;
    groups.push({id:link.id,parts,manual:true});parts.forEach(b=>used.add(b));
  }
  // Docling emits the same source unit on each page. Never infer a join from prose alone.
  for(const b of blocks){if(used.has(b))continue;
    const refs=JSON.stringify(b.sourceRefs||[b.sourceRef]);
    const parts=(b.sourceRef||b.sourceRefs?.length)&&!b.manual?blocks.filter(x=>!used.has(x)&&!x.manual&&x.text===b.text&&JSON.stringify(x.sourceRefs||[x.sourceRef])===refs).sort((a,c)=>a.page-c.page):[b];
    const contiguous=parts.length>1&&parts.every((x,i)=>!i||x.page===parts[i-1].page+1);
    if(contiguous){groups.push({id:b.id,parts,automatic:true});parts.forEach(x=>used.add(x));}
    else {groups.push({id:b.id,parts:[b]});used.add(b);}
  }
  return groups.map(g=>{
    if(g.parts.length===1)return g.parts[0];
    const first=g.parts[0],last=g.parts.at(-1);
    return {...first,id:g.id,text:g.automatic?first.text:g.parts.map(b=>b.text).join('\n'),continuation:false,page:first.page,endPage:last.page,crossPage:true,manualLink:g.manual,sourceSegments:g.parts.map(clone)};
  }).sort((a,b)=>blocks.findIndex(x=>x.id===(a.sourceSegments?.[0].id||a.id))-blocks.findIndex(x=>x.id===(b.sourceSegments?.[0].id||b.id)));
}
export function readingUnit(doc,id){return readingUnits(doc).find(b=>b.id===id||b.sourceSegments?.some(s=>s.id===id));}
export function pageFragment(unit,page){return unit?.sourceSegments?.find(s=>s.page===page)||(unit?.page===page?unit:null);}
export function pageRange(unit){return unit.endPage&&unit.endPage!==unit.page?unit.page+'–'+unit.endPage:String(unit.page);}
export function boundaryPair(doc,page){
  const body=(doc.blocks||[]).filter(b=>!b.artifact),left=body.filter(b=>b.page===page).at(-1),right=body.find(b=>b.page===page+1);
  if(!left||!right||!eligible(left)||!eligible(right)||left.continuation||right.continuation)return null;
  if(readingUnit(doc,left.id)?.crossPage||readingUnit(doc,right.id)?.crossPage)return null;
  return [left,right];
}
export function linkBoundary(doc,parts){
  if(parts.length!==2||!parts.every(eligible)||parts[1].page!==parts[0].page+1)throw Error('请选择相邻两页的正文段落。');
  const pair=boundaryPair(doc,parts[0].page);if(!pair||pair.some((b,i)=>b.id!==parts[i].id))throw Error('原文已改变，请重新选择。');
  doc.crossPageLinks||=[];const link={id:'cross-'+crypto.randomUUID(),sources:parts.map(b=>({id:b.id,text:b.text,page:b.page})),createdAt:Date.now()};doc.crossPageLinks.push(link);return link;
}
export function unlinkUnit(doc,id){const link=doc.crossPageLinks?.find(l=>l.id===id);if(link)link.deletedAt=Date.now();}
