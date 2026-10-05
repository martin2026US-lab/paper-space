export function personalNotes(doc,{deleted=false}={}){return (doc.personalNotes||[]).filter(n=>!!n.deletedAt===deleted).sort((a,b)=>b.updatedAt-a.updatedAt);}
export function savePersonalNote(doc,{id,text,anchor}){
  text=String(text||'').trim();if(!text)throw Error('请填写批注内容。');if(text.length>20000)throw Error('每条批注最多 20,000 字符。');
  doc.personalNotes||=[];let note=doc.personalNotes.find(n=>n.id===id);
  if(note){note.text=text;note.updatedAt=Date.now();}else{if(!anchor||!Number.isInteger(anchor.page)||anchor.page<1||anchor.page>doc.pages)throw Error('批注来源页无效。');note={id:crypto.randomUUID(),text,anchor:structuredClone(anchor),createdAt:Date.now(),updatedAt:Date.now()};doc.personalNotes.push(note);}return note;
}
export function setNoteDeleted(doc,id,deleted){const n=doc.personalNotes?.find(n=>n.id===id);if(n){n.deletedAt=deleted?Date.now():null;n.updatedAt=Date.now();}}
export function exportPersonalNotes(doc){return (doc.personalNotes||[]).map(n=>'### '+(n.anchor.chapter?.title?n.anchor.chapter.title+' · ':'')+'第 '+n.anchor.page+' 页'+(n.deletedAt?' · 已删除（可恢复）':'')+'\n'+new Date(n.updatedAt).toLocaleString()+'\n\n'+n.text+'\n\n原文：'+(n.anchor.text||(n.anchor.chapter?'章节批注':'整页批注'))).join('\n\n');}
