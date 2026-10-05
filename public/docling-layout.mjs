import {reconcileStructure} from './structure.mjs';
export const DOCLING_LAYOUT_VERSION=1;
const furniture=new Set(['page_header','page_footer','reference','footnote']);
const headings=new Set(['title','section_header']);
const math=b=>b?.kind==='formula';
const definition=b=>/^(where\b|in which\b|here\b|其中|式中)/i.test(b?.text.trim()||'');

// Keep semantic units and their disjoint source boxes; never use a page-wide enclosing rectangle.
export function doclingUnits(result){
  const units=result.blocks.map(b=>({...b,sourceRefs:b.sourceRef?[b.sourceRef]:[],boxes:b.boxes.map(x=>({...x})),heading:headings.has(b.kind),artifact:furniture.has(b.kind)||/^key\s*words\s*:/i.test(b.text)}));
  const abstractIndex=units.findIndex(b=>b.heading&&/^(abstract|摘要)\s*$/i.test(b.text));
  if(abstractIndex>=0)for(let i=0;i<abstractIndex;i++)if(units[i].boxes[0]?.page===units[abstractIndex].boxes[0]?.page&&!['formula','table','caption'].includes(units[i].kind))units[i].artifact=true;
  const out=[];
  for(let i=0;i<units.length;i++){
    let unit=units[i];
    if(math(unit)){
      const prev=out.at(-1);
      if(prev&&!prev.heading&&!prev.artifact&&prev.kind==='text'&&/:\s*$/.test(prev.text)&&prev.boxes.at(-1).page===unit.boxes[0].page){out.pop();unit={...unit,text:prev.text+'\n\n'+unit.text,boxes:[...prev.boxes,...unit.boxes],sourceRefs:[...prev.sourceRefs,...unit.sourceRefs]};}
      while(math(units[i+1])){const next=units[++i];unit.text+='\n\n'+next.text;unit.boxes.push(...next.boxes);unit.sourceRefs.push(...next.sourceRefs);}
      if(definition(units[i+1])){const next=units[++i];unit.text+='\n\n'+next.text;unit.boxes.push(...next.boxes);unit.sourceRefs.push(...next.sourceRefs);}
    }
    if(unit.kind==='table'){
      const prev=out.at(-1);
      if(prev?.kind==='caption'&&prev.boxes.at(-1).page===unit.boxes[0].page){out.pop();if(!unit.text.includes(prev.text))unit.text=prev.text+'\n\n'+unit.text;unit.boxes.unshift(...prev.boxes);unit.sourceRefs.unshift(...prev.sourceRefs);}
      if(units[i+1]?.kind==='caption'&&/^table\b|^表/i.test(units[i+1].text)){const next=units[++i];if(!unit.text.includes(next.text))unit.text+='\n\n'+next.text;unit.boxes.push(...next.boxes);unit.sourceRefs.push(...next.sourceRefs);}
    }
    out.push(unit);
  }
  return out;
}

export function runBoxes(content,viewport){
  let index=0;const runs=[];
  for(const item of content.items){if(item.str===undefined)continue;const itemIndex=index++;if(!item.str.trim())continue;
    const a=viewport.transform,b=item.transform,t=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
    const h=Math.hypot(t[2],t[3])||10,y=t[5]-h*(content.styles?.[item.fontName]?.ascent||.8);
    runs.push({itemIndex,text:item.str,x:t[4],y,right:t[4]+Math.abs(item.width*(viewport.scale||1)),bottom:y+h});
  }return runs;
}
export function mapDoclingPage(units,content,viewport,page){
  const runs=runBoxes(content,viewport);
  const blocks=units.flatMap((unit,index)=>{
    const boxes=unit.boxes.filter(b=>b.page===page).map(b=>({x:b.x*viewport.width/b.pageWidth,y:b.y*viewport.height/b.pageHeight,right:b.right*viewport.width/b.pageWidth,bottom:b.bottom*viewport.height/b.pageHeight}));
    if(!boxes.length)return [];
    const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.right)),bottom=Math.max(...boxes.map(b=>b.bottom));
    return[{id:`p${page}d${index+1}`,page,text:unit.text,kind:unit.kind,sourceRef:unit.sourceRef,sourceRefs:unit.sourceRefs,heading:unit.heading,artifact:unit.artifact,continuation:unit.boxes[0].page!==page,x,y,right,bottom,height:bottom-y,boxes,itemIndices:[],lines:[],column:0}];
  });
  for(const run of runs){
    const cx=(run.x+run.right)/2,cy=(run.y+run.bottom)/2;
    const owners=blocks.filter(b=>b.boxes.some(box=>cx>=box.x-2&&cx<=box.right+2&&cy>=box.y-3&&cy<=box.bottom+3));
    // Smallest matching region wins, preventing neighbouring prose from taking table cells.
    owners.sort((a,b)=>a.boxes.reduce((n,x)=>n+(x.right-x.x)*(x.bottom-x.y),0)-b.boxes.reduce((n,x)=>n+(x.right-x.x)*(x.bottom-x.y),0));
    if(owners[0]){owners[0].itemIndices.push(run.itemIndex);owners[0].lines.push({...run});}
  }
  const body=blocks.filter(b=>!b.heading&&!b.artifact&&b.kind==='text'&&b.text.length>100&&b.right-b.x<viewport.width*.52);
  if(body.filter(b=>b.x<viewport.width*.35).length>=2&&body.filter(b=>b.x>viewport.width*.45).length>=2)for(const b of blocks)b.column=b.x>viewport.width*.45?1:0;
  for(const b of blocks){const input=JSON.stringify([b.id,b.text,b.sourceRef,b.itemIndices,b.boxes]);let hash=2166136261;for(const char of input){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}b.id+='s'+(hash>>>0).toString(16);}
  return blocks;
}
export function migrateDocling(doc,parsed){
  const corrected=reconcileStructure(doc,parsed);if(corrected)return corrected;
  const legacy=new Map([...(doc.legacyBlocks||[]),...doc.blocks].map(b=>[b.id,b]));
  const old=(doc.cards||[]).map(c=>({...c,sourceText:doc.blocks.find(b=>b.id===c.blockId)?.text||c.sourceText||'',legacy:true,sourceSnapshot:structuredClone(doc.blocks.find(b=>b.id===c.blockId)||c.sourceSnapshot)}));
  return{...doc,blocks:parsed.blocks,outline:parsed.outline,pages:parsed.pages,parser:'docling',doclingLayoutVersion:DOCLING_LAYOUT_VERSION,legacyBlocks:[...legacy.values()],archivedCards:[...(doc.archivedCards||[]),...old],cards:[]};
}
