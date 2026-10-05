import http from 'node:http';import {readFileSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createServer} from '../server.mjs';
const dataRoot=fileURLToPath(new URL('../.test-data/v100-browser-data/',import.meta.url));mkdirSync(dataRoot,{recursive:true});
const runtimeRoot=fileURLToPath(new URL('../runtime/',import.meta.url));
const requests=[];
const model=http.createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const input=JSON.parse(Buffer.concat(chunks));requests.push(input);const note=input.messages[0].content.includes('只解读用户提供');await new Promise(r=>setTimeout(r,450));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:note?JSON.stringify({title:'本机模拟旁注',category:'测试',explanation:'仅依据选定来源范围的模拟解读。'}):'本机模拟回复：'+input.messages.at(-1).content}}]}));});
model.listen(4412,'127.0.0.1');
const app=createServer({runtimeRoot,dataRoot}),handler=app.listeners('request')[0];app.removeAllListeners('request');
let mode='normal',waiting=[],parseRequests=0;
app.on('request',(req,res)=>{
  if(req.url?.startsWith('/test-mode')){mode=new URL(req.url,'http://localhost').searchParams.get('value')||'normal';res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode,parseRequests}));if(mode==='normal'){for(const release of waiting)release();waiting=[];}return;}
  if(req.url==='/test-stats'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({mode,waiting:waiting.length,parseRequests}));}
  if(req.url==='/api/pdf/parse'){parseRequests++;if(mode==='fail'){res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Synthetic recognition failure'}));}if(mode==='hold'){waiting.push(()=>handler(req,res));return;}}

  if(req.url?.startsWith('/startup-case')){const mode=new URL(req.url,'http://localhost').searchParams.get('mode')||'normal';res.setHeader('Content-Type','text/html;charset=utf-8');const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8').replace('src="/app.mjs"','src="'+(mode==='error'?'/startup-broken.mjs':'/startup-driver.mjs')+'"');return res.end(html);}
  if(req.url==='/startup-driver.mjs'){res.setHeader('Content-Type','text/javascript');return res.end("import {startup} from '/startup.mjs';startup.stage('正在还原上次阅读…');document.addEventListener('fixture-ready',()=>startup.ready());");}
  if(req.url==='/startup-broken.mjs'){res.setHeader('Content-Type','text/javascript');return res.end("import '/missing-startup-dependency.mjs';");}
  if(req.url==='/sample-layout.json'){res.setHeader('Content-Type','application/json');return res.end(readFileSync(new URL('sample-layout.json',import.meta.url)));}
  if(req.url==='/test-requests'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(requests));}
  const routes={'/tests':'v100-browser.html','/v100-browser.mjs':'v100-browser.mjs','/v096':'v096-browser.html','/v096-browser.mjs':'v096-browser.mjs','/v095':'v095-browser.html','/v094':'v094-browser.html','/v095-browser.mjs':'v095-browser.mjs','/regression':'v093-browser.html','/v093-browser.mjs':'v093-browser.mjs','/v094-browser.mjs':'v094-browser.mjs','/cross.pdf':'cross-page-fixture.pdf','/fixture.pdf':'paragraph-fixture.pdf','/fixture.docx':'table-fixture.docx','/outline.pdf':'outline-fixture.pdf'};
  if(routes[req.url]){res.setHeader('Content-Type',req.url.endsWith('.mjs')?'text/javascript;charset=utf-8':req.url.endsWith('.pdf')?'application/pdf':'text/html;charset=utf-8');return res.end(readFileSync(new URL(routes[req.url],import.meta.url)));}
  // Same-origin test frame only, scoped to this isolated server. Production CSP remains unchanged.
  const head=res.writeHead;res.writeHead=function(code,headers,...rest){if(headers?.['Content-Security-Policy'])headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'");return head.call(this,code,headers,...rest);};
  return handler(req,res);
});
app.listen(4411,'127.0.0.1',()=>console.log('v0.9 isolated suite http://127.0.0.1:4411/tests; mock only :4412'));
