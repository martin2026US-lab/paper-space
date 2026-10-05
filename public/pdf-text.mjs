export function bindPdfTextLayer(textLayer,blocks){
  textLayer.textDivs.forEach((span,index)=>{span.dataset.itemIndex=String(index);delete span.dataset.blockId;});
  for(const block of blocks)for(const index of block.itemIndices||[]){const span=textLayer.textDivs[index];if(span)span.dataset.blockId=block.id;}
}
export function selectedPdfItems(selection,page){
  if(!page||!selection?.rangeCount||selection.isCollapsed)return [];
  const range=selection.getRangeAt(0),result=[];
  for(const span of page.querySelectorAll('.textLayer span[data-item-index]')){
    if(span.children.length||!span.textContent.trim())continue;
    const itemRange=span.ownerDocument.createRange();itemRange.selectNodeContents(span);
    // Strict intersection excludes a neighbouring item touched only at its boundary.
    if(itemRange.compareBoundaryPoints(3,range)<0&&itemRange.compareBoundaryPoints(1,range)>0)result.push(Number(span.dataset.itemIndex));
  }
  return result;
}
export function pdfBlockSpans(page,block){
  if(!page||Number(page.dataset.page)!==block.page)return [];
  const spans=[...page.querySelectorAll('.textLayer span')].filter(s=>!s.children.length&&s.textContent.trim());
  if(block.itemIndices){const admitted=new Set(block.itemIndices);return spans.filter(s=>admitted.has(Number(s.dataset.itemIndex)));}
  const compact=t=>t.normalize('NFKC').replace(/\s/g,''),needle=compact(block.text);let combined='';
  const offsets=spans.map(el=>{const start=combined.length;combined+=compact(el.textContent);return{el,start,end:combined.length};}),at=needle?combined.indexOf(needle):-1;
  if(at>=0)return offsets.filter(s=>s.end>at&&s.start<at+needle.length).map(s=>s.el);
  // Old citations may have no text-item IDs. Stay inside their measured source extent.
  const r=page.getBoundingClientRect(),scale=Number(page.style.getPropertyValue('--scale-factor'))||1;
  const boxes=block.lines||[{x:block.x,y:block.y,right:block.right,bottom:block.bottom??block.y+block.height}];
  return spans.filter(span=>{const s=span.getBoundingClientRect(),x=(s.left-r.left)/scale,y=(s.top-r.top+s.height/2)/scale;return boxes.some(b=>b.y!==undefined&&y>=b.y-2&&y<=b.bottom+2&&x>=b.x-2&&x<=b.right+2);});
}
