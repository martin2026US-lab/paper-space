import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {createRuntimeManager,runtimeSpec,externalComponentRoot,runProcess} from '../desktop/runtime-manager.mjs';
import {createPdfService} from '../pdf-service.mjs';

async function fixture(fn){const root=await mkdtemp(join(tmpdir(),'paper-mac-'));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
async function macRuntime(root,venv='venv'){const python=join(root,venv,'bin','python');await mkdir(join(root,venv,'bin'),{recursive:true});await writeFile(python,'synthetic Python');await mkdir(join(root,'models'),{recursive:true});await writeFile(join(root,'models','ready.json'),'{}');return python;}

test('Mac environments are discovered and can be activated without Windows paths',()=>fixture(async root=>{
 const env=join(root,'existing');const python=await macRuntime(env);
 assert.equal((await runtimeSpec(env,undefined,{platform:'darwin'})).python,python);assert.equal((await runtimeSpec(env,undefined,{platform:'darwin'})).pythonPath,'');
 const calls=[];const manager=createRuntimeManager({platform:'darwin',arch:'arm64',dataRoot:join(root,'data'),componentRoot:join(root,'components'),appRoot:join(root,'Reader.app'),run:async(command,args,options)=>{calls.push({command,args,options});}});
 await manager.configure(env);assert.equal((await manager.current()).python,python);assert.equal(calls[0].options.env.HF_HUB_OFFLINE,'1');
 assert.equal(await createPdfService({platform:'darwin',runtimeRoot:env,dataRoot:join(root,'cache')}).available(),true);
}));

test('Mac component directories stay outside the app and survive app upgrades',()=>fixture(async root=>{
 const dataRoot=join(root,'Application Support','PaperSpace');const options={platform:'darwin',dataRoot};
 assert.equal(externalComponentRoot(join(root,'v1.app','Contents','MacOS'),options),join(dataRoot,'components'));
 assert.equal(externalComponentRoot(join(root,'v2.app','Contents','MacOS'),options),join(dataRoot,'components'));
 const appRoot=join(root,'PaperSpace.app');const manager=createRuntimeManager({platform:'darwin',arch:'arm64',dataRoot,componentRoot:join(dataRoot,'components'),appRoot});
 await assert.rejects(manager.setLocation(join(appRoot,'Contents','models')),/程序目录之外/);
}));

test('Apple Silicon setup uses native uv, Unix Python and Mac constraints, then activates atomically',()=>fixture(async root=>{
 const calls=[];let archive;
 const run=async(command,args,options)=>{calls.push({command,args,env:options?.env});if(args[0]==='venv'){await mkdir(join(args.at(-1),'bin'),{recursive:true});await writeFile(join(args.at(-1),'bin','python'),'synthetic');}if(args[0]?.endsWith('download_models.py')){await mkdir(args[1],{recursive:true});await writeFile(join(args[1],'ready.json'),'{}');}};
 const manager=createRuntimeManager({platform:'darwin',arch:'arm64',dataRoot:join(root,'data'),componentRoot:join(root,'components'),appRoot:join(root,'Reader.app'),sourceRoot:root,run,prepareTool:async path=>{archive=path;}});
 await manager.install();while(manager.busy)await new Promise(r=>setTimeout(r,5));
 assert.equal((await manager.status()).phase,'ready');assert.equal((await manager.status()).installSupported,true);
 assert.match(archive,/uv-aarch64-apple-darwin\.tar\.gz$/);
 assert.equal(calls[0].command,'/usr/bin/tar');
 assert.ok(calls.some(c=>basename(c.command)==='uv'&&c.args.includes('3.12')));
 assert.ok(calls.some(c=>c.args.includes(join(root,'python','constraints-macos-arm64.txt'))));
 assert.ok(!calls.some(c=>c.args.some(arg=>/\+cpu|windows\.txt|python\.exe/.test(arg))));
 assert.ok((await manager.current()).python.endsWith(join('venv','bin','python')));
}));

test('A corrupted Mac tool download is rejected before execution and preserves the active runtime',()=>fixture(async root=>{
 const old=join(root,'old');await macRuntime(old);let url,executed=false;
 const manager=createRuntimeManager({platform:'darwin',arch:'arm64',dataRoot:join(root,'data'),componentRoot:join(root,'components'),appRoot:join(root,'Reader.app'),legacyRoots:[old],fetchImpl:async target=>{url=target;return new Response('corrupted archive');},run:async()=>{executed=true;}});
 await manager.install();while(manager.busy)await new Promise(r=>setTimeout(r,5));
 assert.match(url,/astral-sh\/uv\/releases\/download\/0\.13\.1\/uv-aarch64-apple-darwin/);
 assert.equal(executed,false);assert.equal((await manager.current()).root,old);assert.match((await manager.status()).error,/校验失败/);
}));

test('Unsupported Intel Mac setup fails before downloading or changing an environment',()=>fixture(async root=>{
 let downloaded=false;const manager=createRuntimeManager({platform:'darwin',arch:'x64',dataRoot:join(root,'data'),componentRoot:join(root,'components'),appRoot:join(root,'Reader.app'),fetchImpl:()=>{downloaded=true;}});
 assert.equal((await manager.status()).installSupported,false);await assert.rejects(manager.install(),/Apple Silicon/);assert.equal(downloaded,false);
}));

test('A Windows Python directory is not reported as an available Mac runtime',()=>fixture(async root=>{
 await mkdir(join(root,'venv','Scripts'),{recursive:true});await writeFile(join(root,'venv','Scripts','python.exe'),'synthetic Windows binary');await mkdir(join(root,'models'));await writeFile(join(root,'models','ready.json'),'{}');
 assert.equal(await runtimeSpec(root,undefined,{platform:'darwin'}),null);
 assert.ok(await runtimeSpec(root,undefined,{platform:'win32'}));
 assert.equal(await createPdfService({runtimeRoot:root,platform:'darwin'}).available(),false);
 const mac=join(root,'mac');await macRuntime(mac);assert.equal(await runtimeSpec(mac,undefined,{platform:'win32'}),null);
}));

test('Cancelling a POSIX installer stops its subprocesses as well as its parent', {skip:process.platform==='win32',timeout:8000},()=>fixture(async root=>{
 const heartbeat=join(root,'heartbeat');const controller=new AbortController();let childPid,started;
 const ready=new Promise(resolve=>{started=resolve;});
 const childCode=`const fs=require('node:fs');setInterval(()=>fs.writeFileSync(${JSON.stringify(heartbeat)},String(Date.now())),20);`;
 const parentCode=`const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{stdio:'inherit'});console.log('CHILD:'+child.pid);setInterval(()=>{},1000);`;
 const running=runProcess(process.execPath,['-e',parentCode],{signal:controller.signal,onOutput:output=>{const match=output.match(/CHILD:(\d+)/);if(match){childPid=Number(match[1]);started();}}});
 const stopped=assert.rejects(running,error=>error.name==='AbortError');
 try{await ready;await new Promise(r=>setTimeout(r,150));controller.abort();await stopped;const before=await (await import('node:fs/promises')).readFile(heartbeat,'utf8');await new Promise(r=>setTimeout(r,150));assert.equal(await (await import('node:fs/promises')).readFile(heartbeat,'utf8'),before);}
 finally{controller.abort();if(childPid)try{process.kill(childPid,'SIGKILL');}catch{}}
}));
