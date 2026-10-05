import {mkdir,readFile,writeFile,rename,unlink,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

// Only conversation snapshots enter this store. No document bytes or credentials.
function evidence(x,depth=0){
  const out={id:String(x.id||''),label:String(x.label||''),text:String(x.text||'')};
  for(const key of ['blockId','kind','sourceRef','fileFingerprint'])if(typeof x[key]==='string')out[key]=x[key];
  for(const key of ['page','endPage','x','y','right','bottom','height'])if(Number.isFinite(x[key]))out[key]=x[key];
  for(const key of ['itemIndices'])if(Array.isArray(x[key]))out[key]=x[key].filter(Number.isInteger);
  for(const key of ['boxes','lines'])if(Array.isArray(x[key]))out[key]=x[key].map(b=>Object.fromEntries(['x','y','right','bottom','itemIndex','start','end'].filter(k=>Number.isFinite(b[k])).map(k=>[k,b[k]])));
  for(const key of ['sourceIds','sourceRefs'])if(Array.isArray(x[key]))out[key]=x[key].filter(s=>typeof s==='string');
  if(depth<2){if(Array.isArray(x.sourceSegments))out.sourceSegments=x.sourceSegments.slice(0,100).map(s=>evidence(s,depth+1));if(x.sourceSnapshot&&typeof x.sourceSnapshot==='object')out.sourceSnapshot=evidence(x.sourceSnapshot,depth+1);}
  return out;
}
function messages(history){
  if(!Array.isArray(history))throw Error('无效会话历史');
  return history.map(m=>{if(!['user','assistant'].includes(m.role))throw Error('无效对话角色');return {role:m.role,text:String(m.text||''),...(m.model?{model:String(m.model)}:{}),...(m.demo?{demo:true}:{}),...(m.error?{error:true}:{}),...(Array.isArray(m.materials)?{materials:m.materials.map(m=>evidence(m))}:{})};});
}
export function chatSnapshot(doc){
  if(!doc||typeof doc.id!=='string'||doc.id.length>300)throw Error('无效对话记录');
  const incoming=Array.isArray(doc.conversations)?doc.conversations:[{id:'legacy-'+doc.id,name:'历史对话',history:doc.history,updatedAt:doc.chatUpdatedAt||doc.savedAt||0}];
  if(!incoming.length)throw Error('缺少会话');
  const conversations=incoming.map(c=>{if(typeof c.id!=='string'||c.id.length>500)throw Error('无效会话 ID');return{id:c.id,name:String(c.name||'新对话').slice(0,100),history:messages(c.history),createdAt:Number(c.createdAt)||0,updatedAt:Number(c.updatedAt)||0,deletedAt:Number(c.deletedAt)||null};});
  if(new Set(conversations.map(c=>c.id)).size!==conversations.length)throw Error('重复会话 ID');
  const active=conversations.find(c=>c.id===doc.activeConversationId&&!c.deletedAt)||conversations.find(c=>!c.deletedAt);
  const value={version:2,conversationVersion:1,id:doc.id,name:String(doc.name||''),conversations,activeConversationId:active?.id||null,history:active?.history||[],deletedAt:doc.deletedAt||null,savedAt:Number(doc.chatUpdatedAt||doc.savedAt)||Date.now(),updatedAt:new Date().toISOString()};
  if(JSON.stringify(value).length>20_000_000)throw Error('对话记录过大，请先导出笔记');
  return value;
}
export function createChatStore(dataRoot){
  const settings=join(dataRoot,'chat-location.json');let folder=join(dataRoot,'conversations'),ready=false,queue=Promise.resolve();
  const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
  async function init(){if(ready)return;try{const s=JSON.parse(await readFile(settings,'utf8'));if(typeof s.folder==='string'&&s.folder===resolve(s.folder))folder=s.folder;}catch{}ready=true;}
  const file=(dir,id)=>join(dir,createHash('sha256').update(id).digest('hex')+'.json');
  async function atomic(path,value){await mkdir(folder,{recursive:true});const tmp=path+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,JSON.stringify(value,null,2),{flag:'wx'});await rename(tmp,path);}finally{await unlink(tmp).catch(()=>{});}}
  async function write(dir,doc){const value=chatSnapshot(doc),path=file(dir,value.id);await mkdir(dir,{recursive:true});try{if((await lstat(path)).isSymbolicLink())throw Error('对话文件不能是链接');}catch(e){if(e.code!=='ENOENT')throw e;}await atomic(path,value);}
  return{
    status:()=>serial(async()=>{await init();return{folder};}),
    save:doc=>serial(async()=>{await init();await write(folder,doc);return{folder};}),
    read:id=>serial(async()=>{await init();try{const value=JSON.parse(await readFile(file(folder,id),'utf8'));if(value.id!==id)return{};const snapshot=chatSnapshot(value);return value.version===2?{...snapshot,savedAt:value.savedAt||0}:{version:1,history:snapshot.history,savedAt:value.savedAt||0};}catch(e){if(e.code==='ENOENT')return{};throw Error('对话文件无法读取，阅读器中的记录仍保留');}}),
    remove:ids=>serial(async()=>{await init();for(const id of ids){if(typeof id!=='string')throw Error('无效文献 ID');await unlink(file(folder,id)).catch(e=>{if(e.code!=='ENOENT')throw e;});}}),
    choose:(parent,docs)=>serial(async()=>{await init();const target=join(resolve(parent),'PaperSpace-Chats');await mkdir(target,{recursive:true});for(const doc of docs)await write(target,doc);await atomic(settings,{version:1,folder:target});folder=target;return{folder};}),
  };
}
