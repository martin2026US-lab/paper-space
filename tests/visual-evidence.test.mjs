import test from 'node:test';import assert from 'node:assert/strict';
import {requestChat} from '../model-service.mjs';import {visualMessage} from '../public/visual-evidence.mjs';
const url='data:image/png;base64,iVBORw0KGgo=',config={baseUrl:'http://127.0.0.1:9999/v1',model:'mock'};
for(const format of ['openai','anthropic'])test('explicit original image is passed to '+format+' without guessed text',async()=>{
 let payload;const message=visualMessage({boxes:[{page:3},{page:4}],text:'',candidateText:'DO NOT SEND'},[url,url]);
 await requestChat({...config,format},[message],{fetchImpl:async(endpoint,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>format==='anthropic'?{content:[{type:'text',text:'Mock'}]}:{choices:[{message:{content:'Mock'}}]}};}});
 assert.doesNotMatch(JSON.stringify(payload),/DO NOT SEND/);assert.match(JSON.stringify(payload),/3、4/);const parts=payload.messages[0].content;assert.equal(parts.length,3);
 if(format==='openai')assert.equal(parts[1].image_url.url,url);else {assert.equal(parts[1].source.type,'base64');assert.equal(parts[1].source.media_type,'image/png');}
});
test('image requests reject remote URLs and unsupported message shapes before any network call',async()=>{
 let calls=0;const opts={fetchImpl:async()=>{calls++;throw Error('unexpected');}};
 for(const content of [[{type:'image_url',image_url:{url:'https://example.com/private.png'}}],[{type:'image_url',image_url:{url:'data:text/html;base64,YQ=='}}],[{type:'tool_use'}]])await assert.rejects(requestChat(config,[{role:'user',content}],opts));
 await assert.rejects(requestChat(config,[{role:'system',content:[{type:'text',text:'bad'}]}],opts));assert.equal(calls,0);
});
