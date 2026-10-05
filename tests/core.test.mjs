import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {endpointFor,retrieve,buildMaterials,messagesFor} from '../public/context.mjs';
import {createServer} from '../server.mjs';

test('provider endpoints preserve custom base paths and support loopback models',()=>{
  assert.equal(endpointFor('https://example.test/v1/'),'https://example.test/v1/chat/completions');
  assert.equal(endpointFor('https://example.test/api/paas/v4'),'https://example.test/api/paas/v4/chat/completions');
  assert.equal(endpointFor('http://127.0.0.1:11434/v1'),'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(endpointFor('https://example.test','anthropic'),'https://example.test/v1/messages');
  assert.throws(()=>endpointFor('http://example.test/v1'));
  assert.throws(()=>endpointFor('https://user:secret@example.test/v1'));
});
const doc={name:'Study',summary:'An AI overview',blocks:[{id:'p1b1',page:1,text:'Residual dropout configuration.'},{id:'p1b2',page:1,text:'Label smoothing with epsilon 0.1.'},{id:'p2b1',page:2,text:'Translation evaluation uses BLEU.'}]};
test('selected evidence remains intact and exclusions remove its transmission',()=>{
  const selection={text:'Exact original selection',page:1,blockId:'p1b2'};
  const materials=buildMaterials(doc,1,selection,'BLEU',[]);
  assert.equal(materials[0].text,selection.text);
  assert(materials.some(m=>m.id==='p2b1'));
  assert.equal(new Set(materials.map(m=>m.id)).size,materials.length);
  assert(!buildMaterials(doc,1,selection,'BLEU',[],new Set(['selection','overview'])).some(m=>['selection','overview'].includes(m.id)));
});
test('code search retrieves matching source with its line label',()=>{
  const code=[{id:'c1',label:'loss.py · 行 1–3',text:'label_smoothing = 0.1'},{id:'c2',label:'network.py',text:'linear projection'}];
  assert.equal(retrieve(code,'label_smoothing')[0].id,'c1');
});
test('conversation budget keeps four recent turns and includes original evidence',()=>{
  const history=Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',text:`turn ${i}`}));
  const messages=messagesFor(doc,[{id:'p1b2',kind:'原文',label:'source',text:doc.blocks[1].text}],history,'why?');
  assert.equal(messages.length,11);
  assert(messages[1].content.includes('[p1b2]'));
  assert.equal(messages[2].content,'turn 12');
});
test('failed questions and replies are not recycled as successful history',()=>{
  const history=[{role:'user',text:'failed question'},{role:'assistant',text:'error',error:true},{role:'user',text:'good question'},{role:'assistant',text:'good reply'},{role:'user',text:'pending question'}];
  const messages=messagesFor(doc,[],history,'new question');
  assert.deepEqual(messages.slice(2,-1),[{role:'user',content:'good question'},{role:'assistant',content:'good reply'}]);
});
test('local service forwards to selected provider, rejects foreign origins, handles errors',async t=>{
  let seen;
  const mock=http.createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);seen={path:req.url,auth:req.headers.authorization,data:JSON.parse(Buffer.concat(chunks))};res.setHeader('Content-Type','application/json');if(seen.data.model==='fail'){res.statusCode=401;res.end(JSON.stringify({error:{message:'invalid key'}}));}else if(req.url.endsWith('/messages'))res.end(JSON.stringify({content:[{type:'text',text:'Anthropic mock answer'}]}));else res.end(JSON.stringify({choices:[{message:{content:'Mock answer [p1b2]'}}]}));});
  await new Promise(r=>mock.listen(0,'127.0.0.1',r));
  const app=createServer();await new Promise(r=>app.listen(0,'127.0.0.1',r));
  t.after(()=>{mock.close();app.close();});
  const base=`http://127.0.0.1:${app.address().port}`,provider=`http://127.0.0.1:${mock.address().port}/v1`;
  const input={baseUrl:provider,model:'mock',apiKey:'test-key',messages:[{role:'user',content:'test evidence'}]};
  const call=(body=input,origin=base)=>fetch(base+'/api/chat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const response=await call();assert.equal(response.status,200);assert.equal((await response.json()).text,'Mock answer [p1b2]');assert.equal(seen.path,'/v1/chat/completions');assert.equal(seen.auth,'Bearer test-key');assert.equal(seen.data.messages[0].content,'test evidence');
  assert.equal((await call(input,'https://foreign.test')).status,403);
  const failed=await call({...input,model:'fail'});assert.equal(failed.status,400);assert((await failed.json()).error.includes('401'));
  assert.equal((await(await call({...input,format:'anthropic'})).json()).text,'Anthropic mock answer');
  assert.equal((await fetch(base+'/api/health')).status,200);
});
