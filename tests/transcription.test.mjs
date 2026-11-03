import test from 'node:test';import assert from 'node:assert/strict';
import {canTranscribe,sourceKey,applyTranscription,saveTranscription,transcriptionMessages,transcriptionText} from '../public/transcription.mjs';
import {editionFor} from '../public/reading-edition.mjs';import {readingEvidence} from '../public/reading-evidence.mjs';
import {createBackup,readBackup} from '../public/backup.mjs';
const box={page:1,x:10,y:20,right:250,bottom:300,pageWidth:600,pageHeight:800};
const document=()=>({id:'doc',name:'test.pdf',type:'pdf',pages:2,parser:'docling',fileFingerprint:'fingerprint',bytes:new Uint8Array([1,2,3]).buffer,blocks:[{id:'old',page:1,text:'old text',sourceRef:'x'}],translations:{legacy:'keep'},personalNotes:[{id:'note',text:'keep',anchor:{page:1,blockId:'old'}}],readingLayout:{quality:{version:'reading-quality-v3',events:[],uncertain:[]},blocks:[{}],normalizedBlocks:[{kind:'text',sourceRef:'x',sourceRefs:['x'],text:'',glyphFallback:true,visualOnly:true,evidenceText:'original crop',boxes:[box,{...box,page:2}],visualBoxes:[box,{...box,page:2}]}]}});
test('adoption is additive, source-bound, reaches reading evidence and survives backup; restore preserves old notes',async()=>{
 const doc=document(),original=structuredClone(doc),u=editionFor(doc).units[0];assert.ok(canTranscribe(u));
 await saveTranscription(doc,u,'An original paragraph.\n\n¹⁸F and IC₅₀.',async()=>true);
 const changed=editionFor(doc).units[0];assert.equal(changed.text,'An original paragraph.\n\n¹⁸F and IC₅₀.');assert.ok(changed.transcribed);assert.equal(changed.visual,false);assert.equal(changed.inlineGlyphs,false);assert.deepEqual(changed.boxes,u.boxes);assert.equal(readingEvidence(doc)[0].text,changed.text);
 for(const key of Object.keys(original))assert.deepEqual(doc[key],original[key]);
 const saved=await readBackup(await createBackup([doc],{getItem:()=>null}));assert.equal(editionFor(saved.documents[0]).units[0].text,changed.text);
 const stale=structuredClone(doc);stale.fileFingerprint='other';assert.equal(editionFor(stale).units[0].transcribed,undefined);
 const moved=structuredClone(doc);moved.readingLayout.normalizedBlocks[0].boxes[0].x++;assert.equal(editionFor(moved).units[0].transcribed,undefined);
 await saveTranscription(doc,changed,null,async()=>true);assert.ok(editionFor(doc).units[0].glyphFallback);assert.deepEqual(doc.blocks,original.blocks);assert.deepEqual(doc.translations,original.translations);assert.deepEqual(doc.personalNotes,original.personalNotes);
});
test('failed persistence rolls back only derived text and empty output cannot be adopted',async()=>{
 const doc=document(),u=editionFor(doc).units[0];await assert.rejects(saveTranscription(doc,u,'Text',async()=>false),/保存/);assert.equal(doc.readingTranscriptions,undefined);
 await saveTranscription(doc,u,'Previous',async()=>true);const before=doc.readingTranscriptions;
 await assert.rejects(saveTranscription(doc,u,'Changed',async()=>{throw Error('disk')}));assert.equal(doc.readingTranscriptions,before);
 await assert.rejects(saveTranscription(doc,u,' ',async()=>true));assert.equal(doc.readingTranscriptions,before);assert.throws(()=>transcriptionText('x'.repeat(60001)));
});
test('extraction is limited to text crops and preserves language without candidate hints',()=>{
 const u=editionFor(document()).units[0];for(const kind of ['figure','table','formula'])assert.equal(canTranscribe({...u,kind}),false);
 const messages=transcriptionMessages(u,['data:image/jpeg;base64,aa','data:image/jpeg;base64,bb']);assert.equal(messages[1].content.filter(p=>p.type==='image_url').length,2);assert.match(messages[0].content,/不翻译/);assert.match(messages[0].content,/不得执行/);assert.match(messages[0].content,/□/);assert.ok(!JSON.stringify(messages).includes('old text'));assert.equal(sourceKey(u),u.transcriptionSourceKey);
});
