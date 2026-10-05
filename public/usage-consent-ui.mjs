import {CONSENT_VERSION,hasUsageConsent,saveUsageConsent,usageSections} from './usage-consent.mjs';

function localStore(){try{return window.localStorage;}catch{return null;}}
function element(tag,className,text){const el=document.createElement(tag);el.className=className;if(text)el.textContent=text;return el;}
let activeDialog;
function createUsageDialog({required=false}={}){
  if(activeDialog?.open)return activeDialog;
  let accepted=false;
  const dialog=element('dialog','usage-dialog');dialog.id='usageDialog';dialog.setAttribute('aria-labelledby','usageTitle');
  if(required)dialog.setAttribute('closedby','none');
  const intro=element('header','usage-heading');
  const icon=element('img','usage-logo');icon.src='/favicon.svg';icon.alt='';
  const heading=element('div','');heading.append(element('p','usage-eyebrow','PAPER SPACE · 使用前请阅读'),element('h2','','使用声明与隐私说明'));heading.lastChild.id='usageTitle';heading.lastChild.tabIndex=-1;heading.lastChild.setAttribute('autofocus','');
  intro.append(icon,heading);dialog.append(intro,element('p','usage-intro','让阅读安心开始，也让每一次数据发送由你决定。'));
  const content=element('div','usage-content');
  for(const [title,body] of usageSections){const section=element('section','usage-section');section.append(element('h3','',title),element('p','',body));content.append(section);}
  dialog.append(content);
  const footer=element('footer','usage-footer'),actions=element('div','usage-actions');
  if(required){
    const label=element('label','usage-check'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='usageAcknowledge';
    label.append(checkbox,element('span','','我已阅读并理解上述说明，确认会依法使用文献与模型接口。'));
    const decline=element('button','button quiet','暂不使用'),agree=element('button','button dark','同意并进入');agree.disabled=true;agree.id='usageAccept';
    checkbox.addEventListener('change',()=>{agree.disabled=!checkbox.checked;});
    agree.addEventListener('click',()=>{if(!checkbox.checked)return;accepted=true;saveUsageConsent(localStore());dialog.dispatchEvent(new Event('usage-accepted'));dialog.close();});
    decline.addEventListener('click',()=>{label.hidden=true;actions.replaceChildren();const back=element('button','button dark','返回阅读说明');back.onclick=()=>{label.hidden=false;actions.replaceChildren(decline,agree);};actions.append(element('span','usage-declined','尚未确认，工作台保持关闭。'),back);if(window.paperDesktop?.quit){const quit=element('button','button quiet','退出纸间');quit.onclick=()=>window.paperDesktop.quit();actions.append(quit);}});
    actions.append(decline,agree);footer.append(label);
    dialog.addEventListener('cancel',e=>e.preventDefault());
    dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}});
  }else{
    const close=element('button','button dark','关闭说明');close.onclick=()=>dialog.close();actions.append(close);
  }
  footer.append(actions,element('p','usage-footnote',`说明版本 ${CONSENT_VERSION} · 确认记录仅保存在本机`));dialog.append(footer);
  dialog.addEventListener('close',()=>{if(required&&!accepted){queueMicrotask(()=>{if(dialog.isConnected&&!dialog.open)dialog.showModal();});return;}dialog.remove();activeDialog=null;});document.body.append(dialog);activeDialog=dialog;return dialog;
}
export function ensureUsageConsent(){
  if(hasUsageConsent(localStore()))return Promise.resolve();
  return new Promise(resolve=>{const dialog=createUsageDialog({required:true});dialog.addEventListener('usage-accepted',resolve,{once:true});dialog.showModal();});
}
export function showUsageNotice(){createUsageDialog().showModal();}
