import {requestChat} from './model-service.mjs';
import {translateText,translationLanguages} from './translation-service.mjs';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { endpointFor } from './public/context.mjs';
import { modelsEndpointFor,normalizeModels } from './public/models.mjs';
import {createPdfService} from './pdf-service.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PAPER_SPACE_PORT || 4317);
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.pdf':'application/pdf', '.svg':'image/svg+xml', '.wasm':'application/wasm', '.bcmap':'application/octet-stream', '.ttf':'font/ttf', '.woff':'font/woff', '.woff2':'font/woff2' };
function json(res, status, value) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 3_000_000) throw new Error('请求超过 3 MB，请减少上下文材料。'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createServer(options={}) {
  const pdfService=options.pdfService||createPdfService(options);
  const server=http.createServer(async (req,res) => {
    try {
      const host = req.headers.host;
      if (!/^127\.0\.0\.1:\d+$/.test(host || '')) return json(res,403,{error:'仅允许本机访问。'});
      const url = new URL(req.url, `http://${host}`);
      if (url.pathname === '/api/health') return json(res,200,{name:'paper-space',version:'1.2.2'});
      if (url.pathname === '/api/pdf/status' && req.method === 'GET') return json(res,200,{available:await pdfService.available(),parser:'docling'});
      if (url.pathname === '/api/pdf/parse' && req.method === 'POST') {
        if(req.headers.origin!==`http://${host}`||req.headers['content-type']!=='application/pdf')return json(res,403,{error:'请求来源不允许。'});
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>50_000_000)throw Error('PDF 请控制在 50 MB 以内。');chunks.push(chunk);}
        const bytes=Buffer.concat(chunks);if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('文件不是有效的 PDF。');
        const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
        return json(res,200,await pdfService.parse(bytes,abort.signal));
      }
      if (url.pathname === '/api/models' && req.method === 'POST') {
        if (req.headers.origin !== `http://${host}` || !req.headers['content-type']?.startsWith('application/json')) return json(res,403,{error:'请求来源不允许。'});
        const input=await body(req),endpoint=modelsEndpointFor(input.baseUrl,input.format);
        const headers={Accept:'application/json'};
        if(input.format==='anthropic'){headers['anthropic-version']='2023-06-01';if(input.apiKey)headers['x-api-key']=input.apiKey;}
        else if(input.apiKey)headers.Authorization=`Bearer ${input.apiKey}`;
        const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);res.on('close',()=>abort.abort());
        try {
          const models=[];let after,hasMore=false;const seen=new Set();
          for(let page=0;page<10;page++) {
            const target=new URL(endpoint);
            if(input.format==='anthropic'){target.searchParams.set('limit','100');if(after)target.searchParams.set('after_id',after);}
            const response=await fetch(target,{headers,redirect:'error',signal:abort.signal});
            let data;try{data=await response.json();}catch{throw new Error(`模型列表接口未返回 JSON（HTTP ${response.status}）。`);}
            if(!response.ok)throw new Error(`模型列表 HTTP ${response.status}：${String(data.error?.message||data.message||'请检查地址和密钥').slice(0,250)}`);
            for(const m of normalizeModels(data)){if(!seen.has(m.id)){seen.add(m.id);models.push(m);}}
            hasMore=!!data.has_more;const next=data.last_id||data.data?.at(-1)?.id;
            if(input.format!=='anthropic'||!hasMore||!next||next===after)break;after=next;
          }
          return json(res,200,{models:models.slice(0,1000),truncated:hasMore||models.length>1000});
        } finally {clearTimeout(timer);}
      }
      if (url.pathname === '/api/chat' && req.method === 'POST') {
        if (req.headers.origin !== `http://${host}` || !req.headers['content-type']?.startsWith('application/json')) return json(res,403,{error:'请求来源不允许。'});
        const input = await body(req);
        const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),120000);res.on('close',()=>abort.abort());
        try{json(res,200,await requestChat(input,input.messages,{signal:abort.signal}));}finally{clearTimeout(timer);}
        return;
      }
      if (['/api/translate','/api/translation/languages'].includes(url.pathname)&&req.method==='POST'){
        if(req.headers.origin!==`http://${host}`||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'请求来源不允许。'});
        const input=await body(req),abort=new AbortController(),timer=setTimeout(()=>abort.abort(),url.pathname==='/api/translate'?120000:30000);res.on('close',()=>abort.abort());
        try{return json(res,200,await (url.pathname==='/api/translate'?translateText:translationLanguages)(input,{signal:abort.signal}));}finally{clearTimeout(timer);}
      }
      if (req.method !== 'GET') return json(res,405,{error:'不支持的请求。'});
      let path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!path.startsWith(root.endsWith(sep)?root:root+sep)) return json(res,403,{error:'无效路径。'});
      const info = await stat(path);
      if (!info.isFile()) throw new Error('Not found');
      res.writeHead(200,{'Content-Type':(types[extname(path)] || 'application/octet-stream') + (['.html','.css','.js','.mjs','.json'].includes(extname(path))?'; charset=utf-8':''),'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'"});
      res.end(await readFile(path));
    } catch (error) {
      if (res.destroyed || res.writableEnded) return;
      json(res,error.code==='ENOENT'?404:400,{error:error.name==='AbortError'?'请求已停止或超时。':error.message});
    }
  });
  server.on('close',()=>pdfService.close());return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(port,'127.0.0.1',()=>console.log(`Paper Space: http://127.0.0.1:${port}`));
}
