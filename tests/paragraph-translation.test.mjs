import test from 'node:test';
import assert from 'node:assert/strict';
import {paragraphTranslationRequest} from '../public/paragraph-translation.mjs';
import {translationKey} from '../public/sentences.mjs';

const config={baseUrl:'https://example.test/v1',format:'openai',model:'synthetic'};
test('paragraph translation includes every sentence and source marker without changing the document',()=>{
  const doc={blocks:[{id:'p1',page:1,text:'First sentence with 42 samples. A second sentence cites [7] and x² = 4.'}]};
  const before=structuredClone(doc),request=paragraphTranslationRequest(doc,'p1',config,'en');
  assert.equal(request.messages[1].content,doc.blocks[0].text);
  assert.match(request.messages[0].content,/完整段落/);
  assert.match(request.messages[0].content,/English/);
  assert.match(request.messages[0].content,/不总结、不省略/);
  assert.equal(request.config.outputLanguage,'en');
  request.block.text='Modified snapshot';
  assert.deepEqual(doc,before);
  assert.deepEqual(config,{baseUrl:'https://example.test/v1',format:'openai',model:'synthetic'});
});
test('paragraph caches distinguish language, model, endpoint, source revisions and sentence scope',()=>{
  const doc={blocks:[{id:'p1',page:1,text:'Two sentences. Full original.'}]};
  const key=paragraphTranslationRequest(doc,'p1',config,'en').key;
  const changed=[
    paragraphTranslationRequest(doc,'p1',config,'ja').key,
    paragraphTranslationRequest(doc,'p1',{...config,model:'other'},'en').key,
    paragraphTranslationRequest(doc,'p1',{...config,baseUrl:'https://another.test/v1'},'en').key,
    paragraphTranslationRequest({blocks:[{...doc.blocks[0],text:'Changed original.'}]},'p1',config,'en').key,
    translationKey(doc.blocks[0].text,config,'en'),
  ];
  assert.ok(changed.every(other=>other!==key));
  assert.equal(new Set(changed).size,changed.length);
});
test('explicit cross-page paragraphs translate the full logical unit from either page',()=>{
  const parts=[{id:'p1',page:1,text:'Beginning of the paragraph.'},{id:'p2',page:2,text:'Continuation with reference [8].'}];
  const doc={blocks:parts,crossPageLinks:[{id:'joined',sources:parts}]};
  const fromFirst=paragraphTranslationRequest(doc,'p1',config,'zh-CN');
  const fromSecond=paragraphTranslationRequest(doc,'p2',config,'zh-CN');
  assert.equal(fromFirst.text,parts.map(b=>b.text).join('\n'));
  assert.equal(fromFirst.key,fromSecond.key);
  assert.equal(fromSecond.range,'1–2');
  assert.equal(fromSecond.block.crossPage,true);
});
test('invalid or oversized original paragraphs fail explicitly instead of sending truncated content',()=>{
  assert.throws(()=>paragraphTranslationRequest({blocks:[]},'missing',config,'en'),/原文已改变/);
  assert.throws(()=>paragraphTranslationRequest({blocks:[{id:'p1',page:1,text:'x'.repeat(24001)}]},'p1',config,'en'),/24,000/);
  const text='x'.repeat(24000);
  assert.equal(paragraphTranslationRequest({blocks:[{id:'p1',page:1,text}]},'p1',config,'en').messages[1].content.length,24000);
});
