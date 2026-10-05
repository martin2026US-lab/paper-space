import {readFileSync,writeFileSync,renameSync,mkdirSync,unlinkSync} from 'node:fs';
import {dirname} from 'node:path';
export function identity(input){
  if(!input||typeof input.id!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(input.id))throw new Error('无效接口标识');
  const url=new URL(input.baseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('无效接口地址');
  if(!['openai','anthropic'].includes(input.format))throw new Error('无效接口格式');
  return{id:input.id,binding:JSON.stringify([url.href,input.format])};
}
export function trustedSender(event,window,origin){return!!window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame?.url===origin+'/';}
export function createKeyStore(file,crypto){
  let records={};try{const data=JSON.parse(readFileSync(file,'utf8'));if(data&&typeof data==='object'&&!Array.isArray(data))records=data;}catch{}
  function persist(next){mkdirSync(dirname(file),{recursive:true});const tmp=file+'.tmp';try{writeFileSync(tmp,JSON.stringify(next),{mode:0o600});renameSync(tmp,file);records=next;}catch(e){try{unlinkSync(tmp);}catch{}throw new Error('无法写入加密密钥；本次仅使用会话密钥。');}}
  return{
    status:()=>({available:crypto.isEncryptionAvailable()}),
    get(input){const {id,binding}=identity(input);const item=records[id];if(!item||item.binding!==binding)return{key:'',saved:false};if(!crypto.isEncryptionAvailable())throw new Error('系统加密不可用，请重新输入会话密钥。');try{return{key:crypto.decryptString(Buffer.from(item.cipher,'base64')),saved:true};}catch{throw new Error('已保存密钥无法解密，请重新输入。');}},
    set(input){const {id,binding}=identity(input);if(typeof input.key!=='string'||input.key.length>8192)throw new Error('无效密钥');if(!crypto.isEncryptionAvailable())throw new Error('系统加密不可用；本次仅使用会话密钥。');if(!input.key)return this.clear(input);persist({...records,[id]:{binding,cipher:crypto.encryptString(input.key).toString('base64')}});return{saved:true};},
    clear(input){const {id}=identity(input);const next={...records};delete next[id];persist(next);return{saved:false};}
  };
}
