import en from './locales/en.mjs';
export const UI_LANGUAGE_KEY='paper-space-ui-language';
export function normalizeUILanguage(value){return value==='en'?'en':'zh-CN';}
export function loadUILanguage(storage){try{return normalizeUILanguage(storage?.getItem(UI_LANGUAGE_KEY));}catch{return'zh-CN';}}
function storage(){try{return globalThis.localStorage;}catch{return null;}}
export function getUILanguage(){return loadUILanguage(storage());}
export function formatUI(key,language,...values){const text=language==='en'?(en[key]??key):key;return String(text).replace(/\{(\d+)\}/g,(_,index)=>String(values[Number(index)]??''));}
export function uiText(key,...values){return formatUI(key,getUILanguage(),...values);}
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=Object.keys(en).filter(key=>/\{\d+\}/.test(key)&&/\p{Script=Han}/u.test(key)).map(key=>{
 const slots=[];let last=0,pattern='';for(const match of key.matchAll(/\{(\d+)\}/g)){pattern+=escape(key.slice(last,match.index))+'([\\s\\S]*?)';slots.push(Number(match[1]));last=match.index+match[0].length;}pattern+=escape(key.slice(last));return{key,slots,regex:new RegExp('^'+pattern+'$')};
}).sort((a,b)=>b.key.replace(/\{\d+\}/g,'').length-a.key.replace(/\{\d+\}/g,'').length);
export function uiError(value,language=getUILanguage()){const text=String(value??'');if(language!=='en')return text;if(Object.hasOwn(en,text))return en[text];for(const {key,slots,regex} of patterns){const match=text.match(regex);if(match){const args=[];slots.forEach((slot,index)=>{args[slot]=match[index+1];});return formatUI(key,language,...args);}}return text;}
// Only call this for application-owned static markup, before adding document data.
export function localizeStaticUI(root){if(getUILanguage()!=='en')return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){
 if(node.parentElement?.closest('script,style'))continue;const text=node.textContent,key=text.trim();if(Object.hasOwn(en,key))node.textContent=text.replace(key,en[key]);
 }for(const node of root.querySelectorAll('[title],[placeholder],[aria-label],[alt]'))for(const name of ['title','placeholder','aria-label','alt']){const key=node.getAttribute(name);if(key&&Object.hasOwn(en,key))node.setAttribute(name,en[key]);}}
export function uiHTML(markup){const template=document.createElement('template');template.innerHTML=markup;localizeStaticUI(template.content);return template.innerHTML;}
export function uiDateLocale(){return getUILanguage()==='en'?'en-US':'zh-CN';}
let initialized=false;
export function initUILanguage(){if(initialized||typeof document==='undefined')return;initialized=true;document.documentElement.lang=getUILanguage();document.title=uiText('纸间 · Paper Space');localizeStaticUI(document.body);globalThis.paperDesktop?.setUILanguage?.(getUILanguage())?.catch(()=>{});}
export async function changeUILanguage(value,prepare){const language=normalizeUILanguage(value);if(language===getUILanguage())return true;
 if(prepare&&await prepare()===false)return false;const store=storage();try{store.setItem(UI_LANGUAGE_KEY,language);if(store.getItem(UI_LANGUAGE_KEY)!==language)throw Error();}catch{throw Error(uiText('界面语言未能保存，请检查本机存储。'));}
 try{await globalThis.paperDesktop?.setUILanguage?.(language);}catch{}
 location.reload();return true;
}
export function createUILanguageSelect({id,onChange}={}){const select=document.createElement('select');if(id)select.id=id;select.setAttribute('aria-label','Interface language / 界面语言');for(const [value,label]of [['zh-CN','中文（简体）'],['en','English']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=getUILanguage();select.onchange=async()=>{try{if(await changeUILanguage(select.value,onChange)===false)select.value=getUILanguage();}catch(error){select.value=getUILanguage();const message=document.createElement('p');message.setAttribute('role','alert');message.textContent=error.message;select.after(message);}};return select;}
