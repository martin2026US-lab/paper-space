import {prepareRecovery} from './pdf-recovery.mjs';
// Corrections are separate from the automatic parse and retain native PDF item membership.
const clone=value=>structuredClone(value);
const compact=text=>String(text).normalize('NFKC').replace(/\s/g,'');
export function sourceSignature(blocks){return JSON.stringify(blocks.map(b=>[b.page,b.text,b.kind,b.itemIndices,b.lines,b.boxes]));}
export function ensureStructure(doc){
  if(!doc.structure)doc.structure={version:1,fileFingerprint:doc.fileFingerprint||doc.id,autoBlocks:clone(doc.blocks),undo:[],operations:[],conflict:null};
  return doc.structure;
}
// Only expose boundaries with a lossless canonical-text to native-item alignment.
// Unalignable formula / table transcription remains one atomic range.
export function sourceAtoms(block){
  if(block.sourceParts?.length)return clone(block.sourceParts);
  const base={sourceId:block.id,sourceRef:block.sourceRef,sourceRefs:clone(block.sourceRefs||[]),page:block.page,kind:block.kind,fileFingerprint:block.fileFingerprint,sourceText:block.text};
  const whole=()=>[{...base,text:block.text,start:0,end:block.text.length,itemIndices:clone(block.itemIndices||[]),lines:clone(block.lines||[]),boxes:clone(block.boxes||[])}];
  if(['formula','table'].includes(block.kind)||!block.lines?.length||block.continuation)return whole();
  const lines=[...block.lines].sort((a,b)=>a.itemIndex-b.itemIndex);
  if(lines.some(l=>!Number.isInteger(l.itemIndex)||!l.text)||compact(lines.map(l=>l.text).join(''))!==compact(block.text))return whole();
  const groups=[];
  for(const line of lines){const g=groups.at(-1);if(g&&Math.abs(line.y-g[0].y)<Math.max(3,(g[0].bottom-g[0].y)*.6))g.push(line);else groups.push([line]);}
  // Map normalized character counts back to complete original Unicode codepoints.
  const offsets=[0];let pos=0,count=0;
  for(const char of block.text){pos+=char.length;count+=compact(char).length;offsets[count]=pos;}
  const atoms=[];let start=0,n=0;
  for(let i=0;i<groups.length;i++){
    const group=groups[i];n+=compact(group.map(l=>l.text).join('')).length;const end=i===groups.length-1?block.text.length:offsets[n];
    if(!Number.isInteger(end)||end<=start)return whole();
    atoms.push({...base,text:block.text.slice(start,end),start,end,itemIndices:group.map(l=>l.itemIndex),lines:clone(group),boxes:group.map(({x,y,right,bottom})=>({x,y,right,bottom}))});start=end;
  }
  return atoms.length?atoms:whole();
}
export function atomsText(atoms){return atoms.map((a,i)=>(i&&a.sourceId!==atoms[i-1].sourceId?'\n\n':'')+a.text).join('');}
function derivedBlock(template,atoms){
  if(!atoms.length)throw Error('解读范围不能为空');
  const boxes=atoms.flatMap(a=>a.boxes),lines=atoms.flatMap(a=>a.lines),itemIndices=[...new Set(atoms.flatMap(a=>a.itemIndices))];
  const geometry=lines.length?lines:boxes;const x=Math.min(...geometry.map(b=>b.x)),y=Math.min(...geometry.map(b=>b.y)),right=Math.max(...geometry.map(b=>b.right)),bottom=Math.max(...geometry.map(b=>b.bottom));
  return{...clone(template),id:'u'+globalThis.crypto.randomUUID().replaceAll('-',''),text:atomsText(atoms),sourceIds:[...new Set(atoms.map(a=>a.sourceId))],sourceRefs:[...new Set(atoms.flatMap(a=>a.sourceRefs||[]))],sourceParts:clone(atoms),itemIndices,boxes,lines,...(geometry.length?{x,y,right,bottom,height:bottom-y}:{}),manual:true};
}
export function archiveSources(doc,blocks){
  const registry=new Map((doc.legacyBlocks||[]).map(b=>[b.id,b]));for(const b of blocks)if(!registry.has(b.id))registry.set(b.id,{...clone(b),legacy:true});doc.legacyBlocks=[...registry.values()];
  const ids=new Set(blocks.map(b=>b.id));const old=(doc.cards||[]).filter(c=>ids.has(c.blockId)).map(c=>({...c,legacy:true,sourceText:c.sourceText||blocks.find(b=>b.id===c.blockId)?.text,sourceSnapshot:c.sourceSnapshot||clone(blocks.find(b=>b.id===c.blockId))}));
  doc.archivedCards=[...(doc.archivedCards||[]),...old];doc.cards=(doc.cards||[]).filter(c=>!ids.has(c.blockId));
}
function checkpoint(doc,label){const s=ensureStructure(doc);s.undo.push({label,blocks:clone(doc.blocks),autoBlocks:clone(s.autoBlocks),conflict:clone(s.conflict)});s.operations.push({id:globalThis.crypto.randomUUID(),label,at:Date.now()});}
function replace(doc,before,after,label){checkpoint(doc,label);archiveSources(doc,before);const at=doc.blocks.indexOf(before[0]);doc.blocks.splice(at,before.length,...after);}
export function mergeBlocks(doc,firstId,secondId){
  const at=doc.blocks.findIndex(b=>b.id===firstId),a=doc.blocks[at],b=doc.blocks[at+1];
  if(!a||b?.id!==secondId||a.page!==b.page||[a,b].some(x=>x.heading||x.artifact||x.continuation))throw Error('只支持同页相邻正文、公式或表格单元合并');
  const merged=derivedBlock(a,[...sourceAtoms(a),...sourceAtoms(b)]);replace(doc,[a,b],[merged],'合并相邻段落');return merged;
}
export function splitBlock(doc,id,boundary){
  const b=doc.blocks.find(b=>b.id===id);if(!b)throw Error('找不到原文单元');const atoms=sourceAtoms(b);
  if(!Number.isInteger(boundary)||boundary<=0||boundary>=atoms.length)throw Error('请选择可准确映射的拆分边界；公式和表格保持完整');
  const result=[derivedBlock(b,atoms.slice(0,boundary)),derivedBlock(b,atoms.slice(boundary))];replace(doc,[b],result,'按来源边界拆分');return result;
}
export function adjustRange(doc,id,start,end){
  const b=doc.blocks.find(b=>b.id===id);if(!b)throw Error('找不到原文单元');const atoms=sourceAtoms(b);
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>atoms.length||start>=end)throw Error('请选择完整且有效的解读范围');
  const groups=[atoms.slice(0,start),atoms.slice(start,end),atoms.slice(end)].filter(a=>a.length);
  if(groups.length===1)throw Error('范围未改变；可先合并相邻单元再调整');
  const result=groups.map(a=>derivedBlock(b,a));replace(doc,[b],result,'调整解读范围（范围外正文保留）');return result;
}
export function recoverParagraph(doc,source,indices){
  const proposal=prepareRecovery(doc,source,indices),{replacedIds,...native}=proposal;
  const old=doc.blocks.filter(b=>replacedIds.includes(b.id));
  const seed={...native,id:`native:${doc.fileFingerprint}:p${source.page}:${native.itemIndices.join(',')}`,fileFingerprint:doc.fileFingerprint,kind:'text',heading:false,artifact:false,continuation:false,recovered:true,recoveredFrom:replacedIds};
  const block=derivedBlock(seed,sourceAtoms(seed));
  // Keep the surrounding semantic reading order. Replaced hidden units retain their slot.
  let at=old.length?doc.blocks.indexOf(old[0]):doc.blocks.findIndex(b=>b.page>block.page||b.page===block.page&&((b.column??0)>block.column||(b.column??0)===block.column&&b.y>block.y));
  if(at<0)at=doc.blocks.length;
  checkpoint(doc,'补充漏识别段落');archiveSources(doc,old);
  doc.blocks.splice(at,0,block);doc.blocks=doc.blocks.filter(b=>!replacedIds.includes(b.id));
  return block;
}
export function undoStructure(doc){const s=ensureStructure(doc),prior=s.undo.pop();if(!prior)return false;archiveSources(doc,doc.blocks.filter(b=>!prior.blocks.some(p=>p.id===b.id)));doc.blocks=prior.blocks;s.autoBlocks=prior.autoBlocks;s.conflict=prior.conflict;s.operations.push({id:globalThis.crypto.randomUUID(),label:'撤销 '+prior.label,at:Date.now()});return true;}
export function restoreAutomatic(doc,{pending=false}={}){const s=ensureStructure(doc),blocks=pending?s.conflict?.autoBlocks:s.autoBlocks;if(!blocks)throw Error('没有可恢复的自动结果');checkpoint(doc,pending?'采用新识别结果':'恢复自动识别');archiveSources(doc,doc.blocks.filter(b=>!blocks.some(p=>p.id===b.id)));doc.blocks=clone(blocks);if(pending)s.autoBlocks=clone(blocks);s.conflict=null;}
export function reconcileStructure(doc,parsed){
  if(!doc.structure)return null;
  const s=clone(doc.structure);
  if(sourceSignature(s.autoBlocks)!==sourceSignature(parsed.blocks))s.conflict={at:Date.now(),message:'重新识别的文字或坐标与已保存校正不一致。当前继续使用已保存校正；可采用新结果，并用撤销恢复。',autoBlocks:clone(parsed.blocks)};
  return{...doc,structure:s,parser:parsed.parser,doclingLayoutVersion:parsed.doclingLayoutVersion};
}
