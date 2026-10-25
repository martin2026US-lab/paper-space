import {QUALITY_KEY,loadQualitySettings} from './translation-quality.mjs';
import {RECOGNITION_KEY,loadRecognitionSettings} from './recognition-config.mjs';
import {normalizePdfZoom} from './pdf-view.mjs';
import {restoreProfiles,persistedProfiles} from './models.mjs';
import {loadTranslationSettings} from './translation-config.mjs';
const encoder=new TextEncoder();
const sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const maxBytes=2_000_000_000,maxRecord=100_000_000;
const preferenceKeys=['paper-space-output-language','paper-space-ui-language','paper-space-layout','paper-space-reading-style','paper-space-magazine-layout','paper-space-pdf-view',QUALITY_KEY,RECOGNITION_KEY];
function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
export function encodeBackupValue(value){
 if(value instanceof ArrayBuffer)return{$paperBinary:'ArrayBuffer',data:base64(new Uint8Array(value))};
 if(ArrayBuffer.isView(value))return{$paperBinary:value.constructor.name,data:base64(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
 if(Array.isArray(value))return value.map(encodeBackupValue);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encodeBackupValue(v)]));
 return value;
}
const typed={Uint8Array,Uint8ClampedArray,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,DataView};
export function decodeBackupValue(value,depth=0){
 if(depth>60)throw Error('备份内容嵌套过深。');
 if(!value||typeof value!=='object')return value;
 if(value.$paperBinary){if(typeof value.data!=='string'||(value.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value.data)))throw Error('备份二进制数据无效。');const data=Uint8Array.from(atob(value.data),c=>c.charCodeAt(0));if(value.$paperBinary==='ArrayBuffer')return data.buffer;const Type=Object.hasOwn(typed,value.$paperBinary)?typed[value.$paperBinary]:null;if(!Type)throw Error('备份二进制类型无效。');return new Type(data.buffer);}
 if(Array.isArray(value))return value.map(v=>decodeBackupValue(v,depth+1));
 for(const key of Object.keys(value))if(['__proto__','constructor','prototype'].includes(key))throw Error('备份包含无效字段。');
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decodeBackupValue(v,depth+1)]));
}
export function backupSettings(storage){
 const settings={};for(const key of preferenceKeys){const value=storage.getItem(key);if(value===null)continue;if(key===QUALITY_KEY){settings[key]=JSON.stringify(loadQualitySettings(storage));}else if(key===RECOGNITION_KEY){settings[key]=JSON.stringify(loadRecognitionSettings(storage));}else if(key==='paper-space-pdf-view'){settings[key]=normalizePdfZoom(value);}else if(key==='paper-space-reading-style'){if(['classic','magazine'].includes(value))settings[key]=value;}else if(key==='paper-space-layout'||key==='paper-space-magazine-layout'){const layout=JSON.parse(value);settings[key]=JSON.stringify({focus:layout.focus===true,assistant:key==='paper-space-magazine-layout'?layout.assistant===true:layout.assistant!==false});}else if(key==='paper-space-ui-language'){if(['en','zh-CN'].includes(value))settings[key]=value;}else if(['zh-CN','zh-TW','en','ja','ko','fr','de','es','pt','ru','ar','it'].includes(value))settings[key]=value;}
 const models=storage.getItem('paper-space-models');if(models){const clean=restoreProfiles(JSON.parse(models));settings['paper-space-models']=JSON.stringify(persistedProfiles(clean.profiles,clean.activeId));}
 if(storage.getItem('paper-space-translation'))settings['paper-space-translation']=JSON.stringify(loadTranslationSettings(storage));
 return settings;
}
export async function createBackup(documents,storage,{onProgress=()=>{},appVersion='1.3.5'}={}){
 if(documents.length>10000)throw Error('备份文献数量过多。');
 const header=JSON.stringify({kind:'paper-space-backup',version:1,appVersion,createdAt:new Date().toISOString(),settings:backupSettings(storage)}),digests=[];
 async function* records(){yield header+'\n';for(const [i,doc]of documents.entries()){const data=encodeBackupValue(doc),text=JSON.stringify(data);if(text.length>maxRecord)throw Error('单篇文献超过备份大小限制。');const hash=await sha(text);digests.push(hash);yield JSON.stringify({kind:'document',sha256:hash,data})+'\n';onProgress(i+1,documents.length);}yield JSON.stringify({kind:'end',documents:documents.length,sha256:await sha(header+'\n'+digests.join('\n'))})+'\n';}
 let bytes=0;const iterator=records(),stream=new ReadableStream({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else{const chunk=encoder.encode(next.value);bytes+=chunk.byteLength;if(bytes>maxBytes)throw Error('备份解压后过大。');controller.enqueue(chunk);}}catch(e){controller.error(e);}}});
 return new Response(stream.pipeThrough(new CompressionStream('gzip'))).blob();
}
export function validateBackupDocument(doc){
 const fail=()=>{throw Error('备份文献结构无效。');};
 if(!doc||typeof doc.id!=='string'||!doc.id||doc.id.length>300||typeof doc.name!=='string'||!['pdf','docx','txt','md'].includes(doc.type)||!Number.isInteger(doc.pages)||doc.pages<1||doc.pages>100000||!Array.isArray(doc.blocks))fail();
 const page=n=>Number.isInteger(n)&&n>0&&n<=doc.pages,ids=new Set();
 for(const block of doc.blocks){if(!block||typeof block.id!=='string'||ids.has(block.id)||typeof block.text!=='string'||!page(block.page))fail();ids.add(block.id);if(block.table&&(!Array.isArray(block.table.rows)||block.table.rows.some(row=>!Array.isArray(row.cells)||row.cells.some(cell=>typeof cell.text!=='string'))))fail();}
 for(const key of ['cards','archivedCards'])if(doc[key]&&(!Array.isArray(doc[key])||doc[key].some(c=>typeof c.title!=='string'||typeof c.explanation!=='string'||!page(c.page))))fail();
 if(doc.summary!==undefined&&typeof doc.summary!=='string')fail();
 const history=rows=>Array.isArray(rows)&&rows.every(m=>m&&['user','assistant'].includes(m.role)&&typeof m.text==='string');if(doc.history&&!history(doc.history))fail();
 if(doc.conversations&&(!Array.isArray(doc.conversations)||doc.conversations.some(c=>typeof c.id!=='string'||typeof c.name!=='string'||!history(c.history))))fail();
 if(doc.personalNotes&&(!Array.isArray(doc.personalNotes)||doc.personalNotes.some(n=>typeof n.id!=='string'||typeof n.text!=='string'||!n.anchor||!page(n.anchor.page))))fail();
 if(doc.outline&&(!Array.isArray(doc.outline)||doc.outline.some(o=>typeof o.title!=='string'||!page(o.page))))fail();
 if(doc.translations&&(typeof doc.translations!=='object'||Object.values(doc.translations).some(v=>typeof v!=='string')))fail();
 if(['pdf','docx'].includes(doc.type)&&!(doc.bytes instanceof ArrayBuffer))throw Error('备份缺少原文件。');return doc;
}
export async function readBackup(blob,{onProgress=()=>{}}={}){
 const decoder=new TextDecoder();if(blob.size>maxBytes)throw Error('备份文件过大。');let pending='',total=0,header,headerText,ended=false;const docs=[],digests=[],ids=new Set();
 async function line(text){if(!text)return;if(ended)throw Error('备份结束后仍有额外数据。');if(text.length>maxRecord+1000)throw Error('备份单条记录过大。');let record;try{record=JSON.parse(text);}catch{throw Error('备份文件格式无效。');}
  if(!header){if(record.kind!=='paper-space-backup'||record.version!==1)throw Error('不支持此备份版本。');header=record;headerText=text;return;}
  if(record.kind==='end'){if(record.documents!==docs.length||record.sha256!==await sha(headerText+'\n'+digests.join('\n')))throw Error('备份完整性校验失败。');ended=true;return;}
  if(record.kind!=='document'||record.sha256!==await sha(JSON.stringify(record.data)))throw Error('备份完整性校验失败。');
  const doc=validateBackupDocument(decodeBackupValue(record.data));if(ids.has(doc.id))throw Error('备份文献标识重复。');
  if(['pdf','docx'].includes(doc.type)&&!(doc.bytes instanceof ArrayBuffer))throw Error('备份缺少原文件。');ids.add(doc.id);docs.push(doc);digests.push(record.sha256);if(docs.length>10000)throw Error('备份文献数量过多。');onProgress(docs.length);
 }
 try{const reader=blob.stream().pipeThrough(new DecompressionStream('gzip')).getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes)throw Error('备份解压后过大。');pending+=decoder.decode(value,{stream:true});let at;while((at=pending.indexOf('\n'))>=0){const text=pending.slice(0,at);pending=pending.slice(at+1);await line(text);}if(pending.length>maxRecord+1000)throw Error('备份单条记录过大。');}pending+=decoder.decode();if(pending)await line(pending);}finally{await reader.cancel().catch(()=>{});}}catch(error){throw Error(error.message||'无法读取备份。');}
 if(!header||!ended)throw Error('备份文件不完整。');
 const settings=backupSettings({getItem:key=>typeof header.settings?.[key]==='string'?header.settings[key]:null});return{documents:docs,settings,createdAt:header.createdAt,appVersion:header.appVersion};
}
export function planRestore(backup,existing,{randomId=()=>crypto.randomUUID(),copyLabel='backup copy'}={}){
 const ids=new Set(existing.map(d=>d.id));let copies=0;
 const documents=backup.documents.map(input=>{const doc=structuredClone(input);if(ids.has(doc.id)){const previous=doc.id;doc.id=randomId();if(ids.has(doc.id))throw Error('恢复副本标识冲突。');copies++;doc.name=doc.name.replace(/(\.[^.]+)?$/,suffix=>' ('+copyLabel+')'+suffix);const visit=value=>{if(!value||typeof value!=='object'||value instanceof ArrayBuffer||ArrayBuffer.isView(value))return;for(const [key,child]of Object.entries(value)){if(key==='docId'&&child===previous)value[key]=doc.id;else visit(child);}};visit(doc);}ids.add(doc.id);doc.chatUpdatedAt=Math.max(Date.now(),(doc.chatUpdatedAt||0)+1);return doc;});
 return{documents,copies};
}
export function mergeBackupSettings(storage,incoming){
 const changes={};const saved=restoreProfiles(JSON.parse(storage.getItem('paper-space-models')||'{}')),other=restoreProfiles(JSON.parse(incoming['paper-space-models']||'{}'));
 const merged=structuredClone(saved.profiles),ids=new Set(merged.map(p=>p.id));for(const p of other.profiles){const match=merged.find(x=>x.baseUrl===p.baseUrl&&x.format===p.format&&x.model===p.model);if(match){for(const model of p.models)if(!match.models.some(m=>m.id===model.id))match.models.push(model);continue;}if(ids.has(p.id))p.id=crypto.randomUUID();ids.add(p.id);merged.push(p);}if(merged.length)changes['paper-space-models']=JSON.stringify(persistedProfiles(merged,saved.activeId||other.activeId));
 for(const key of [...preferenceKeys,'paper-space-translation'])if(incoming[key]&&!storage.getItem(key))changes[key]=incoming[key];return changes;
}
