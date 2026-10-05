import {chaptersFor,chapterTree,chapterAncestors} from './chapter-navigation.mjs';
const normalized=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
export function chapterIdentity(item){return JSON.stringify([item.page,item.depth||0,normalized(item.title),Number.isFinite(item.y)?Math.round(item.y*100)/100:null]);}
export function chapterSnapshot(doc,item){const path=chapterAncestors(chapterTree(chaptersFor(doc)),item.key).map(x=>x.title);return {id:chapterIdentity(item),title:item.title,page:item.page,depth:item.depth||0,y:item.y,blockId:item.blockId,path};}
export function resolveChapter(doc,snapshot){if(!snapshot)return null;return chaptersFor(doc).find(c=>chapterIdentity(c)===snapshot.id)||null;}
// Existing page-only notes remain unassigned when their exact section is unknown.
export function chapterForAnchor(doc,anchor){
  if(!anchor)return null;if(anchor.chapter)return resolveChapter(doc,anchor.chapter);
  const items=chaptersFor(doc),blocks=doc.blocks||[];const block=blocks.find(b=>b.id===(anchor.blockId||anchor.id)&&b.page===anchor.page);
  const ys=[anchor.y,...(anchor.boxes||[]).map(b=>b.y),block?.y].filter(Number.isFinite);let y=ys.length?Math.min(...ys):null;
  if(y===null&&anchor.itemIndices?.length){const matching=blocks.filter(b=>b.page===anchor.page&&b.itemIndices?.some(i=>anchor.itemIndices.includes(i)));if(matching.length===1&&Number.isFinite(matching[0].y))y=matching[0].y;}
  const index=block?blocks.indexOf(block):-1;
  if(y===null&&index<0)return null;
  let found=null;for(const c of items){if(c.page<anchor.page)found=c;else if(c.page===anchor.page){const ci=blocks.findIndex(b=>b.id===c.blockId);if(y!==null&&Number.isFinite(c.y)&&c.y<=y+1||index>=0&&ci>=0&&ci<=index)found=c;}}return found;
}
export function notesForChapter(doc,item,{deleted=false}={}){const id=chapterIdentity(item);return (doc.personalNotes||[]).filter(n=>!!n.deletedAt===deleted&&((n.anchor?.chapter?.id===id)||(!n.anchor?.chapter&&chapterIdentityOrNull(chapterForAnchor(doc,n.anchor))===id)));}
function chapterIdentityOrNull(item){return item?chapterIdentity(item):null;}
export function chapterNoteAnchor(doc,item){return {kind:'chapter-note',page:item.page,fileFingerprint:doc.fileFingerprint,chapter:chapterSnapshot(doc,item)};}
export function anchorWithChapter(doc,anchor){const copy=structuredClone(anchor);if(!copy.chapter){const c=chapterForAnchor(doc,copy);if(c)copy.chapter=chapterSnapshot(doc,c);}return copy;}
