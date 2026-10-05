import test from 'node:test';import assert from 'node:assert/strict';
import {finderEntries,matchesQuery,loadLayout} from '../public/workspace-tools.mjs';
const chapters=[{key:'a',index:0,page:1,title:'Training',depth:0},{key:'b',index:1,page:1,title:'Hardware and Schedule',depth:1},{key:'c',index:2,page:2,title:'Results',depth:0}];
test('Chapter search includes ancestor paths and retains exact same-page destinations',()=>{
 const result=finderEntries({chapters,scope:'chapters',query:'training hardware'});
 assert.equal(result.length,1);assert.equal(result[0].item,chapters[1]);assert.equal(result[0].detail,'Training');
 assert.equal(finderEntries({chapters,scope:'chapters',query:'training'}).length,2);
});
test('Document search excludes recoverable deleted records and preserves document identity',()=>{
 const docs=[{id:'a',name:'Attention.PDF',type:'pdf',pages:15},{id:'b',name:'Attention old.PDF',deletedAt:1}];
 const result=finderEntries({docs,doc:docs[0],scope:'documents',query:'attention'});
 assert.equal(result.length,1);assert.equal(result[0].doc,docs[0]);assert.ok(result[0].current);
});
test('Finder supports literal multilingual terms and normalizes full-width input without interpreting markup',()=>{
 assert.ok(matchesQuery('Ｔraining 方法','training 方法'));assert.ok(!matchesQuery('Attention','.*'));
 assert.ok(matchesQuery('<img src=x>','<img'));assert.ok(matchesQuery('anything','   '));
});
test('Layout preferences tolerate missing, malformed and blocked storage',()=>{
 for(const raw of [null,'{bad'])assert.deepEqual(loadLayout({getItem:()=>raw}),{focus:false,assistant:true});
 assert.deepEqual(loadLayout({getItem(){throw Error('blocked');}}),{focus:false,assistant:true});
 assert.deepEqual(loadLayout({getItem:()=>JSON.stringify({focus:true,assistant:false})}),{focus:true,assistant:false});
});
