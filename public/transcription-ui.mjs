import {uiText as t,uiError} from './ui-language.mjs';
import {transcriptionText} from './transcription.mjs';
const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=t(text);return n;};
export function openTranscription({unit,crops,extract,save,onSaved,signal}){
 const dialog=node('dialog','transcription-dialog'),abort=new AbortController();let ended=false,saving=false;
 const title=node('h2','',unit.transcribed?'编辑文字':'提取文字');title.id='transcription-title';dialog.setAttribute('aria-labelledby',title.id);
 const description=node('p','transcription-description','按原文提取，可直接修改后采用。原图始终保留。');
 const body=node('div','transcription-body'),original=node('div','transcription-original'),field=node('label','transcription-field','阅读文字'),input=node('textarea','transcription-input');input.spellcheck=false;input.setAttribute('aria-label',t('阅读文字'));input.maxLength=60000;field.append(input);body.append(original,field);
 const status=node('p','transcription-status','仅发送这一段原图至当前阅读模型。');status.setAttribute('role','status');
 const footer=node('div','transcription-footer');
 const button=(label,cls,fn)=>{const b=node('button','button '+cls,label);b.type='button';b.onclick=fn;footer.append(b);return b;};
 const close=()=>{if(saving)return;ended=true;abort.abort();dialog.close();dialog.remove();signal?.removeEventListener('abort',close);};
 const cancel=button('取消','transcription-cancel',close);
 const retry=button('重新提取','transcription-retry',()=>run());
 const adopt=button('采用文字','primary transcription-adopt',async()=>{
  try{const text=transcriptionText(input.value);saving=true;adopt.disabled=retry.disabled=cancel.disabled=input.disabled=true;status.textContent=t('正在保存…');await save(text);saving=false;close();await onSaved();}
  catch(e){saving=false;if(!ended){status.textContent=uiError(e.message);adopt.disabled=retry.disabled=cancel.disabled=input.disabled=false;}}
 });
 dialog.append(title,description,body,status,footer);document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});signal?.addEventListener('abort',close,{once:true});dialog.showModal();
 let images;const load=async()=>{images=await crops(abort.signal);abort.signal.throwIfAborted();original.replaceChildren();for(const [i,url] of images.entries()){const img=node('img');img.src=url;img.alt=t('原图 {0}',i+1);original.append(img);}return images;};
 async function run(){
  retry.disabled=adopt.disabled=input.disabled=true;status.textContent=t('正在提取文字…');
  try{const data=images||await load();const text=transcriptionText(await extract(data,abort.signal));abort.signal.throwIfAborted();input.value=text;status.textContent=t('可以修改文字，然后采用。');}
  catch(e){if(!ended)status.textContent=uiError(e.message);}
  finally{if(!ended){retry.disabled=input.disabled=false;adopt.disabled=!input.value.trim();}}
 }
 input.oninput=()=>{adopt.disabled=!input.value.trim();};
 if(unit.transcribed){input.value=unit.text;void load().catch(e=>{if(!ended)status.textContent=uiError(e.message);});}else void run();
 return dialog;
}
