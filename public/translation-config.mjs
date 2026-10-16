import {uiText,uiHTML,uiError,uiDateLocale} from './ui-language.mjs';
import {OUTPUT_LANGUAGES,normalizeOutputLanguage} from './output-language.mjs';
export const TRANSLATION_KEY='paper-space-translation';
export const TRANSLATION_PROVIDERS=Object.freeze([
 {id:'ollama',label:uiText("本机模型")}, {id:'inherit',label:uiText("沿用阅读 AI")}, {id:'ai',label:uiText("自定义 AI 接口")},
 {id:'deepl',label:uiText("自定义翻译接口")}, {id:'azure',label:uiText("自定义翻译接口")}, {id:'libre',label:uiText("自定义翻译接口")},
]);
export const TRANSLATION_CONNECTIONS=Object.freeze([
 {id:'ollama',label:uiText("本机模型")}, {id:'inherit',label:uiText("沿用阅读 AI")}, {id:'ai',label:uiText("自定义 AI 接口")}, {id:'api',label:uiText("自定义翻译接口")},
]);
export const TRANSLATION_PROTOCOLS=Object.freeze([
 {id:'libre',label:uiText("LibreTranslate 兼容")}, {id:'deepl',label:uiText("DeepL 兼容")}, {id:'azure',label:uiText("Translator v3 兼容")},
]);
export const connectionForProvider=provider=>['ollama','inherit','ai'].includes(provider)?provider:'api';
const legacyPresets={deepl:'https://api-free.deepl.com',azure:'https://api.cognitive.microsofttranslator.com',libre:'http://127.0.0.1:5000'};
const defaults={ollama:{baseUrl:'http://127.0.0.1:11434/v1',model:'hy-mt2:1.8b-q8',format:'openai'},ai:{baseUrl:'',model:'',format:'openai'},deepl:{baseUrl:''},azure:{baseUrl:'',region:''},libre:{baseUrl:''}};
export function providerLabel(id){return TRANSLATION_PROVIDERS.find(p=>p.id===id)?.label||uiText("翻译服务");}
export function translationUrl(value,provider){
 let url;try{url=new URL(value);}catch{throw Error(uiText("请输入完整的翻译接口地址。"));}
 const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))throw Error(uiText("远程翻译接口需要 HTTPS；本机接口可使用 HTTP。"));
 if(url.username||url.password||url.search||url.hash)throw Error(uiText("接口地址不能包含账号、查询参数或锚点。"));
 if(provider==='ollama'&&!loopback)throw Error(uiText("本地 Ollama 请填写本机地址；远程模型使用“自定义 AI 接口”。"));
 return url.href.replace(/\/+$/,'');
}
export function languageCode(provider,id,codes=[]){
 if(!OUTPUT_LANGUAGES.some(l=>l.id===id))throw Error(uiText("请选择有效的翻译目标语言。"));
 const names={deepl:{'zh-CN':['ZH-HANS','ZH'],'zh-TW':['ZH-HANT'],en:['EN-US','EN-GB','EN'],pt:['PT-PT','PT-BR','PT']},azure:{'zh-CN':['zh-Hans'],'zh-TW':['zh-Hant']},libre:{'zh-CN':['zh','zh-Hans'],'zh-TW':['zh-Hant','zh-TW','zt']}};
 const candidates=names[provider]?.[id]||[provider==='deepl'?id.toUpperCase():id];
 if(codes.length){const code=candidates.find(c=>codes.some(value=>value.toLowerCase()===c.toLowerCase()));if(!code)throw Error(uiText("当前翻译服务不支持所选目标语言，请改选一种可用语言。"));return codes.find(value=>value.toLowerCase()===code.toLowerCase());}
 return candidates[0];
}
export function defaultTranslationSettings(language='zh-CN') {return{version:1,provider:'ollama',targetLanguage:normalizeOutputLanguage(language),configs:structuredClone(defaults)};}
export function cleanTranslationConfig(provider,input={}){
 const out={...defaults[provider]};
 for(const key of ['baseUrl','model','region'])if(typeof input[key]==='string')out[key]=input[key].slice(0,key==='baseUrl'?2000:300);
 if(provider==='ai')out.format=input.format==='anthropic'?'anthropic':'openai';
 if(Array.isArray(input.supportedCodes))out.supportedCodes=[...new Set(input.supportedCodes.filter(v=>typeof v==='string'&&/^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?$/.test(v)))].slice(0,500);
 return out;
}
export function loadTranslationSettings(storage,language){
 const result=defaultTranslationSettings(language);
 try{const saved=JSON.parse(storage.getItem(TRANSLATION_KEY)||'null');if(!saved||saved.version!==1)return result;
  if(TRANSLATION_PROVIDERS.some(p=>p.id===saved.provider))result.provider=saved.provider;
  result.targetLanguage=normalizeOutputLanguage(saved.targetLanguage);
  for(const id of Object.keys(defaults)){
   result.configs[id]=cleanTranslationConfig(id,saved.configs?.[id]);
   // Drop unused old built-in address presets; keep chosen endpoints, keys and capabilities intact.
   if(id!==result.provider&&!result.configs[id].supportedCodes?.length&&result.configs[id].baseUrl===legacyPresets[id])result.configs[id].baseUrl='';
  }
 }catch{}return result;
}
export function saveTranslationSettings(storage,settings){
 const clean={version:1,provider:settings.provider,targetLanguage:normalizeOutputLanguage(settings.targetLanguage),configs:{}};
 for(const id of Object.keys(defaults))clean.configs[id]=cleanTranslationConfig(id,settings.configs[id]);
 try{storage.setItem(TRANSLATION_KEY,JSON.stringify(clean));return true;}catch{return false;}
}
export function translationCredential(config){
 return{id:'paper-translation-'+config.provider+'-v1',baseUrl:config.baseUrl,format:config.provider==='ai'?config.format:'translation-'+config.provider,...(config.provider==='azure'?{region:config.region||''}:{})};
}
export function translationCacheKey(text,config,scope='sentence'){
 // Existing AI caches remain usable; all dedicated services have a separate namespace.
 const language=normalizeOutputLanguage(config.targetLanguage||config.outputLanguage);
 if(['ollama','ai','inherit'].includes(config.provider)){
  const base=[text,language,new URL(config.baseUrl).href,config.format||'openai',config.model];return JSON.stringify(scope==='paragraph'?['paragraph',...base]:base);
 }
 return JSON.stringify(['translation-service',scope,text,language,config.provider,translationUrl(config.baseUrl,config.provider),config.region||'',languageCode(config.provider,language,config.supportedCodes)]);
}
