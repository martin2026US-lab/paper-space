// Destinations and coordinates refer to physical PDF pages, never section numbers.
export async function pdfNavigation(pdf,blocks=[]){
  let labels;try{labels=await pdf.getPageLabels();}catch{}
  const outline=[],pageCache=new Map();
  async function visit(items,depth=0){for(const item of items||[]){
    try{const dest=typeof item.dest==='string'?await pdf.getDestination(item.dest):item.dest;
      if(Array.isArray(dest)&&dest[0]!==null&&dest[0]!==undefined){const index=typeof dest[0]==='number'?dest[0]:await pdf.getPageIndex(dest[0]);
        if(Number.isInteger(index)&&index>=0&&index<pdf.numPages){
          const entry={title:item.title,page:index+1,depth};
          const top=dest[1]?.name==='XYZ'?dest[3]:['FitH','FitBH'].includes(dest[1]?.name)?dest[2]:null;
          if(Number.isFinite(top)&&pdf.getPage){try{if(!pageCache.has(index))pageCache.set(index,await pdf.getPage(index+1));const v=pageCache.get(index).getViewport({scale:1});entry.y=Math.max(0,v.convertToViewportPoint(0,top)[1]);}catch{}}
          outline.push(entry);
        }}
    }catch{}await visit(item.items,depth+1);
  }}
  try{await visit(await pdf.getOutline());}catch{}
  if(!outline.length)for(const b of blocks.filter(b=>b.heading).slice(0,200))outline.push({title:b.text,page:b.page,depth:0,y:b.y||0,blockId:b.id});
  return {pages:pdf.numPages,pageLabels:Array.isArray(labels)&&labels.length===pdf.numPages?labels:undefined,outline};
}
export function physicalPage(value,total){const n=Number(value);return Math.max(1,Math.min(Math.max(1,total),Number.isFinite(n)?Math.trunc(n):1));}
export function outlineRange(items,index,total){const start=items[index].page,depth=items[index].depth||0;const next=items.slice(index+1).find(x=>x.page>=start&&(x.depth||0)<=depth);return {start,end:Math.max(start,(next?.page||total+1)-1)};}
export function activeOutline(items,page,y=Infinity){let active=-1;for(let i=0;i<items.length;i++){const item=items[i];if(item.page<page||item.page===page&&(item.y||0)<=y){if(active<0||item.page>items[active].page||item.page===items[active].page&&(item.y||0)>=(items[active].y||0))active=i;}}return active;}
