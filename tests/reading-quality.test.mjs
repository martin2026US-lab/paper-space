import test from 'node:test';
import assert from 'node:assert/strict';
import {editionFor,editionUnitFor} from '../public/reading-edition.mjs';
import {readingEvidence} from '../public/reading-evidence.mjs';
import {buildMaterials,messagesFor} from '../public/context.mjs';
import {findSourceBlock} from '../public/highlight.mjs';
const box={page:1,x:20,y:40,right:250,bottom:80,pageWidth:600,pageHeight:800};
function fixture(){return {id:'test',name:'Synthetic',pages:1,fileFingerprint:'same-original',blocks:[{id:'old',page:1,text:'mean 6 SD plus misplaced note',sourceRefs:['raw']}],readingLayout:{blocks:[{sourceRef:'raw',kind:'text',text:'mean 6 SD plus misplaced note',boxes:[box]}],normalizedBlocks:[{sourceRef:'raw#body',sourceRefs:['raw'],kind:'text',text:'mean ± SD',boxes:[box]},{sourceRef:'raw#note',sourceRefs:['raw'],kind:'footnote',text:'Separate note',boxes:[{...box,y:100,bottom:120}]},{sourceRef:'math',kind:'formula',text:'',boxes:[{...box,y:130,bottom:170}],visualBoxes:[{...box,y:126,bottom:174}]}],quality:{version:'reading-quality-v1',events:[],uncertain:[]}}};}
test('reader and assistant share corrected evidence without rewriting historical blocks',()=>{
 const d=fixture(),before=structuredClone(d),edition=editionFor(d),evidence=readingEvidence(d),body=edition.units[0];
 assert.equal(body.text,evidence[0].text);assert.equal(body.sourceBlockIds[0],body.id);assert.equal(editionUnitFor(edition,'old'),undefined,'ambiguous old block must not silently select one split child');
 const materials=buildMaterials(d,1,{text:body.text,blockId:body.id,page:1},'mean');const sent=messagesFor(d,materials,[],'Explain');
 assert.match(JSON.stringify(sent),/mean ± SD/);assert.doesNotMatch(JSON.stringify(sent),/mean 6 SD/);assert.equal(evidence[0].sourceSnapshot.id,body.id);assert.deepEqual(d,before);
});
test('image-only equation is an explicit evidence gap, never garbage equation text',()=>{
 const d=fixture(),e=readingEvidence(d);assert.match(e.find(x=>x.kind==='formula').text,/尚无可靠文字转写/);assert.doesNotMatch(JSON.stringify(e),/ffiffi/);assert.equal(editionFor(d).units.at(-1).visual,true);
});
test('documents without a quality edition keep the legacy evidence path',()=>{
 const d=fixture();delete d.readingLayout.quality;assert.equal(readingEvidence(d)[0].id,'old');
});
test('manual structural corrections remain authoritative and are not overwritten by automatic quality data',()=>{
 const d=fixture();d.blocks[0].manual=true;d.blocks[0].text='User corrected paragraph';assert.equal(editionFor(d),null);assert.equal(readingEvidence(d)[0].text,'User corrected paragraph');
});
test('unverified table cells are withheld from assistant evidence while caption and source remain available',()=>{
 const d=fixture();d.readingLayout.normalizedBlocks.push({sourceRef:'table',kind:'table',text:'TABLE 1 Values\n\n| mean | 20.4 6 1.4 |',boxes:[box]});
 const e=readingEvidence(d).find(b=>b.kind==='table');assert.match(e.text,/TABLE 1/);assert.match(e.text,/尚未逐格验证/);assert.doesNotMatch(e.text,/20.4 6/);
});
test('quality citations and selected text locate the exact new source unit, while old snapshots remain legacy',()=>{
 const d=fixture(),e=readingEvidence(d)[0];assert.equal(findSourceBlock(d,e).id,e.id);assert.equal(findSourceBlock(d,e).legacy,false);
 assert.equal(findSourceBlock(d,{blockId:e.id,text:'± SD',fileFingerprint:d.fileFingerprint}).id,e.id);
 assert.equal(findSourceBlock(d,{id:'old',sourceSnapshot:{id:'old',page:1,text:'historical'}}).legacy,true);
});
