import {uiText,uiHTML,uiError,uiDateLocale} from './ui-language.mjs';
import {createLocalModelPicker} from './local-model-picker.mjs';
import {OUTPUT_LANGUAGES,outputLanguage} from './output-language.mjs';
import {TRANSLATION_CONNECTIONS,TRANSLATION_PROTOCOLS,connectionForProvider,TRANSLATION_KEY,providerLabel,loadTranslationSettings,saveTranslationSettings,translationCredential,translationUrl,languageCode,cleanTranslationConfig} from './translation-config.mjs';
export function createTranslationManager({storage,getReadingConfig,getReadingLanguage,onChange,isMutating,toast,openReadingSettings,augmentConfig=c=>c}){
 const $=id=>document.getElementById(id),vault=window.paperKeys,dialog=$('translationSettingsDialog');
 const settings=loadTranslationSettings(storage,getReadingLanguage()),keys=new Map(),savedKeys=new Set();let controller=null,serial=0,formBusy=false,canRemember=false,localPicker;
 const credentialKey=config=>JSON.stringify(translationCredential(config));
 const storedConfig=provider=>({provider,...settings.configs[provider]});
 function targetSupported(provider,id,config){if(['ollama','ai','inherit'].includes(provider))return true;if(!config.supportedCodes?.length)return false;try{languageCode(provider,id,config.supportedCodes);return true;}catch{return false;}}
 function populateTargets(select,provider,config,current){select.replaceChildren();for(const language of OUTPUT_LANGUAGES){const option=document.createElement('option');option.value=language.id;option.disabled=!targetSupported(provider,language.id,config);option.textContent=language.label+(option.disabled?(config.supportedCodes?.length?uiText(" · 接口未支持"):uiText(" · 待检测")):'');select.append(option);}select.value=current;}
 function update(){
  const config=storedConfig(settings.provider);populateTargets($('translationLanguage'),settings.provider,config,settings.targetLanguage);
  $('translationCurrentProvider').textContent=providerLabel(settings.provider)+(settings.provider==='ollama'?' · '+settings.configs.ollama.model:'');
  onChange(resolve());
 }
 function resolve(){const provider=settings.provider;const config=provider==='inherit'?{...getReadingConfig()}:{...settings.configs[provider]};return augmentConfig({...config,provider,targetLanguage:settings.targetLanguage,outputLanguage:settings.targetLanguage,apiKey:provider==='inherit'?config.apiKey||'':provider==='ollama'?'':keys.get(credentialKey({provider,...config}))||''});}
 function cancel(){serial++;controller?.abort();controller=null;}
 function lock(value){formBusy=value;for(const el of dialog.querySelectorAll('input,select,button[type=submit],#translationDetectLanguages,#translationTest'))el.disabled=value;if(!value)$('translationRememberKey').disabled=!canRemember;localPicker?.sync();}
 async function request(path,body,signal){const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const data=await response.json();if(!response.ok)throw Error(data.error||uiText("翻译服务请求失败。"));return data;}
 let detected=[],detectedBinding='';
 const selectedProvider=()=>$('translationProvider').value==='api'?$('translationProtocol').value:$('translationProvider').value;
 localPicker=createLocalModelPicker({dialog,getProvider:selectedProvider,getAddress:()=>$('translationBaseUrl').value,modelInput:$('translationModel'),manualRow:$('translationManualModelRow'),isBusy:()=>formBusy,request});
 function formConfig(){const provider=selectedProvider();if(provider==='inherit')return{...getReadingConfig(),provider};return{provider,baseUrl:$('translationBaseUrl').value.trim(),format:provider==='ollama'?'openai':$('translationFormat').value,model:$('translationModel').value.trim(),region:$('translationRegion').value.trim(),apiKey:$('translationApiKey').value.trim()};}
 const binding=config=>JSON.stringify([config.provider,config.baseUrl,config.format,config.region]);
 function formTargets(){const config=formConfig();populateTargets($('translationDraftLanguage'),config.provider,{supportedCodes:detected},$('translationDraftLanguage').value||settings.targetLanguage);}
 function renderForm(){
  cancel();const provider=selectedProvider(),config=storedConfig(provider);
  $('translationProtocolRow').hidden=$('translationProvider').value!=='api';
  $('translationFields').hidden=provider==='inherit';$('translationModelRow').hidden=!['ollama','ai'].includes(provider);$('translationFormatRow').hidden=provider!=='ai';$('translationRegionRow').hidden=provider!=='azure';$('translationKeyRow').hidden=['ollama','inherit'].includes(provider);$('translationReadingSettings').hidden=provider!=='inherit';
  $('translationBaseUrl').value=config.baseUrl||'';$('translationModel').value=config.model||'';$('translationRegion').value=config.region||'';$('translationFormat').value=config.format||'openai';
  $('translationApiKey').value=['ollama','inherit'].includes(provider)?'':keys.get(credentialKey(config))||'';
  detected=config.supportedCodes||[];detectedBinding=binding(formConfig());populateTargets($('translationDraftLanguage'),provider,config,settings.targetLanguage);
  $('translationStatus').textContent='';$('translationLanguageStatus').textContent=['ollama','ai','inherit'].includes(provider)?uiText("原文自动识别，目标语言通过翻译指令指定。"):detected.length?uiText("已检测可用目标语言。"):uiText("保存前将检测该服务支持的目标语言。");
  $('translationDetectLanguages').hidden=['ollama','ai','inherit'].includes(provider);
  $('translationProviderHelp').textContent=provider==='ollama'?uiText("连接本机服务，选择已安装模型；同一个地址可切换不同模型。"):provider==='inherit'?uiText("翻译使用左下角选中的阅读 AI，翻译目标语言仍独立设置。"):provider==='ai'?uiText("填写你自己的模型接口、模型 ID 和密钥，并选择接口支持的协议。"):uiText("填写你自己的翻译接口地址和密钥，兼容协议需与接口的请求格式一致。");
  $('translationApiKey').placeholder=['deepl','azure'].includes(provider)?uiText("接口要求的密钥"):uiText("按接口要求填写，可留空");
  localPicker.reset();if(dialog.open&&provider==='ollama')void localPicker.refresh();
 }
 function open(){if(isMutating())return toast(uiText("请等待当前文档操作完成。"));$('readingPreferencesDialog').close();$('readingMenu').open=false;$('translationProvider').value=connectionForProvider(settings.provider);if(connectionForProvider(settings.provider)==='api')$('translationProtocol').value=settings.provider;renderForm();lock(false);dialog.showModal();if(selectedProvider()==='ollama')void localPicker.refresh();}
 for(const p of TRANSLATION_CONNECTIONS){const option=document.createElement('option');option.value=p.id;option.textContent=p.label;$('translationProvider').append(option);}
 for(const p of TRANSLATION_PROTOCOLS){const option=document.createElement('option');option.value=p.id;option.textContent=p.label;$('translationProtocol').append(option);}
 $('translationProtocol').onchange=renderForm;$('translationProvider').onchange=renderForm;$('translationSettingsBtn').onclick=open;$('configureTranslationBtn').onclick=open;
 $('translationReadingSettings').onclick=()=>{dialog.close();openReadingSettings();};
 for(const id of ['translationBaseUrl','translationFormat','translationRegion'])$(id).addEventListener('input',()=>{cancel();$('translationApiKey').value='';detected=[];detectedBinding='';formTargets();$('translationLanguageStatus').textContent=uiText("地址、格式或区域已变更，请重新输入密钥并检测语言。");});
 $('translationBaseUrl').addEventListener('input',()=>{if(selectedProvider()==='ollama')localPicker.invalidate();});
 $('translationBaseUrl').addEventListener('change',()=>{if(selectedProvider()==='ollama')void localPicker.refresh();});
 $('translationApiKey').addEventListener('input',cancel);
 $('translationLanguage').onchange=()=>{if(isMutating()){$('translationLanguage').value=settings.targetLanguage;return;}settings.targetLanguage=$('translationLanguage').value;const persisted=saveTranslationSettings(storage,settings);update();toast(persisted?uiText("翻译目标语言已保存；解读回答语言不受影响。"):uiText("本次翻译目标已变更，本机设置未能保存。"));};
 dialog.addEventListener('close',()=>{if(dialog.open)return;cancel();localPicker.cancel();lock(false);});
 async function detect(config,signal){
  if(['ollama','ai','inherit'].includes(config.provider))return[];
  const data=await request('/api/translation/languages',config,signal);detected=data.codes;detectedBinding=binding(config);formTargets();$('translationLanguageStatus').textContent=uiText("已检测 {0} 个服务语言，仅可选择受支持的目标。", detected.length);return detected;
 }
 async function validateForm(config,signal){
  translationUrl(config.baseUrl,config.provider);
  if(['ollama','ai','inherit'].includes(config.provider)&&!config.model)throw Error(uiText("请先填写翻译模型，或配置阅读 AI。"));
  if(['deepl','azure'].includes(config.provider)&&!config.apiKey)throw Error(uiText("请填写接口要求的密钥。"));
  if(!['ollama','ai','inherit'].includes(config.provider)&&(!detected.length||detectedBinding!==binding(config)))await detect(config,signal);
  const target=$('translationDraftLanguage').value;if(!targetSupported(config.provider,target,{supportedCodes:detected}))throw Error(uiText("当前服务不支持所选目标，请改选可用语言。"));return target;
 }
 $('translationDetectLanguages').onclick=async()=>{cancel();const own=++serial;controller=new AbortController();lock(true);try{await detect(formConfig(),controller.signal);}catch(e){if(own===serial&&e.name!=='AbortError')$('translationLanguageStatus').textContent=uiError(e.message);}finally{if(own===serial)lock(false);}};
 $('translationTest').onclick=async()=>{cancel();const own=++serial;controller=new AbortController();lock(true);$('translationStatus').textContent=uiText("正在翻译示例短句…");try{const config=formConfig(),targetLanguage=await validateForm(config,controller.signal);const result=await request('/api/translate',{...config,targetLanguage,supportedCodes:detected,scope:'sentence',text:'The sample contains 42 items. [7]'},controller.signal);if(own===serial)$('translationStatus').textContent=uiText("测试成功：{0}", result.text);}catch(e){if(own===serial&&e.name!=='AbortError')$('translationStatus').textContent=uiError(e.message);}finally{if(own===serial)lock(false);}};
 $('translationSettingsForm').onsubmit=async event=>{
  event.preventDefault();if(formBusy||isMutating())return;cancel();const own=++serial;controller=new AbortController();lock(true);
  try{const config=formConfig(),targetLanguage=await validateForm(config,controller.signal);if(own!==serial)return;
   let encryptionNote='';if(!['ollama','inherit'].includes(config.provider)){
    const credential=translationCredential(config),remember=$('translationRememberKey').checked&&vault;
    if(remember){const result=await vault.set({...credential,key:config.apiKey});if(!result.ok)encryptionNote=uiText("密钥本次仅保留在会话中；{0}", result.error||uiText("系统加密未能保存。"));else savedKeys.add(credentialKey(config));}
    else if(vault){const result=await vault.clear(credential);if(!result.ok)throw Error(result.error||uiText("无法清除已保存的翻译密钥。"));savedKeys.delete(credentialKey(config));}
    if(own!==serial)return;keys.set(credentialKey(config),config.apiKey||'');
   }
   const next=structuredClone(settings);next.provider=config.provider;next.targetLanguage=targetLanguage;if(config.provider!=='inherit')next.configs[config.provider]=cleanTranslationConfig(config.provider,{...config,supportedCodes:detected});
   const persisted=saveTranslationSettings(storage,next);Object.assign(settings,next);update();dialog.close();toast(encryptionNote|| (persisted?uiText("翻译服务已保存，阅读 AI 保持原来的设置。"):uiText("翻译服务本次已切换，本机设置未能保存。")));
  }catch(e){if(own===serial&&e.name!=='AbortError')$('translationStatus').textContent=uiError(e.message);}finally{if(own===serial)lock(false);}
 };
 const ready=(async()=>{
  $('translationRememberKey').checked=!!vault;$('translationRememberKey').disabled=!canRemember;
  $('translationKeyStorageNote').textContent=vault?uiText("桌面版可用 Windows 加密保存翻译密钥。"):uiText("浏览器版只在当前会话保存翻译密钥。");
  if(vault){const status=await vault.status();if(!status.ok||!status.available){$('translationRememberKey').checked=false;$('translationRememberKey').disabled=true;}else {canRemember=true;for(const provider of ['ai','deepl','azure','libre']){const config=storedConfig(provider);if(!config.baseUrl)continue;const result=await vault.get(translationCredential(config));if(result.ok&&result.saved){keys.set(credentialKey(config),result.key);savedKeys.add(credentialKey(config));}}}}
  let saved=false;try{saved=!!storage.getItem(TRANSLATION_KEY);}catch{}
  if(!saved){try{const data=await request('/api/models',{baseUrl:settings.configs.ollama.baseUrl,format:'openai'},AbortSignal.timeout(3000));if(!data.models.some(m=>m.id===settings.configs.ollama.model))settings.provider='inherit';}catch{settings.provider='inherit';}saveTranslationSettings(storage,settings);}
  update();
 })();
 return{ready,resolve,open,usesReadingModel:()=>settings.provider==='inherit',refresh:()=>update(),async translate(text,config,{scope='sentence',signal}={}){const result=await request('/api/translate',{...config,text,scope},signal);return result.text;}};
}
