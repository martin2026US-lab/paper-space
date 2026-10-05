// Document-local sessions. history remains an alias for old readers, never the authority.
const id=()=>globalThis.crypto.randomUUID();
export function ensureConversations(doc){
  if(!Array.isArray(doc.conversations)||!doc.conversations.length){
    const history=Array.isArray(doc.history)?doc.history:[];
    doc.conversations=[{id:'legacy-'+doc.id,name:history.length?'历史对话':'新对话',history,createdAt:doc.chatUpdatedAt||0,updatedAt:doc.chatUpdatedAt||0}];
  }
  doc.conversationVersion=1;
  let current=doc.conversations.find(c=>c.id===doc.activeConversationId&&!c.deletedAt)||doc.conversations.find(c=>!c.deletedAt);
  if(!current){current={id:id(),name:'新对话',history:[],createdAt:Date.now(),updatedAt:Date.now()};doc.conversations.push(current);}
  doc.activeConversationId=current.id;doc.history=current.history;
  return current;
}
export function touchConversation(doc,conversation=ensureConversations(doc)){
  const now=Math.max(Date.now(),(doc.chatUpdatedAt||0)+1);doc.chatUpdatedAt=now;conversation.updatedAt=now;
}
export function newConversation(doc,name='新对话'){
  ensureConversations(doc);const c={id:id(),name:name.trim().slice(0,100)||'新对话',history:[],createdAt:Date.now(),updatedAt:Date.now()};
  doc.conversations.push(c);doc.activeConversationId=c.id;doc.history=c.history;touchConversation(doc,c);return c;
}
export function switchConversation(doc,id){
  const c=doc.conversations.find(c=>c.id===id&&!c.deletedAt);if(!c)throw Error('会话不存在或已删除');
  doc.activeConversationId=id;doc.history=c.history;touchConversation(doc,c);return c;
}
export function renameConversation(doc,id,name){const c=doc.conversations.find(c=>c.id===id);if(!c||!name.trim())throw Error('请输入会话名称');c.name=name.trim().slice(0,100);touchConversation(doc,c);}
export function deleteConversation(doc,id){const c=doc.conversations.find(c=>c.id===id);if(!c)return;c.deletedAt=Date.now();touchConversation(doc,c);ensureConversations(doc);}
export function restoreConversation(doc,id){const c=doc.conversations.find(c=>c.id===id);if(!c)return;delete c.deletedAt;touchConversation(doc,c);return switchConversation(doc,id);}
export function searchConversations(doc,query='',deleted=false){ensureConversations(doc);const q=query.trim().toLocaleLowerCase();return doc.conversations.filter(c=>!!c.deletedAt===deleted&&(!q||c.name.toLocaleLowerCase().includes(q)||c.history.some(m=>m.text.toLocaleLowerCase().includes(q)))).sort((a,b)=>b.updatedAt-a.updatedAt);}
export function conversationPayload(doc){ensureConversations(doc);return structuredClone({id:doc.id,name:doc.name,conversationVersion:1,conversations:doc.conversations,activeConversationId:doc.activeConversationId,history:doc.history,deletedAt:doc.deletedAt,chatUpdatedAt:doc.chatUpdatedAt});}
export function restoreConversationFile(doc,file){
  if(!file||!(file.savedAt>(doc.chatUpdatedAt||0)))return false;
  // A v1 backup cannot remove sessions created by v0.9, regardless of its write time.
  if(!Array.isArray(file.conversations)&&doc.conversations?.some(c=>c.id!=='legacy-'+doc.id))return false;
  if(Array.isArray(file.conversations)&&file.conversations.length){doc.conversations=structuredClone(file.conversations);doc.activeConversationId=file.activeConversationId;}
  else if(Array.isArray(file.history)){doc.conversations=[{id:'legacy-'+doc.id,name:'历史对话',history:structuredClone(file.history),createdAt:0,updatedAt:file.savedAt}];doc.activeConversationId='legacy-'+doc.id;}
  else return false;
  doc.chatUpdatedAt=file.savedAt;ensureConversations(doc);return true;
}
export function exportConversations(doc){
  ensureConversations(doc);return doc.conversations.map(c=>`### ${c.name}${c.deletedAt?'（已删除，可恢复）':''}\n会话 ID：${c.id}\n\n`+c.history.map(m=>`#### ${m.role==='user'?'你':'阅读助手'}${m.error?'（失败）':''}${m.demo?'（预置演示）':''}\n${m.text}\n`+(m.materials?.length?'\n材料原文与来源：\n'+m.materials.map(x=>`\n[${x.id}] ${x.label||''} · 第 ${x.page||'?'} 页 · 来源 ${x.blockId||x.id}\n\n${x.text}`).join('\n'):'')).join('\n\n')).join('\n\n');
}
