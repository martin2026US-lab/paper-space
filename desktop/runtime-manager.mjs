import {mkdir,readFile,writeFile,rename,access} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {isPathInside} from './paths.mjs';
export const DOCLING_VERSION='2.132.0';
export const OFFICIAL_DOCLING='https://github.com/docling-project/docling';
const UV_TOOLS={
 'win32-x64':{asset:'uv-x86_64-pc-windows-msvc.zip',sha:'3b2661a463a5baea7f5076ea2b25ab71d77f36a6c0d809e5350651792f80a672',executable:'uv.exe'},
 'darwin-arm64':{asset:'uv-aarch64-apple-darwin.tar.gz',sha:'cfe454573412ff7380d15fc7dae5997ab53ffce72fce0a78e91ddbc84001acd2',executable:'uv-aarch64-apple-darwin/uv'},
};
const exists=async path=>access(path).then(()=>true,()=>false);
export async function runtimeSpec(root,pythonOverride,{platform=process.platform}={}){if(!root)return null;const candidates=pythonOverride?[pythonOverride]:platform==='win32'?[join(root,'venv','Scripts','python.exe'),join(root,'Scripts','python.exe'),join(root,'python','python.exe')]:[join(root,'venv','bin','python'),join(root,'bin','python')];for(const python of candidates)if(await exists(python)&&await exists(join(root,'models','ready.json')))return{root:resolve(root),python,models:join(root,'models'),pythonPath:python===join(root,'python','python.exe')?join(root,'docling','Lib','site-packages'):''};return null;}
export function externalComponentRoot(installDirectory,{platform=process.platform,dataRoot}={}){return platform==='darwin'?join(resolve(dataRoot),'components'):join(dirname(resolve(installDirectory)),'PaperSpace-components');}
export function runProcess(command,args,{env,signal,onOutput=()=>{}}={}){return new Promise((resolveRun,reject)=>{
 const child=spawn(command,args,{env:{...process.env,...env},windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});let output='',settled=false;
 const abort=()=>{if(process.platform==='win32'&&child.pid)spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else if(child.pid){try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}}};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk.toString()).slice(-6000);onOutput(output);});
 const finish=error=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);error?reject(error):resolveRun(output);};child.once('error',finish);child.once('close',code=>{if(signal?.aborted){const error=Error('安装已取消。');error.name='AbortError';return finish(error);}finish(code===0?null:Error('组件安装命令失败。\n'+output.slice(-2500)));});
 });}
export function createRuntimeManager({dataRoot,componentRoot,legacyRoots=[],appRoot,sourceRoot,fetchImpl=fetch,run=runProcess,prepareTool,platform=process.platform,arch=process.arch}={}){
 const tool=UV_TOOLS[platform+'-'+arch];
 const file=join(dataRoot,'docling-runtime.json');let active=null,installRoot=resolve(componentRoot),loaded=false,operation=null,controller;
 let state={phase:'idle',stage:'idle',progress:null,error:'',log:''};
 async function load(){if(loaded)return;loaded=true;try{const saved=JSON.parse(await readFile(file,'utf8'));if(saved.installRoot)installRoot=resolve(saved.installRoot);if(saved.root)active=await runtimeSpec(saved.root,undefined,{platform});}catch{}if(!active)for(const root of [join(componentRoot,'docling-legacy'),...legacyRoots]){active=await runtimeSpec(root,undefined,{platform});if(active)break;}}
 async function persist(){await mkdir(dataRoot,{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify({version:1,installRoot,root:active?.root||null}));await rename(tmp,file);}
 async function current(){await load();return active;}
 async function status(){await load();return{...state,busy:!!operation,available:!!active,installSupported:!!tool,root:active?.root||null,installRoot,version:DOCLING_VERSION,official:OFFICIAL_DOCLING};}
 function validateLocation(root){const target=resolve(root);if(isPathInside(resolve(appRoot),target))throw Error('识别组件需要保存在程序目录之外。');return target;}
 async function setLocation(root){await load();if(operation)throw Error('请等待组件操作结束。');installRoot=validateLocation(root);await persist();return status();}
 async function configure(root){await load();if(operation)throw Error('请等待组件操作结束。');validateLocation(root);const spec=await runtimeSpec(root,undefined,{platform});if(!spec)throw Error('未找到完整的 Docling 环境，请选择包含 models 和 Python 环境的目录。');
  await run(spec.python,['-c','from docling.document_converter import DocumentConverter; from docling.datamodel.pipeline_options import PdfPipelineOptions; print("PAPER_SPACE_DOCLING_OK")'],{env:{PYTHONPATH:spec.pythonPath,PYTHONNOUSERSITE:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1'},signal:AbortSignal.timeout(60000)});const previous=active;active=spec;try{await persist();}catch(error){active=previous;throw error;}return status();}
 async function downloadUV(target,signal){
  if(await exists(target)){const hash=createHash('sha256');for await(const chunk of createReadStream(target))hash.update(chunk);if(hash.digest('hex')===tool.sha)return;}
  const response=await fetchImpl('https://github.com/astral-sh/uv/releases/download/0.13.1/'+tool.asset,{signal});if(!response.ok)throw Error('无法从官方仓库下载工具：HTTP '+response.status);const total=Number(response.headers.get('content-length'))||15308685,part=target+'.partial';let bytes=0;const hash=createHash('sha256');
  const source=Readable.fromWeb(response.body);source.on('data',chunk=>{bytes+=chunk.length;if(bytes>60_000_000)source.destroy(Error('下载文件超过预期大小。'));hash.update(chunk);state.progress=Math.min(99,Math.floor(bytes/total*100));});await pipeline(source,createWriteStream(part),{signal});if(hash.digest('hex')!==tool.sha)throw Error('官方工具下载校验失败，请重试。');await rename(part,target);
 }
 async function install(){await load();if(operation)return status();if(!tool)throw Error('一键安装支持 Windows x64 和 Apple Silicon Mac。');const root=validateLocation(installRoot);controller=new AbortController();const signal=controller.signal;
  const task=async()=>{state={phase:'installing',stage:'download',progress:0,error:'',log:''};try{
   await mkdir(root,{recursive:true});const tools=join(root,'tools');await mkdir(tools,{recursive:true});const archive=join(tools,'0.13.1-'+tool.asset);if(prepareTool)await prepareTool(archive,signal);else await downloadUV(archive,signal);
   state.stage='python';state.progress=null;await run(platform==='win32'?'tar.exe':'/usr/bin/tar',['-xf',archive,'-C',tools],{signal});const uv=join(tools,tool.executable);
   const env={UV_PYTHON_INSTALL_DIR:join(root,'python-managed'),UV_PYTHON_BIN_DIR:join(root,'bin'),UV_NO_CONFIG:'1',UV_EXTRA_INDEX_URL:'',PIP_EXTRA_INDEX_URL:'',HF_ENDPOINT:'https://huggingface.co',HF_HUB_DISABLE_IMPLICIT_TOKEN:'1',HF_HUB_OFFLINE:'0',TRANSFORMERS_OFFLINE:'0',UV_CACHE_DIR:join(root,'cache','uv'),UV_NO_PROGRESS:'1',HF_HOME:join(root,'cache','huggingface'),HF_HUB_DISABLE_TELEMETRY:'1',DO_NOT_TRACK:'1',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1'};
   const options={env,signal,onOutput:output=>{state.log=output;}};await run(uv,['python','install','3.12','--no-bin','--no-registry'],options);
   const staged=join(root,'docling-'+DOCLING_VERSION+'-'+randomUUID().slice(0,8));await run(uv,['venv','--python','3.12','--managed-python',join(staged,'venv')],options);const python=platform==='win32'?join(staged,'venv','Scripts','python.exe'):join(staged,'venv','bin','python');
   state.stage='dependencies';if(platform==='win32')await run(uv,['pip','install','--python',python,'--index-url','https://download.pytorch.org/whl/cpu','torch==2.14.1+cpu','torchvision==0.29.1+cpu'],options);await run(uv,['pip','install','--python',python,'--index-url','https://pypi.org/simple','--constraint',join(sourceRoot,'python',platform==='win32'?'constraints-windows.txt':'constraints-macos-arm64.txt'),'docling=='+DOCLING_VERSION],options);
   state.stage='models';await run(python,[join(sourceRoot,'python','download_models.py'),join(staged,'models')],options);
   state.stage='verify';await run(python,['-c','from docling.document_converter import DocumentConverter; from docling.datamodel.pipeline_options import PdfPipelineOptions; print("PAPER_SPACE_DOCLING_OK")'],options);
   const next=await runtimeSpec(staged,undefined,{platform});if(!next)throw Error('Docling 安装验证失败。');if(signal.aborted)throw Error('安装已取消。');const previous=active;active=next;try{await persist();}catch(error){active=previous;throw error;}state={phase:'ready',stage:'ready',progress:100,error:'',log:''};
  }catch(error){state.phase=signal.aborted?'cancelled':'error';state.error=error.message;state.progress=null;}finally{operation=null;controller=null;}};
  operation=task();return status();
 }
 function cancel(){controller?.abort();return{ok:true};}
 return{current,status,setLocation,configure,install,cancel,get busy(){return!!operation;}};
}
