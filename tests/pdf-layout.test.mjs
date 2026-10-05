import test from 'node:test';import assert from 'node:assert/strict';
import {extractPdfParagraphs,migratePdfLayout,resolvePdfSource} from '../public/pdf-layout.mjs';
import {generateParagraphNotes,paragraphCandidates} from '../public/paragraph-notes.mjs';
const viewport={transform:[1,0,0,-1,0,800],width:600,height:800,scale:1};
const line=(str,y,x=40,width=480,height=12)=>({str,width,height,fontName:'body',transform:[height,0,0,height,x,800-y],hasEOL:true});
const extract=(items,tree)=>extractPdfParagraphs({items,styles:{body:{ascent:.8}}},viewport,1,tree);
test('regular line spacing stays together while modest paragraph spacing splits',()=>{
 const items=[line('First paragraph begins and continues',80),line('across this full width line until its end.',94),line('Second paragraph begins separately',114),line('and continues into its second line.',128),line('Third paragraph discusses another topic.',148)];
 const blocks=extract(items);assert.equal(blocks.length,3);assert.deepEqual(blocks.map(b=>b.itemIndices),[[0,1],[2,3],[4]]);assert(!blocks[0].text.includes('Second'));assert(blocks[1].bottom<blocks[2].y);
});
test('first-line indents and short terminal lines identify paragraphs without blank lines',()=>{
 const items=[line('A paragraph continues on a full line',80),line('and ends here.',94,40,180),line('Another paragraph begins without extra leading',108),line('and continues on a full line.',122),line('An indented paragraph begins here',136,58,462),line('and returns to the normal left margin.',150)];
 assert.deepEqual(extract(items).map(b=>b.itemIndices),[[0,1],[2,3],[4,5]]);
});
test('long paragraphs are not split by an arbitrary character limit',()=>{
 const blocks=extract([line('a'.repeat(1100),80),line('b'.repeat(1100),94),line('c'.repeat(1100),108)]);assert.equal(blocks.length,1);assert(blocks[0].text.length>3000);
});
test('two columns keep source membership and left-before-right reading order',()=>{
 const items=[];for(let i=0;i<4;i++){items.push(line('Left column has its own full text line '+i,80+i*14,40,220));items.push(line('Right column has a different full line '+i,80+i*14,330,220));}
 const blocks=extract(items);assert.equal(blocks.length,2);assert.deepEqual(blocks[0].itemIndices,[0,2,4,6]);assert.deepEqual(blocks[1].itemIndices,[1,3,5,7]);assert(!blocks[0].text.includes('Right'));
});
test('tagged PDF paragraph boundaries override ambiguous geometry',()=>{
 const begin=id=>({type:'beginMarkedContentProps',id}),end={type:'endMarkedContent'};
 const tree={role:'Document',children:[{role:'P',children:[{type:'content',id:'a'}]},{role:'P',children:[{type:'content',id:'b'}]}]};
 const blocks=extract([begin('a'),line('First tagged paragraph has a full line',80),line('and another full line with wide spacing',114),end,begin('b'),line('Second tagged paragraph begins immediately',128),end],tree);
 assert.equal(blocks.length,2);assert.deepEqual(blocks.map(b=>b.itemIndices),[[0,1],[2]]);
});
test('headings and footer numbers are excluded from paragraph summaries',()=>{
 const blocks=extract([line('Introduction',40,40,160,18),line('Body paragraph to be explained.',80),line('12',780,290,12)]);assert.equal(paragraphCandidates({blocks},1).length,1);assert(blocks[0].heading);assert(blocks.at(-1).artifact);
});
test('layout migration preserves historical notes and evidence without reusing old IDs',()=>{
 const old={id:'doc',type:'pdf',blocks:[{id:'p1b1',page:1,text:'First. Second.',x:40,y:80,bottom:150,right:520,height:70}],cards:[{blockId:'p1b1',page:1,title:'Old',explanation:'old explanation'}],summary:'Old summary [p1b1]',history:[{text:'kept'}],translations:{key:'kept'},bytes:new ArrayBuffer(2)};
 const next=migratePdfLayout(old,{blocks:[{id:'p1r1',page:1,text:'First.'},{id:'p1r2',page:1,text:'Second.'}],pages:1,outline:[]});
 assert.equal(next.cards.length,0);assert.equal(next.archivedCards[0].sourceText,'First. Second.');assert.equal(next.summary,old.summary);assert.equal(next.history,old.history);assert.equal(next.bytes,old.bytes);assert.equal(next.translations,old.translations);assert(resolvePdfSource(next,{id:'p1b1'}).legacy);assert.equal(next.legacyBlocks[0].id,'p1b1');
});
test('one request per paragraph, all seven paragraphs get program-bound note IDs',async()=>{
 const blocks=Array.from({length:7},(_,i)=>({id:`p1r${i+1}`,page:1,text:`Only paragraph number ${i+1}.`})),seen=[];
 const result=await generateParagraphNotes(blocks,async messages=>{seen.push(messages);return JSON.stringify({blockId:'wrong-model-id',title:'Title',category:'方法',explanation:'A paragraph explanation.'});});
 assert.equal(result.cards.length,7);assert.equal(result.failures.length,0);for(let i=0;i<7;i++){assert.equal(seen[i][1].content,`只解读下列一个原文段落：\n${blocks[i].text}`);assert.equal(result.cards[i].blockId,blocks[i].id);}
});
test('failures remain separate, cancellation keeps completed paragraphs and stops later requests',async()=>{
 const blocks=Array.from({length:4},(_,i)=>({id:'p1r'+i,page:1,text:'Paragraph '+i})),controller=new AbortController();let calls=0;
 const result=await generateParagraphNotes(blocks,async()=>{calls++;if(calls===2)return '{bad json';if(calls===3){controller.abort();throw new DOMException('Stopped','AbortError');}return '{"title":"Done","explanation":"Valid explanation"}';},{signal:controller.signal});
 assert.equal(calls,3);assert.equal(result.cards.length,1);assert.equal(result.failures.length,1);assert(result.stopped);
});
