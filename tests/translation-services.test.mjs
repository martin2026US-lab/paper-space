import test from 'node:test';
import assert from 'node:assert/strict';
import {translateText,translationLanguages} from '../translation-service.mjs';
import {loadTranslationSettings,saveTranslationSettings,languageCode,translationCacheKey,translationCredential} from '../public/translation-config.mjs';
import {translationKey} from '../public/sentences.mjs';
import {createServer} from '../server.mjs';
import {identity,createKeyStore} from '../desktop/key-store.mjs';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const original='First sentence has 42 samples. Second sentence cites [7].';
const mock=(value,check=()=>{})=>async(url,opts)=>{check(new URL(url),opts);return new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});};
test('DeepL sends all paragraph text as data and maps target codes without including AI prompts',async()=>{
 let requests=0;const result=await translateText({provider:'deepl',baseUrl:'https://api-free.deepl.com',apiKey:'TEST_ONLY',text:original,scope:'paragraph',targetLanguage:'zh-CN',supportedCodes:['ZH','EN-US']},{fetchImpl:mock({translations:[{text:'合成译文 [7]',detected_source_language:'EN'}]},(url,opts)=>{requests++;assert.equal(url.href,'https://api-free.deepl.com/v2/translate');assert.equal(opts.headers.Authorization,'DeepL-Auth-Key TEST_ONLY');assert.deepEqual(JSON.parse(opts.body),{text:[original],target_lang:'ZH',preserve_formatting:true});assert.equal(opts.redirect,'error');})});
 assert.equal(requests,1);assert.equal(result.text,'合成译文 [7]');assert.equal(result.detectedLanguage,'EN');
});
test('Azure auto-detects original language and maps Traditional Chinese while respecting resource region',async()=>{
 const result=await translateText({provider:'azure',baseUrl:'https://api.cognitive.microsofttranslator.com',apiKey:'TEST_ONLY',region:'eastasia',targetLanguage:'zh-TW',supportedCodes:['zh-Hans','zh-Hant'],text:original},{fetchImpl:mock([{detectedLanguage:{language:'en'},translations:[{text:'合成譯文'}]}],(url,opts)=>{assert.equal(url.searchParams.get('to'),'zh-Hant');assert.equal(url.searchParams.get('api-version'),'3.0');assert.equal(url.searchParams.has('from'),false);assert.equal(opts.headers['Ocp-Apim-Subscription-Region'],'eastasia');assert.deepEqual(JSON.parse(opts.body),[{Text:original}]);})});assert.equal(result.text,'合成譯文');
});
test('LibreTranslate uses its own language packs and standard translation endpoint',async()=>{
 const config={provider:'libre',baseUrl:'http://127.0.0.1:5000',apiKey:'TEST_ONLY',targetLanguage:'ja',text:original};
 const result=await translateText(config,{fetchImpl:mock({translatedText:'合成訳文'},(url,opts)=>{assert.equal(url.pathname,'/translate');assert.deepEqual(JSON.parse(opts.body),{q:original,source:'auto',target:'ja',format:'text',api_key:'TEST_ONLY'});})});assert.equal(result.text,'合成訳文');
 const languages=await translationLanguages(config,{fetchImpl:mock([{code:'en'},{code:'ja'}],url=>assert.equal(url.pathname,'/languages'))});assert.deepEqual(languages.codes,['en','ja']);
});
test('Dedicated services detect language capabilities and reject unsupported targets without sending text',async()=>{
 const config={provider:'deepl',baseUrl:'https://api.deepl.com/v2',apiKey:'TEST_ONLY'};
 const languages=await translationLanguages(config,{fetchImpl:mock([{language:'EN-US'},{language:'ZH'}],(url,opts)=>{assert.equal(url.pathname,'/v2/languages');assert.equal(url.searchParams.get('type'),'target');assert.equal(opts.method,undefined);})});
 let requests=0;await assert.rejects(translateText({...config,text:original,targetLanguage:'zh-TW',supportedCodes:languages.codes},{fetchImpl:async()=>{requests++;}}),/不支持/);assert.equal(requests,0);
 assert.equal(languageCode('deepl','en',['EN-GB']),'EN-GB');assert.equal(languageCode('azure','zh-CN',['zh-Hans']),'zh-Hans');
});
test('Independent AI translation chooses its own target and does not mutate the reading model',async()=>{
 const reading={provider:'inherit',baseUrl:'https://reader.test/v1',model:'reader',apiKey:'READER_TEST'};const before=structuredClone(reading);
 const result=await translateText({provider:'ollama',baseUrl:'http://127.0.0.1:11434/v1',model:'hy-mt2:1.8b-q8',text:original,scope:'paragraph',targetLanguage:'ja'},{fetchImpl:mock({choices:[{message:{content:'合成訳文'}}]},(url,opts)=>{assert.equal(url.pathname,'/v1/chat/completions');const body=JSON.parse(opts.body);assert.equal(body.model,'hy-mt2:1.8b-q8');assert.match(body.messages[0].content,/日本語/);assert.equal(body.messages[1].content,original);assert.equal(opts.headers.Authorization,undefined);})});assert.equal(result.text,'合成訳文');assert.deepEqual(reading,before);
});
test('Translation metadata never persists credentials; independent language settings survive restore',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},settings=loadTranslationSettings(storage,'en');
 settings.provider='azure';settings.targetLanguage='zh-TW';settings.configs.azure={baseUrl:'https://api.cognitive.microsofttranslator.com',region:'eastasia',apiKey:'DO_NOT_STORE',secret:'DO_NOT_STORE',supportedCodes:['zh-Hant']};saveTranslationSettings(storage,settings);
 assert.ok(!JSON.stringify([...values]).includes('DO_NOT_STORE'));const restored=loadTranslationSettings(storage,'ja');assert.equal(restored.targetLanguage,'zh-TW');assert.equal(restored.provider,'azure');assert.equal(restored.configs.azure.region,'eastasia');
});
test('Caches isolate API kind, language, scope and region, and preserve legacy AI cache identity',()=>{
 const ai={provider:'inherit',baseUrl:'https://example.test/v1',model:'one',targetLanguage:'en'};
 assert.equal(translationCacheKey(original,ai),translationKey(original,ai,'en'));
 const api={provider:'azure',baseUrl:'https://api.cognitive.microsofttranslator.com',region:'eastasia',targetLanguage:'en'};
 const keys=[translationCacheKey(original,ai),translationCacheKey(original,api),translationCacheKey(original,{...api,region:'westus'}),translationCacheKey(original,{...api,targetLanguage:'ja'}),translationCacheKey(original,api,'paragraph'),translationCacheKey(original,{...api,provider:'libre'})];assert.equal(new Set(keys).size,keys.length);
});
test('Translation key bindings include provider, endpoint and Azure region without changing reading key bindings',()=>{
 assert.equal(identity({id:'old',baseUrl:'https://example.test/v1',format:'openai'}).binding,JSON.stringify(['https://example.test/v1','openai']));
 const dir=mkdtempSync(join(tmpdir(),'paper-translation-key-')),file=join(dir,'keys.json'),crypto={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from('encrypted-'+s),decryptString:b=>b.toString().slice(10)};
 try{const vault=createKeyStore(file,crypto),config={provider:'azure',baseUrl:'https://api.cognitive.microsofttranslator.com',region:'eastasia'};vault.set({...translationCredential(config),key:'TEST_TRANSLATION_KEY'});assert.equal(vault.get(translationCredential(config)).key,'TEST_TRANSLATION_KEY');assert.equal(vault.get(translationCredential({...config,region:'westus'})).saved,false);assert.ok(!readFileSync(file,'utf8').includes('TEST_TRANSLATION_KEY'));assert.throws(()=>identity({id:'x',baseUrl:'https://example.test',format:'unknown'}),/格式/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('Malformed targets, cleartext remote endpoints and oversize source fail before any upstream request',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;};const base={provider:'libre',baseUrl:'http://127.0.0.1:5000',targetLanguage:'en',text:original};
 for(const bad of [{...base,baseUrl:'http://remote.test'},{...base,targetLanguage:'arbitrary'},{...base,text:'x'.repeat(24001)},{...base,provider:'ollama',baseUrl:'https://remote.test',model:'x'},{...base,baseUrl:'https://x.test?key=secret'}])await assert.rejects(translateText(bad,{fetchImpl}));assert.equal(calls,0);
 const result=await assert.rejects(translateText(base,{fetchImpl:async()=>new Response(JSON.stringify({error:'DO_NOT_ECHO_SECRET'}),{status:403})}),error=>!error.message.includes('DO_NOT_ECHO_SECRET')&&error.message.includes('403'));assert.equal(result,undefined);
});
test('Translation HTTP routes enforce same-origin JSON and preserve cancellation signals',async()=>{
 const server=createServer({pdfService:{close(){}}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 try{let response=await fetch(origin+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});assert.equal(response.status,403);
 response=await fetch(origin+'/api/translation/languages',{method:'POST',headers:{'Origin':origin,'Content-Type':'application/json'},body:JSON.stringify({provider:'ollama'})});assert.equal(response.status,200);assert.equal((await response.json()).codes.length,12);
 const abort=new AbortController();abort.abort();await assert.rejects(translateText({provider:'libre',baseUrl:'http://127.0.0.1:1',targetLanguage:'en',text:original},{signal:abort.signal}),error=>error.name==='AbortError');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('Custom connection UI migrates unused provider presets while preserving user-selected endpoints and local model',async()=>{
 const {defaultTranslationSettings,TRANSLATION_CONNECTIONS,connectionForProvider}=await import('../public/translation-config.mjs');
 const fresh=defaultTranslationSettings();
 assert.deepEqual(TRANSLATION_CONNECTIONS.map(c=>c.label),['本机模型','沿用阅读 AI','自定义 AI 接口','自定义翻译接口']);
 for(const provider of ['deepl','azure','libre']){assert.equal(fresh.configs[provider].baseUrl,'');assert.equal(connectionForProvider(provider),'api');}
 const legacy={version:1,provider:'azure',targetLanguage:'zh-TW',configs:{ollama:{baseUrl:'http://127.0.0.1:11434/v1',model:'hy-mt2:1.8b-q8'},deepl:{baseUrl:'https://api-free.deepl.com'},azure:{baseUrl:'https://my-translation.test/translator',region:'eastasia',supportedCodes:['zh-Hant','en']},libre:{baseUrl:'http://127.0.0.1:5000'}}};
 const settings=loadTranslationSettings({getItem:()=>JSON.stringify(legacy)});
 assert.equal(settings.provider,'azure');assert.equal(settings.targetLanguage,'zh-TW');
 assert.equal(settings.configs.azure.baseUrl,legacy.configs.azure.baseUrl);assert.equal(settings.configs.azure.region,'eastasia');assert.deepEqual(settings.configs.azure.supportedCodes,['zh-Hant','en']);
 assert.deepEqual(translationCredential({provider:'azure',...settings.configs.azure}),translationCredential({provider:'azure',...legacy.configs.azure}));
 assert.equal(settings.configs.deepl.baseUrl,'');assert.equal(settings.configs.libre.baseUrl,'');assert.equal(settings.configs.ollama.model,'hy-mt2:1.8b-q8');
 legacy.provider='deepl';const selected=loadTranslationSettings({getItem:()=>JSON.stringify(legacy)});
 assert.equal(selected.configs.deepl.baseUrl,'https://api-free.deepl.com');
 legacy.provider='ollama';legacy.configs.libre.baseUrl='https://self-hosted.test/translate';
 assert.equal(loadTranslationSettings({getItem:()=>JSON.stringify(legacy)}).configs.libre.baseUrl,'https://self-hosted.test/translate');
});
