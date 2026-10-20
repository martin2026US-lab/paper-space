import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {access,mkdir,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const sourceRoot=fileURLToPath(new URL('./',import.meta.url));
export function validLayout(value){if(value?.parser!=='docling'||!Number.isInteger(value.pages)||value.pages<1||value.pages>500||!Array.isArray(value.blocks)||value.blocks.length>100000||value.blocks.some(b=>typeof b.text!=='string'||!Array.isArray(b.boxes)||b.boxes.some(x=>!Number.isInteger(x.page)||x.page<1||x.page>value.pages||![x.x,x.y,x.right,x.bottom,x.pageWidth,x.pageHeight].every(Number.isFinite)||x.pageWidth<=0||x.pageHeight<=0||x.right<x.x||x.bottom<x.y)))throw Error('Docling 未输出有效的文档结构。');return value;}
export function createPdfService({runtimeRoot=process.env.PAPER_SPACE_RUNTIME||resolve(sourceRoot,'runtime'),dataRoot=process.env.PAPER_SPACE_PDF_DATA||resolve(sourceRoot,'data'),runtimeProvider,spawnImpl=spawn}={}){
 const python=process.env.PAPER_SPACE_PYTHON||join(runtimeRoot,'python','python.exe'),models=join(runtimeRoot,'models'),cache=join(dataRoot,'pdf-cache');let running=null;
 async function configuration(){return runtimeProvider?runtimeProvider():{python,models,pythonPath:join(runtimeRoot,'docling','Lib','site-packages')};}
 async function available(){try{const spec=await configuration();if(!spec)return false;await access(spec.python);await access(join(spec.models,'ready.json'));return true;}catch{return false;}}
 async function parse(bytes,signal,{mode='fast',force=false,onProgress=()=>{}}={}){
  signal?.throwIfAborted();if(!await available())throw Error('本机 Docling 尚未准备完成，请打开文档识别设置。');mode=mode==='accurate'?'accurate':'fast';
  const key=createHash('sha256').update('docling-layout-v2:'+mode).update(bytes).digest('hex'),resultFile=join(cache,key+'.json');
  if(!force)try{const saved=validLayout(JSON.parse(await readFile(resultFile,'utf8')));onProgress({stage:'cache',message:'正在读取已校验的识别缓存'});return saved;}catch{}
  signal?.throwIfAborted();if(running)throw Error('另一份 PDF 正在本机解析，请稍后再试。');
  const reservation={kill(){}};running=reservation;const inputFile=join(cache,key+'-'+randomUUID()+'.pdf');let child;
  try{
   await mkdir(cache,{recursive:true});const {writeFile}=await import('node:fs/promises');await writeFile(inputFile,bytes);signal?.throwIfAborted();const spec=await configuration();if(!spec)throw Error('本机 Docling 尚未准备完成，请打开文档识别设置。');
   const result=await new Promise((resolveResult,reject)=>{
    child=spawnImpl(spec.python,[join(sourceRoot,'python','parse_pdf.py'),inputFile,resultFile,spec.models,mode],{windowsHide:true,env:{...process.env,PYTHONPATH:spec.pythonPath||'',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1',PYTHONUNBUFFERED:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',DO_NOT_TRACK:'1',OMP_NUM_THREADS:'4',TOKENIZERS_PARALLELISM:'false'}});running=child;
    let errorText='',output='',cancelled=false,timedOut=false,settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolveResult(value);};
    const abort=()=>{cancelled=true;child.kill();},timer=setTimeout(()=>{timedOut=true;child.kill();},15*60*1000);
    child.stderr.on('data',data=>{errorText=(errorText+data.toString()).slice(-4000);});
    child.stdout?.on('data',data=>{output+=data.toString();let at;while((at=output.indexOf('\n'))>=0){const line=output.slice(0,at);output=output.slice(at+1);try{const p=JSON.parse(line);if(p.type==='progress')onProgress({stage:p.stage,message:p.message});}catch{}}if(output.length>4000)output=output.slice(-4000);});
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    child.once('error',()=>finish(Error('无法启动本机 Docling 运行环境。')));
    child.once('close',async code=>{if(cancelled)return finish(new DOMException('本机 PDF 解析已停止。','AbortError'));if(timedOut)return finish(Error('本机 PDF 解析超时，请切换快速模式或重试。'));if(code!==0)return finish(Error('Docling 解析失败；原文仍保留。'+(errorText.includes('MODEL_MISSING')?' 本机模型文件不完整。':'')));try{finish(null,validLayout(JSON.parse(await readFile(resultFile,'utf8'))));}catch(error){finish(error);}});
   });return result;
  }finally{if(running===child||running===reservation)running=null;await rm(inputFile,{force:true}).catch(()=>{});}
 }
 return{available,parse,get busy(){return!!running;},close(){running?.kill();}};
}
