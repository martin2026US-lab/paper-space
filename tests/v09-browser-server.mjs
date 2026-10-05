import http from 'node:http';import {readFileSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createServer} from '../server.mjs';
const dataRoot=fileURLToPath(new URL('../.test-data/v09-browser-data/',import.meta.url));mkdirSync(dataRoot,{recursive:true});
const runtimeRoot=fileURLToPath(new URL('../runtime/',import.meta.url));
const requests=[];
const model=http.createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const input=JSON.parse(Buffer.concat(chunks));requests.push(input);const note=input.messages[0].content.includes('只解读用户提供');await new Promise(r=>setTimeout(r,450));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:note?JSON.stringify({title:'本机模拟旁注',category:'测试',explanation:'仅依据选定来源范围的模拟解读。'}):'本机模拟回复：'+input.messages.at(-1).content}}]}));});
model.listen(4349,'127.0.0.1');
const app=createServer({runtimeRoot,dataRoot}),handler=app.listeners('request')[0];app.removeAllListeners('request');
app.on('request',(req,res)=>{
  if(req.url==='/test-requests'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(requests));}
  const routes={'/tests':'v09-browser.html','/v09-browser.mjs':'v09-browser.mjs','/fixture.pdf':'paragraph-fixture.pdf'};
  if(routes[req.url]){res.setHeader('Content-Type',req.url.endsWith('.mjs')?'text/javascript;charset=utf-8':req.url.endsWith('.pdf')?'application/pdf':'text/html;charset=utf-8');return res.end(readFileSync(new URL(routes[req.url],import.meta.url)));}
  // Same-origin test frame only, scoped to this isolated server. Production CSP remains unchanged.
  const head=res.writeHead;res.writeHead=function(code,headers,...rest){if(headers?.['Content-Security-Policy'])headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'");return head.call(this,code,headers,...rest);};
  return handler(req,res);
});
app.listen(4335,'127.0.0.1',()=>console.log('v0.9 isolated suite http://127.0.0.1:4335/tests; mock only :4349'));
