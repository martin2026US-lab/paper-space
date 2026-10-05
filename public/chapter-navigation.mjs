const normalized=s=>String(s||'').normalize('NFKC').replace(/^\s*(?:\d+(?:\.\d+)*\.?\s+|#{1,6}\s*)/,'').replace(/\s+/g,' ').trim().toLowerCase();
export function chaptersFor(doc){
  const blocks=doc?.blocks||[],raw=doc?.outline?.length?doc.outline:blocks.filter(b=>b.heading).map(b=>({title:b.text,page:b.page,blockId:b.id,y:b.y,depth:Math.max(0,(b.headingLevel||1)-1)}));
  const numbered=raw.some(x=>/^\s*\d+\.\d+\s/.test(x.title));
  return raw.map((item,index)=>{const block=blocks.find(b=>b.id===item.blockId)||blocks.find(b=>b.page===item.page&&normalized(b.text)===normalized(item.title));const number=String(item.title).match(/^\s*(\d+(?:\.\d+)*)\.?\s+/);const blockNumber=String(block?.text||'').match(/^\s*(\d+(?:\.\d+)*)\.?\s+/);const part=number||blockNumber;
    const depth=block?.headingLevel?block.headingLevel-1:part&&(numbered||blockNumber)?part[1].split('.').length-1:Math.max(0,item.depth||0);
    return {...item,index,key:String(index)+':'+item.page+':'+item.title,title:String(item.title).replace(/^\s*(?:\d+(?:\.\d+)*\.?\s+|#{1,6}\s*)/,'').trim(),depth,blockId:block?.id||item.blockId,y:Number.isFinite(item.y)?item.y:block?.y};
  });
}
export function chapterTree(items){const roots=[],stack=[];for(const item of items){while(stack.length&&stack.at(-1).depth>=item.depth)stack.pop();const entry={...item,children:[],parent:stack.at(-1)?.key||null};if(stack.length)stack.at(-1).children.push(entry);else roots.push(entry);stack.push(entry);}return roots;}
export function chapterAncestors(tree,key){for(const entry of tree){if(entry.key===key)return [entry];const path=chapterAncestors(entry.children,key);if(path.length)return [entry,...path];}return [];}
export function stepChapter(index,delta,length){return length?Math.max(0,Math.min(length-1,index+Math.sign(delta))):0;}
// A newer user intent supersedes any unfinished render or destination adjustment.
export function navigationGate(){let revision=0;return {begin:()=>++revision,current:token=>token===revision,cancel:()=>++revision};}
