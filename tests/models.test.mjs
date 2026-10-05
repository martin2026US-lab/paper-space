import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {modelsEndpointFor,normalizeModels,restoreProfiles,persistedProfiles} from '../public/models.mjs';
import {findSourceBlock} from '../public/highlight.mjs';
import {createServer} from '../server.mjs';
test('discovery accepts base or full completion addresses without repeating paths',()=>{
  assert.equal(modelsEndpointFor('https://example.test/v1/chat/completions'),'https://example.test/v1/models');
  assert.equal(modelsEndpointFor('https://example.test/api/v4'),'https://example.test/api/v4/models');
  assert.equal(modelsEndpointFor('https://example.test/v1/messages','anthropic'),'https://example.test/v1/models');
  assert.throws(()=>modelsEndpointFor('http://example.test'));
});
test('model lists normalize IDs, names and duplicates',()=>{
  assert.deepEqual(normalizeModels({data:[{id:'a',display_name:'Alpha'},{id:'a'},{id:'b',name:'Beta'},{}]}),[{id:'a',name:'Alpha'},{id:'b',name:'Beta'}]);
  assert.throws(()=>normalizeModels({error:'bad response'}));
});
test('existing single-model settings migrate and saved profiles exclude all keys',()=>{
  const migrated=restoreProfiles({baseUrl:'https://example.test/v1',model:'old-model',apiKey:'secret'});
  assert.equal(migrated.profiles[0].model,'old-model');
  const p={...migrated.profiles[0],apiKey:'never-store',models:[{id:'old-model',name:'Old',apiKey:'nested-secret'},{id:'second',name:'Second'}]};
  const serialized=JSON.stringify(persistedProfiles([p],p.id));assert(!serialized.includes('secret'));assert(!serialized.includes('apiKey'));
  const recovered=restoreProfiles(JSON.parse(serialized));assert.equal(recovered.profiles[0].models.length,2);
});
test('saved selection citations resolve to exact source or legacy text',()=>{
  const doc={blocks:[{id:'w1',page:1,text:'The selected source paragraph.'},{id:'w2',page:2,text:'Other evidence.'}]};
  assert.equal(findSourceBlock(doc,{id:'selection',blockId:'w2'}).id,'w2');
  assert.equal(findSourceBlock(doc,{id:'selection',page:1,text:'selected source'}).id,'w1');
  assert.equal(findSourceBlock(doc,{id:'missing',page:1,text:'not in source'}),null);
});
test('discovery uses GET, forwards correct authentication, handles pagination and errors',async t=>{
  const seen=[];const provider=http.createServer((req,res)=>{seen.push({method:req.method,url:req.url,bearer:req.headers.authorization,key:req.headers['x-api-key']});res.setHeader('Content-Type','application/json');if(req.headers.authorization==='Bearer bad'){res.writeHead(401);res.end(JSON.stringify({error:{message:'Invalid key'}}));return;}if(req.headers['x-api-key']){const next=req.url.includes('after_id');res.end(JSON.stringify({data:[{id:next?'b':'a',display_name:next?'Beta':'Alpha'}],has_more:!next,last_id:next?'b':'a'}));}else res.end(JSON.stringify({data:[{id:'chat-a'},{id:'chat-b'}]}));});
  await new Promise(r=>provider.listen(0,'127.0.0.1',r));const app=createServer();await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>{provider.close();app.close();});
  const origin=`http://127.0.0.1:${app.address().port}`,baseUrl=`http://127.0.0.1:${provider.address().port}/v1`;
  const call=(config={},from=origin)=>fetch(origin+'/api/models',{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify({baseUrl,apiKey:'local-test',...config})});
  assert.equal((await(await call()).json()).models.length,2);assert.equal(seen[0].method,'GET');assert.equal(seen[0].url,'/v1/models');assert.equal(seen[0].bearer,'Bearer local-test');
  const pages=await(await call({format:'anthropic'})).json();assert.deepEqual(pages.models.map(m=>m.id),['a','b']);assert.equal(seen.at(-1).key,'local-test');assert(seen.at(-1).url.includes('after_id=a'));
  assert.equal((await call({},'https://untrusted.test')).status,403);assert((await(await call({apiKey:'bad'})).json()).error.includes('401'));
});
