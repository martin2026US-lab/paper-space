import {uiText,uiHTML,uiError,uiDateLocale} from './ui-language.mjs';
import {translationUrl} from './translation-config.mjs';
export function createLocalModelPicker({dialog,getProvider,getAddress,modelInput,manualRow,isBusy,request}){
 const $=id=>document.getElementById(id),select=$('translationLocalModel'),refreshButton=$('translationRefreshModels'),toggle=$('translationManualModelToggle'),status=$('translationLocalModelStatus');
 let controller=null,serial=0,loading=false,models=[];
 function sync(){select.disabled=isBusy()||loading||!select.options.length;refreshButton.disabled=isBusy()||loading;toggle.disabled=isBusy();}
 function cancel(){serial++;controller?.abort();controller=null;loading=false;sync();}
 function populate(){
  const current=modelInput.value.trim();select.replaceChildren();
  if(current&&!models.some(m=>m.id===current)){const option=document.createElement('option');option.value=current;option.textContent=uiText("{0} · 当前配置", current);select.append(option);}
  for(const model of models){const option=document.createElement('option');option.value=model.id;option.textContent=model.name&&model.name!==model.id?model.name+' · '+model.id:model.id;select.append(option);}
  if(!select.options.length){const option=document.createElement('option');option.value='';option.textContent=uiText("暂无模型，请刷新或手动填写");select.append(option);}
  // Discovering models never changes the user's configured model.
  select.value=current;sync();
 }
 function invalidate(){cancel();models=[];populate();status.textContent=uiText("地址已变更，刷新后查看这个地址的模型。");}
 function reset(){cancel();models=[];const local=getProvider()==='ollama';$('translationLocalModelRow').hidden=!local;manualRow.hidden=local;toggle.setAttribute('aria-expanded','false');toggle.textContent=uiText("手动填写模型 ID");populate();status.textContent='';}
 async function refresh(){
  if(getProvider()!=='ollama'||!dialog.open||isBusy())return;
  cancel();const own=serial,address=getAddress().trim();let timer;
  try{
   translationUrl(address,'ollama');const active=new AbortController();controller=active;timer=setTimeout(()=>active.abort(),12000);loading=true;sync();status.textContent=uiText("正在读取已安装模型…");
   const data=await request('/api/models',{baseUrl:address,format:'openai'},active.signal);
   if(own!==serial||getProvider()!=='ollama'||getAddress().trim()!==address||!dialog.open)return;
   const seen=new Set();models=(data.models||[]).filter(m=>typeof m.id==='string'&&m.id&&m.id.length<=300&&!seen.has(m.id)&&seen.add(m.id));
   populate();const current=modelInput.value.trim();
   status.textContent=models.length?uiText("已读取 {0} 个模型，选择后保存生效。{1}", models.length, current&&!models.some(m=>m.id===current)?uiText(" 当前 ID 未在列表中，请选择模型或手动填写。"):''):uiText("这个地址尚未返回模型，可刷新列表或手动填写 ID。");
  }catch(error){if(own===serial){models=[];populate();status.textContent=error.name==='AbortError'?uiText("读取超时，请检查本机服务或刷新列表。"):uiText("读取失败：{0} 可检查地址、刷新或手动填写 ID。", uiError(error.message));}}
  finally{clearTimeout(timer);if(own===serial){loading=false;controller=null;sync();}}
 }
 refreshButton.onclick=()=>void refresh();
 select.onchange=()=>{modelInput.value=select.value;};
 modelInput.addEventListener('input',()=>{if(getProvider()==='ollama')populate();});
 toggle.onclick=()=>{manualRow.hidden=!manualRow.hidden;toggle.setAttribute('aria-expanded',String(!manualRow.hidden));toggle.textContent=manualRow.hidden?uiText("手动填写模型 ID"):uiText("收起手动输入");if(!manualRow.hidden)modelInput.focus();};
 return{reset,invalidate,refresh,cancel,sync};
}
