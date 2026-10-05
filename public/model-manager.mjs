import {endpointFor} from './context.mjs';
import {normalizeModels,restoreProfiles,persistedProfiles} from './models.mjs';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
export function createModelManager({onChange,isBusy,toast,callModel}) {
  let stored;try{stored=JSON.parse(localStorage.getItem('paper-space-models')||localStorage.getItem('paper-space-config')||'{}');}catch{}
  const restored=restoreProfiles(stored);let profiles=restored.profiles,activeId=restored.activeId;
  const keys=new Map();let draftId='',available=[],selected=new Set(),detectController,detectSerial=0;
  const vault=window.paperKeys,saved=new Set();let vaultReady=Promise.resolve();
  $('keyStorageNote').textContent=vault?'桌面使用 Windows 系统加密，密钥保存在此电脑。':'浏览器版本仅在当前页面会话保存密钥，关闭后需重新输入。';
  $('rememberKey').disabled=!vault;$('rememberKey').checked=!!vault;
  if(vault)vaultReady=(async()=>{const status=await vault.status();if(!status.ok||!status.available){$('keyStorageNote').textContent=status.error||'系统加密不可用，仅使用会话密钥。';$('rememberKey').disabled=true;$('rememberKey').checked=false;return;}for(const p of profiles){const result=await vault.get(p);if(result.ok&&result.saved){keys.set(p.id,result.key);saved.add(p.id);}else if(!result.ok)toast(result.error);}update();})();
  // Remove legacy metadata that might have contained a key in old versions.
  localStorage.removeItem('paper-space-config');persist();
  function active(){return profiles.find(p=>p.id===activeId);}
  function persist(){localStorage.setItem('paper-space-models',JSON.stringify(persistedProfiles(profiles,activeId)));}
  function update(){
    const p=active();const config=p?{baseUrl:p.baseUrl,format:p.format,model:p.model,apiKey:keys.get(p.id)||'',profileId:p.id,profileName:p.name}:{baseUrl:'',model:'',apiKey:'',format:'openai'};
    $('settingsModelName').textContent=p?.model||'连接 AI 模型';$('settingsModelName').title=p?.model||'配置接口与模型';
    $('settingsProvider').textContent=p?.name||'点击添加接口';$('keyStatus').textContent='⌄';
    $('settingsBtn').title=p?`${p.name} · ${p.model} · 点击切换`:'点击配置模型';
    $('modelLabel').textContent=p?.model||'演示模式 · 未调用模型';$('modelQuickBtn').textContent=p?'切换模型':'配置 API';onChange(config);
  }
  function option(value,label){const e=el('option',label);e.value=value;return e;}
  function credentials(){return{baseUrl:$('baseUrl').value.trim(),format:$('apiFormat').value,apiKey:$('apiKey').value.trim()};}
  function formConfig(){return{...credentials(),model:$('defaultModel').value};}
  function cancelDetection(){detectSerial++;detectController?.abort();detectController=null;$('detectModels').disabled=false;}
  function renderDefaults(preferred=$('defaultModel').value){
    const choices=available.filter(m=>selected.has(m.id));$('defaultModel').replaceChildren(...choices.map(m=>option(m.id,m.id)));
    if(choices.some(m=>m.id===preferred))$('defaultModel').value=preferred;
    $('selectedModelCount').textContent=`已选 ${choices.length} 个`;
  }
  function renderAvailable(preferred){
    const q=$('modelSearch').value.trim().toLowerCase();const list=$('detectedModels');list.replaceChildren();
    const shown=available.filter(m=>(m.id+' '+m.name).toLowerCase().includes(q));
    if(!shown.length)list.append(el('p',available.length?'没有匹配的模型。':'输入地址和密钥后，点击“检测可用模型”。','model-empty'));
    for(const model of shown){const row=el('label',undefined,'model-check');const check=el('input');check.type='checkbox';check.value=model.id;check.checked=selected.has(model.id);check.addEventListener('change',()=>{check.checked?selected.add(model.id):selected.delete(model.id);renderDefaults();});const name=el('span');name.append(el('strong',model.id));if(model.name!==model.id)name.append(el('small',model.name));row.append(check,name);list.append(row);}
    renderDefaults(preferred);
  }
  function editProfile(id){
    cancelDetection();draftId=id;const p=profiles.find(p=>p.id===id);
    $('connectionSelect').replaceChildren(...profiles.map(p=>option(p.id,p.name)),option('','＋ 新接口'));$('connectionSelect').value=p?.id||'';
    $('connectionName').value=p?.name||'';$('baseUrl').value=p?.baseUrl||'';$('apiFormat').value=p?.format||'openai';$('apiKey').value=keys.get(id)||'';
    $('rememberKey').checked=!!vault&&!$('rememberKey').disabled; $('clearSavedKey').disabled=!vault||!saved.has(id);
    available=(p?.models||[]).map(m=>({...m}));selected=new Set(available.map(m=>m.id));$('modelSearch').value='';$('manualModelId').value='';$('discoveryStatus').textContent='';$('testStatus').textContent='';renderAvailable(p?.model);
  }
  function openSettings(id=activeId){if(isBusy())return toast('请先停止当前模型任务，再修改接口。');$('modelPickerDialog').close();editProfile(id);$('settingsDialog').showModal();}
  function openPicker(){
    if(isBusy())return toast('请先停止当前模型任务，再切换模型。');if(!profiles.length)return openSettings('');
    const list=$('modelPickerList');list.replaceChildren();
    for(const p of profiles){const group=el('section',undefined,'model-group');const heading=el('div',undefined,'model-group-heading');heading.append(el('strong',p.name),el('span',new URL(p.baseUrl).host));group.append(heading);
      for(const model of p.models){const chosen=p.id===activeId&&model.id===p.model;const row=el('button',undefined,'model-option'+(chosen?' selected':''));row.type='button';row.setAttribute('aria-pressed',String(chosen));const name=el('span');name.append(el('strong',model.id));if(model.name!==model.id)name.append(el('small',model.name));row.append(name,el('span',chosen?'✓':'○','model-checkmark'));row.onclick=()=>{if(isBusy())return;activeId=p.id;p.model=model.id;persist();update();$('modelPickerDialog').close();toast(`已切换到 ${model.id}`);};group.append(row);}list.append(group);
    }
    $('modelPickerDialog').showModal();
  }
  $('settingsBtn').onclick=openPicker;$('modelQuickBtn').onclick=openPicker;$('manageModels').onclick=()=>openSettings();
  $('connectionSelect').onchange=()=>editProfile($('connectionSelect').value);$('addConnection').onclick=()=>editProfile('');
  for(const id of ['baseUrl','apiFormat'])$(id).addEventListener('input',()=>{cancelDetection();$('apiKey').value='';available=[];selected.clear();$('discoveryStatus').textContent='接口已更改，旧密钥已从表单移除；请重新输入并检测模型。';renderAvailable();});
  $('apiKey').addEventListener('input',cancelDetection);
  $('modelSearch').oninput=()=>renderAvailable();
  $('selectAllModels').onclick=()=>{for(const m of available)selected.add(m.id);renderAvailable();};
  $('addManualModel').onclick=()=>{const id=$('manualModelId').value.trim();if(!id)return;if(id.length>300)return toast('模型 ID 太长。');if(!available.some(m=>m.id===id))available.push({id,name:id});selected.add(id);renderAvailable(id);$('manualModelId').value='';};
  $('detectModels').onclick=async()=>{
    cancelDetection();const serial=detectSerial,config=credentials();try{endpointFor(config.baseUrl,config.format);}catch(e){$('discoveryStatus').textContent=e.message;return;}
    const fingerprint=JSON.stringify(config);detectController=new AbortController();$('detectModels').disabled=true;$('discoveryStatus').textContent='正在查询接口提供的模型列表…';
    try{const res=await fetch('/api/models',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config),signal:detectController.signal});const data=await res.json();if(!res.ok)throw new Error(data.error||'检测失败');if(serial!==detectSerial||JSON.stringify(credentials())!==fingerprint)return;
      const previous=$('defaultModel').value;available=normalizeModels(data.models);const kept=new Set(available.filter(m=>selected.has(m.id)).map(m=>m.id));selected=kept.size?kept:new Set(available.slice(0,1).map(m=>m.id));renderAvailable(previous);
      $('discoveryStatus').textContent=available.length?`检测到 ${available.length} 个模型，勾选需要使用的模型后保存。${data.truncated?' 列表过长，只展示前 1000 个。':''}`:'接口返回空列表，请检查账户权限。';
    }catch(e){if(e.name!=='AbortError'&&serial===detectSerial)$('discoveryStatus').textContent=`检测失败：${e.message} 可在下方手动添加模型。`;}
    finally{if(serial===detectSerial){$('detectModels').disabled=false;detectController=null;}}
  };
  $('settingsDialog').addEventListener('close',cancelDetection);
  $('settingsForm').onsubmit=async e=>{
    e.preventDefault();if(isBusy())return;try{const config=formConfig();endpointFor(config.baseUrl,config.format);const models=available.filter(m=>selected.has(m.id));if(!models.length||!models.some(m=>m.id===config.model))throw new Error('请先检测并勾选至少一个模型。');
      const id=draftId||crypto.randomUUID(),profile={id,name:$('connectionName').value.trim()||new URL(config.baseUrl).hostname,baseUrl:config.baseUrl,format:config.format,models,model:config.model};
      await vaultReady;let storageMessage='';if(vault){const result=await ($('rememberKey').checked?vault.set({...profile,key:config.apiKey}):vault.clear(profile));if(result.ok){result.saved?saved.add(id):saved.delete(id);}else storageMessage=result.error;}
      const at=profiles.findIndex(p=>p.id===id);if(at<0)profiles.push(profile);else profiles[at]=profile;keys.set(id,config.apiKey);activeId=id;persist();update();$('settingsDialog').close();toast(storageMessage||`已保存 ${models.length} 个模型，当前使用 ${profile.model}。${saved.has(id)?'密钥已加密记住。':'密钥仅用于本次会话。'}`);
    }catch(error){$('testStatus').textContent=error.message;}
  };
  $('clearSavedKey').onclick=async()=>{const p=profiles.find(p=>p.id===draftId);if(!vault||!p)return;const result=await vault.clear(p);if(!result.ok)return toast(result.error);saved.delete(p.id);keys.delete(p.id);$('apiKey').value='';$('clearSavedKey').disabled=true;update();toast('已清除本机保存的密钥，请重新输入后使用模型。');};
  $('testConnection').onclick=async()=>{if(isBusy())return;$('testConnection').disabled=true;$('testStatus').textContent='正在测试所选模型…';try{const cfg=formConfig();if(!cfg.model)throw new Error('请先检测并选择模型。');$('testStatus').textContent=(await callModel([{role:'user',content:'只回复“连接成功”。'}],cfg)).slice(0,100);}catch(e){$('testStatus').textContent=e.message;}finally{$('testConnection').disabled=false;}};
  update();return{openSettings,openPicker};
}
