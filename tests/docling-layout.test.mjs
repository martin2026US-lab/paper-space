import test from 'node:test';import assert from 'node:assert/strict';
import {doclingUnits,mapDoclingPage,migrateDocling} from '../public/docling-layout.mjs';
import {paragraphCandidates} from '../public/paragraph-notes.mjs';
const box=(y=80)=>({page:1,x:40,y,right:560,bottom:y+20,pageWidth:600,pageHeight:800});
const item=(kind,text,y)=>({kind,text,boxes:[box(y)]});
test('complete positional encoding formulas retain both expressions and adjacent definitions',()=>{
 const blocks=[item('text','We use sine and cosine:',60),item('formula','PE_{pos,2i}=sin(pos/10000^{2i/d})',90),item('formula','PE_{pos,2i+1}=cos(pos/10000^{2i/d})',120),item('text','where pos is position and i is dimension.',150),item('text','We also experimented with learned embeddings.',190)];
 const units=doclingUnits({blocks});assert.equal(units.length,2);assert.equal(units[0].kind,'formula');assert.equal(units[0].boxes.length,4);assert(units[0].text.includes('sin'));assert(units[0].text.includes('cos'));assert(units[0].text.includes('where'));assert(!units[0].text.includes('also experimented'));
});
test('tables are interpreted with the complete data and caption, not individual column headings',()=>{
 const units=doclingUnits({blocks:[item('caption','Table 1: complexity.',60),item('table','| Layer | Complexity |\n| Attention | O(n²d) |',90),item('section_header','3.5 Positional Encoding',200)]});assert.equal(units.length,2);assert.equal(units[0].kind,'table');assert(units[0].text.includes('Table 1'));assert(units[0].text.includes('O(n²d)'));
});
test('abstracts remain candidates; headings, keywords, furniture and cross-page continuation do not',()=>{
 const units=doclingUnits({blocks:[item('title','Paper title',10),item('text','Author names and institute addresses',25),item('section_header','Abstract',40),item('text','This long abstract is a complete natural paragraph.',70),item('text','Keywords: attention; encoding',120),item('page_footer','A footer that must be ignored',780)]});
 assert.equal(paragraphCandidates({blocks:units.map(b=>({...b,page:1}))},1).length,1);
});
test('superscript and subscript PDF items stay in the same formula despite font size changes',()=>{
 const v={transform:[1,0,0,-1,0,800],width:600,height:800,scale:1};
 const c={items:[{str:'PE',width:20,transform:[12,0,0,12,45,700]},{str:'2i',width:8,transform:[6,0,0,6,65,705]},{str:'neighbour',width:80,transform:[12,0,0,12,45,660]}]};
 const u=doclingUnits({blocks:[{kind:'formula',text:'PE^{2i}',boxes:[{...box(80),bottom:105}]},{...item('text','Neighbour paragraph.',130),boxes:[{...box(130),bottom:150}]}]});
 const blocks=mapDoclingPage(u,c,v,1);assert.deepEqual(blocks[0].itemIndices,[0,1]);assert.deepEqual(blocks[1].itemIndices,[2]);assert.equal(blocks[0].column,0);
});
test('migration preserves histories and old evidence while avoiding IDs from the geometry parser',()=>{
 const doc={blocks:[{id:'p1r1',page:1,text:'Old'}],cards:[{blockId:'p1r1',page:1,title:'Old note'}],history:[{text:'history'}],summary:'summary',bytes:'original'};
 const next=migrateDocling(doc,{blocks:[{id:'p1d1',page:1,text:'New'}],outline:[],pages:1});assert.equal(next.archivedCards[0].sourceText,'Old');assert.equal(next.history,doc.history);assert.equal(next.bytes,'original');assert.equal(next.cards.length,0);assert.equal(next.parser,'docling');
});
