import {uiText as t,uiError} from './ui-language.mjs';
export function createRuntimeUI({toast,isBusy=()=>false,onReady=()=>{}}={}){
 const api=window.paperDesktop,el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};let timer,working=false,lastAvailable=false;
 const dialog=el('dialog');dialog.id='runtimeDialog';const header=el('div');header.className='dialog-header';const title=el('h2',t('文档识别组件')),close=el('button','×');close.className='dialog-close';close.onclick=()=>dialog.close();close.setAttribute('aria-label',t('关闭'));header.append(title,close);
 const intro=el('p',t('Docling 用于本机识别段落、表格和公式。首次安装从官方源下载 Python、依赖和模型；完成后识别离线进行，不上传文献。组件独立保存，更新纸间无需重复下载。'));intro.className='dialog-intro';
 const status=el('p');status.id='runtimeStatus';status.setAttribute('role','status');const location=el('p');location.className='storage-location';location.id='runtimeLocation';const progress=el('progress');progress.max=100;progress.hidden=true;progress.id='runtimeProgress';
 const details=el('details'),summary=el('summary',t('查看安装详情')),log=el('pre');details.append(summary,log);const actions=el('div');actions.className='dialog-actions runtime-actions';
 const official=el('button',t('Docling 官方仓库')),choose=el('button',t('选择组件目录')),existing=el('button',t('使用已有环境')),install=el('button',t('一键下载并配置')),cancel=el('button',t('取消安装'));for(const b of [official,choose,existing,install,cancel])b.className='button';install.className='button dark';install.id='runtimeInstall';cancel.id='runtimeCancel';cancel.hidden=true;
 actions.append(official,choose,existing,install,cancel);dialog.append(header,intro,status,location,progress,details,actions);document.body.append(dialog);
 const stages={download:'正在下载并校验官方安装工具…',python:'正在配置独立 Python 环境…',dependencies:'正在安装 Docling 依赖，首次可能需要数分钟…',models:'正在下载官方识别模型…',verify:'正在验证识别环境…'};
 async function refresh(){if(!api?.runtime){status.textContent=t('请在桌面版中一键配置；浏览器版可按 README 配置 Docling。');for(const b of [choose,existing,install,official])b.disabled=true;return;}
  const result=await api.runtime('status');if(!result.ok)throw Error(result.error);working=result.busy;location.textContent=result.root?t('当前环境：{0}\n下载目录：{1}',result.root,result.installRoot):t('下载目录：{0}',result.installRoot);for(const b of [choose,existing,install])b.disabled=working||isBusy();cancel.hidden=!working;progress.hidden=!working;if(result.progress===null)progress.removeAttribute('value');else progress.value=result.progress;log.textContent=result.log||'';
  status.textContent=working?t(stages[result.stage]||'正在配置…'):result.phase==='error'?uiError(result.error)+(result.available?'\n'+t('原有识别环境仍可使用。'):''):result.phase==='cancelled'?t('已取消安装，原有环境仍可使用。'):result.available?t('Docling 已就绪，识别在本机离线进行。'):t('尚未配置 Docling。原文阅读不受影响。');
  if(result.available&&!lastAvailable)onReady();lastAvailable=result.available;
 }
 async function action(name){if(isBusy()&&name!=='cancel')return toast(t('请先结束当前任务。'));try{const result=await api.runtime(name);if(!result.ok)throw Error(result.error);await refresh();}catch(e){status.textContent=uiError(e.message);}}
 official.onclick=()=>action('official');choose.onclick=()=>action('location');existing.onclick=()=>action('configure');install.onclick=()=>action('install');cancel.onclick=()=>action('cancel');dialog.addEventListener('close',()=>clearInterval(timer));
 return{open(){dialog.showModal();refresh().catch(e=>{status.textContent=uiError(e.message);});clearInterval(timer);timer=setInterval(()=>refresh().catch(()=>{}),1000);},get busy(){return working;}};
}
