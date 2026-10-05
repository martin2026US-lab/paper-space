import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
test('PDF structure service rejects foreign origins and non-PDF input before invoking the local parser',async()=>{
 let calls=0;const server=createServer({pdfService:{available:async()=>true,parse:async bytes=>{calls++;assert(bytes.includes(Buffer.from('%PDF-')));return{parser:'docling',blocks:[]};},close(){}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  const attack=await fetch(origin+'/api/pdf/parse',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/pdf'},body:'%PDF-1.7'});assert.equal(attack.status,403);assert.equal(calls,0);
  const invalid=await fetch(origin+'/api/pdf/parse',{method:'POST',headers:{Origin:origin,'Content-Type':'application/pdf'},body:'not a pdf'});assert.equal(invalid.status,400);assert.equal(calls,0);
  const valid=await fetch(origin+'/api/pdf/parse',{method:'POST',headers:{Origin:origin,'Content-Type':'application/pdf'},body:'%PDF-1.7\nfixture'});assert.equal(valid.status,200);assert.equal((await valid.json()).parser,'docling');assert.equal(calls,1);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
