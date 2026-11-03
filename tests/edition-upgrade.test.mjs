import test from 'node:test';import assert from 'node:assert/strict';
import {needsEditionUpgrade,withReadingLayout} from '../public/edition-upgrade.mjs';
test('legacy edition upgrade adds only derived layout and preserves all existing objects',()=>{
 const doc={type:'pdf',parser:'docling',pages:2,fileFingerprint:'same',blocks:[{id:'old',text:'Original'}],personalNotes:[{text:'Keep',blockId:'old'}],history:[{content:'Keep chat'}],translations:{old:'Keep'},structure:{},bytes:new Uint8Array([1,2,3])},before=structuredClone(doc);
 assert.ok(needsEditionUpgrade(doc));const layout={blocks:[{}],quality:{version:'reading-quality-v3'}},next=withReadingLayout(doc,{pages:2,fileFingerprint:'same',readingLayout:layout});
 for(const k of Object.keys(doc))assert.equal(next[k],doc[k]);assert.deepEqual(doc,before);assert.equal(next.readingLayout,layout);assert.equal(needsEditionUpgrade(next),false);
 assert.throws(()=>withReadingLayout(doc,{pages:2,fileFingerprint:'other',readingLayout:layout}));assert.throws(()=>withReadingLayout(doc,{pages:3,fileFingerprint:'same',readingLayout:layout}));
});
test('manual edits and saved editions are not automatically replaced',()=>{
 const d={type:'pdf',parser:'docling',blocks:[]};
 for(const extra of [{readingEdition:{}},{blocks:[{manual:true}]},{structure:{operations:[{}]}},{structure:{conflict:true}},{crossPageLinks:[{}]}])assert.equal(needsEditionUpgrade({...d,...extra}),false);
});
test('v2 gets a new derived layer without replacing saved sources or translation cache',()=>{
 const old={type:'pdf',parser:'docling',pages:2,fileFingerprint:'same',blocks:[{id:'saved'}],translations:{saved:'old translation'},readingLayout:{blocks:[{}],quality:{version:'reading-quality-v2'}}};
 assert.ok(needsEditionUpgrade(old));const layout={blocks:[{}],quality:{version:'reading-quality-v3'}},next=withReadingLayout(old,{pages:2,fileFingerprint:'same',readingLayout:layout});assert.equal(next.blocks,old.blocks);assert.equal(next.translations,old.translations);assert.equal(old.readingLayout.quality.version,'reading-quality-v2');assert.equal(next.readingLayout,layout);
});
