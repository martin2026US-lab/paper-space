import test from 'node:test';import assert from 'node:assert/strict';
import {createBackup,readBackup,planRestore,backupSettings,mergeBackupSettings,validateBackupDocument,decodeBackupValue} from '../public/backup.mjs';
const store=(values={})=>({getItem:key=>values[key]??null});
const doc=()=>({id:'paper',name:'试验.pdf',type:'pdf',pages:2,lastPage:2,bytes:new Uint8Array([37,80,68,70,0,255]).buffer,blocks:[{id:'b1',page:1,text:'Original 42 [7].',coordinates:new Float32Array([1.25,2.5])}],cards:[{title:'解释',explanation:'说明',blockId:'b1',page:1}],summary:'Guide',personalNotes:[{id:'n',text:'私有批注',anchor:{docId:'paper',page:1,text:'Original'}}],conversations:[{id:'c',name:'Conversation',history:[{role:'user',text:'Question'},{role:'assistant',text:'Answer',materials:[{id:'b1',text:'Original 42 [7].'}]}]}],activeConversationId:'c',history:[],translations:{cache:'译文'},deletedAt:2,structure:{operations:[{label:'校正',sourceSnapshot:{text:'原文'}}]}});
test('Full compressed backup round-trips original bytes, typed geometry, trash, notes, evidence, and translation caches',async()=>{
 const original=doc(),blob=await createBackup([original],store());const restored=await readBackup(blob);assert.deepEqual(restored.documents,[original]);assert.equal(restored.appVersion,'1.2.2');assert.equal(restored.documents[0].bytes.byteLength,6);
});
test('Backup exports only model metadata and safe preferences, excluding keys, credentials and consent',async()=>{
 const model={version:2,profiles:[{id:'p',name:'Endpoint',baseUrl:'http://127.0.0.1:11434/v1',model:'hy',models:[{id:'hy'}],apiKey:'SECRET',password:'SECRET'}],activeId:'p'};
 const translation={version:1,provider:'ai',targetLanguage:'ja',configs:{ai:{baseUrl:'https://example.test/v1',model:'gemma',apiKey:'SECRET'}}};
 const storage=store({'paper-space-models':JSON.stringify(model),'paper-space-translation':JSON.stringify(translation),'credentials.enc.json':'SECRET','paper-space-usage-consent':'SECRET','paper-space-layout':JSON.stringify({focus:true,apiKey:'SECRET'})});
 const result=await readBackup(await createBackup([doc()],storage));assert.doesNotMatch(JSON.stringify(result.settings),/SECRET|apiKey|password|consent/);assert.match(result.settings['paper-space-models'],/hy/);assert.match(result.settings['paper-space-translation'],/gemma/);
});
test('Corrupted or truncated backups never produce restorable documents',async()=>{
 const good=await createBackup([doc()],store());const bytes=new Uint8Array(await good.arrayBuffer());bytes[Math.floor(bytes.length/2)]^=128;await assert.rejects(readBackup(new Blob([bytes])));
 await assert.rejects(readBackup(good.slice(0,good.size-15)));
 const text=await new Response(good.stream().pipeThrough(new DecompressionStream('gzip'))).text();const altered=text.replace('Original 42','Original 99');const forged=await new Response(new Blob([altered]).stream().pipeThrough(new CompressionStream('gzip'))).blob();await assert.rejects(readBackup(forged),/完整性/);
});
test('Restore planning preserves existing documents and remaps duplicate document references only in copies',()=>{
 const existing=doc(),before=structuredClone(existing),result=planRestore({documents:[doc()]},[existing],{randomId:()=> 'copy'});assert.deepEqual(existing,before);assert.equal(result.copies,1);assert.equal(result.documents[0].id,'copy');assert.equal(result.documents[0].personalNotes[0].anchor.docId,'copy');assert.equal(result.documents[0].conversations[0].id,'c');assert.deepEqual(result.documents[0].bytes,existing.bytes);assert.equal(result.documents[0].deletedAt,2);
});
test('Importing model settings preserves current model selection, endpoint bindings and translation settings',()=>{
 const profile=(id,model)=>({id,name:id,baseUrl:'http://127.0.0.1:11434/v1',format:'openai',model,models:[{id:model,name:model}]});
 const current=store({'paper-space-models':JSON.stringify({profiles:[profile('same','current')],activeId:'same'}),'paper-space-translation':'CURRENT_TRANSLATION','paper-space-output-language':'de'});
 const changes=mergeBackupSettings(current,{'paper-space-models':JSON.stringify({profiles:[profile('same','other')],activeId:'same'}),'paper-space-translation':'BACKUP_TRANSLATION','paper-space-output-language':'ja'});const models=JSON.parse(changes['paper-space-models']);assert.equal(models.activeId,'same');assert.equal(models.profiles[0].model,'current');assert.equal(models.profiles[1].model,'other');assert.notEqual(models.profiles[1].id,'same');assert.equal(changes['paper-space-translation'],undefined);assert.equal(changes['paper-space-output-language'],undefined);
});
test('Invalid backup schemas and prototype fields are rejected before any writes',()=>{
 const invalid=doc();invalid.blocks[0].text={unexpected:true};assert.throws(()=>validateBackupDocument(invalid));assert.throws(()=>decodeBackupValue(JSON.parse('{"__proto__":{"polluted":true}}')));assert.equal({}.polluted,undefined);
});
