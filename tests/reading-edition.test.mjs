import test from 'node:test';
import assert from 'node:assert/strict';
import {editionFor,editionUnitFor,validEdition} from '../public/reading-edition.mjs';
const box=(page=1,x=30,y=40,right=260,bottom=110)=>({page,x,y,right,bottom,pageWidth:600,pageHeight:800});
const item=(ref,kind,text,boxes=[box()])=>({sourceRef:ref,kind,text,boxes});
function doc(blocks){return {fileFingerprint:'source-a',pages:2,bytes:new Uint8Array([1,2,3]),blocks:blocks.map((b,i)=>({...b,id:'old-'+i,page:b.boxes[0].page,sourceRefs:[b.sourceRef]})),cards:[{blockId:'old-0',sourceText:'historical evidence'}],translations:{old:'old translation'},readingLayout:{blocks}};}
test('automatic reading keeps semantic column order, cross-page anchors, figures and footnotes without mutating source',()=>{
 const d=doc([item('title','title','Title'),item('left','text','Left column'),item('cross','text','A single complete cross-page paragraph',[box(1,310,680,570,750),box(2,30,40,260,90)]),item('figure','picture','Figure',[box(2,30,130,260,250)]),item('caption','caption','FIGURE 1. Complete caption',[box(2,30,260,260,285)]),item('note','footnote','Important footnote'),item('footer','page_footer','Journal page 2')]);
 const before=structuredClone(d),e=editionFor(d);assert.deepEqual(d,before);assert.deepEqual(e.units.map(u=>u.sourceRefs[0]),['title','left','cross','figure','note','footer']);assert.equal(e.units[2].boxes.length,2);assert.equal(e.units[3].visual,true);assert.match(e.units[3].text,/Complete caption/);assert.equal(e.units[4].kind,'note');assert.equal(e.units[5].kind,'footer');assert.equal(editionUnitFor(e,'old-4'),e.units[3]);assert.ok(validEdition(e,d));
});
test('table crop uses exact table box while caption sources remain separately traceable',()=>{
 const d=doc([item('t','table','TABLE 1\n\n| Values |'),item('c','caption','TABLE 1 Values',[box(1,40,20,270,35)]),item('f','footnote','* Footnote')]),e=editionFor(d);assert.deepEqual(e.units[0].boxes[0],box());assert.equal(e.units[0].text,'TABLE 1 Values');assert.deepEqual(e.units[0].sourceRefs,['t','c']);assert.equal(e.units[1].text,'* Footnote');
});
test('stale reviewed edition is never applied to another original file',()=>{
 const d=doc([item('p','text','Fresh source')]);d.readingEdition={version:1,fingerprint:'different',provenance:'reviewed-paper',units:[{text:'Wrong paper'}]};assert.equal(editionFor(d).units[0].text,'Fresh source');assert.equal(d.readingEdition.units[0].text,'Wrong paper');
});
test('invalid source geometry cannot be rendered as verified correspondence',()=>{
 const d=doc([item('p','text','Source',[box(9)])]);assert.equal(validEdition(editionFor(d),d),false);d.readingLayout.blocks[0].boxes[0].page=1;d.readingLayout.blocks[0].boxes[0].pageWidth=0;assert.equal(validEdition(editionFor(d),d),false);
});
