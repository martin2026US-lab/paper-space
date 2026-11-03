import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createPdfService} from '../pdf-service.mjs';
test('Chinese parser progress survives every UTF-8 byte boundary and forces UTF-8 on Windows',async()=>{
 const root=await mkdtemp(join(tmpdir(),'paper-progress-')),progress=[],expected='正在还原姓名重音与上下标',layout={parser:'docling',pages:1,blocks:[]};let env;
 await mkdir(join(root,'models'));await mkdir(join(root,'python'));await writeFile(join(root,'models','ready.json'),'{}');await writeFile(join(root,'python','python.exe'),'fixture');
 const service=createPdfService({runtimeRoot:root,dataRoot:root,spawnImpl:(_exe,args,options)=>{
  env=options.env;const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};
  setImmediate(async()=>{for(const b of Buffer.from(JSON.stringify({type:'progress',stage:'normalize',message:expected})+'\n'))child.stdout.emit('data',Buffer.from([b]));await writeFile(args[2],JSON.stringify(layout));child.emit('close',0)});return child;
 }});
 try{assert.deepEqual(await service.parse(Buffer.from('%PDF-fixture'),null,{onProgress:p=>progress.push(p)}),layout);assert.deepEqual(progress,[{stage:'normalize',message:expected}]);assert.equal(env.PYTHONIOENCODING,'utf-8');assert.equal(env.PYTHONUTF8,'1');}finally{service.close();await rm(root,{recursive:true,force:true})}
});
