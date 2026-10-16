import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../public/locales/en.mjs';
import {formatUI,uiError,loadUILanguage,UI_LANGUAGE_KEY,normalizeUILanguage} from '../public/ui-language.mjs';
import {OUTPUT_LANGUAGES,outputLanguageInstruction} from '../public/output-language.mjs';
import {messagesFor,buildMaterials} from '../public/context.mjs';
import {paragraphTranslationRequest} from '../public/paragraph-translation.mjs';

test('Every English UI message is translated with exactly the same interpolation slots',()=>{
  const slots=text=>[...text.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();
  assert.ok(Object.keys(en).length>700);
  for(const [source,target]of Object.entries(en)){assert.equal(typeof target,'string');assert.ok(target.trim(),source);assert.doesNotMatch(target,/\p{Script=Han}/u,source);assert.deepEqual(slots(target),slots(source),source);}
});
test('UI formatting preserves document names, untrusted markup and placeholder-like source data literally',()=>{
  const source='<img src=x onerror=alert(1)> 阅读助手 {1} $&';
  assert.equal(formatUI('第 {0} 页 · {1}','en',2,source),`Page 2 · ${source}`);
  assert.equal(formatUI('第 {0} 页 · {1}','zh-CN',2,source),`第 2 页 · ${source}`);
  assert.equal(formatUI('unknown model ID','en'),'unknown model ID');
});
test('Only known service errors are translated; captured provider details remain untouched',()=>{
  assert.equal(uiError('翻译服务 HTTP 429：请稍后再试','en'),'Translation service HTTP 429: 请稍后再试');
  assert.equal(uiError('API provider: unchanged diagnostic','en'),'API provider: unchanged diagnostic');
  assert.equal(uiError('无效接口标识','en'),'Invalid endpoint ID');
  assert.equal(uiError('无效接口标识','zh-CN'),'无效接口标识');
});
test('UI preference reads tolerate malformed and denied storage and preserve Chinese defaults',()=>{
  assert.equal(normalizeUILanguage('en'),'en');assert.equal(normalizeUILanguage('en-US'),'zh-CN');
  assert.equal(loadUILanguage({getItem:key=>key===UI_LANGUAGE_KEY?'en':null}),'en');
  assert.equal(loadUILanguage({getItem(){throw Error('denied');}}),'zh-CN');assert.equal(loadUILanguage(null),'zh-CN');
});
test('Changing UI language never changes evidence, model prompts or the requested output languages',()=>{
  const doc={id:'paper',name:'纸间.txt',blocks:[{id:'w1',page:1,text:'导入文档'}],summary:'翻译服务'};
  const before=JSON.stringify(doc);const materials=buildMaterials(doc,1,null,'question');
  const expected=messagesFor(doc,materials,[],'question','de');
  const config={model:'same-model',baseUrl:'http://127.0.0.1:11434/v1',format:'openai'};
  const translations=paragraphTranslationRequest(doc,'w1',config,'ja');
  globalThis.localStorage={getItem:key=>key===UI_LANGUAGE_KEY?'en':null};
  try{assert.deepEqual(messagesFor(doc,buildMaterials(doc,1,null,'question'),[],'question','de'),expected);assert.deepEqual(paragraphTranslationRequest(doc,'w1',config,'ja'),translations);assert.equal(JSON.stringify(doc),before);assert.match(outputLanguageInstruction('de'),/Deutsch/);assert.equal(OUTPUT_LANGUAGES.find(l=>l.id==='de').name,'Deutsch');}finally{delete globalThis.localStorage;}
});
