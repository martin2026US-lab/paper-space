import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {access,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceRoot=fileURLToPath(new URL('./',import.meta.url));
export function createPdfService({runtimeRoot=process.env.PAPER_SPACE_RUNTIME||resolve(sourceRoot,'runtime'),dataRoot=process.env.PAPER_SPACE_PDF_DATA||resolve(sourceRoot,'data')}={}){
  const python=process.env.PAPER_SPACE_PYTHON||join(runtimeRoot,'python','python.exe'),models=join(runtimeRoot,'models'),cache=join(dataRoot,'pdf-cache');
  let running=null;
  async function available(){try{await access(python);await access(join(models,'ready.json'));return true;}catch{return false;}}
  async function parse(bytes,signal){
    if(!await available())throw Error('本机 Docling 运行环境尚未准备完成，请按 README 配置可选的本机识别环境。');
    const key=createHash('sha256').update('docling-layout-v1').update(bytes).digest('hex'),resultFile=join(cache,key+'.json');
    try{return JSON.parse(await readFile(resultFile,'utf8'));}catch{}
    if(running)throw Error('另一份 PDF 正在本机解析，请稍后再试。');
    running={kill(){}};const inputFile=join(cache,key+'.pdf');let child;
    try{
      await mkdir(cache,{recursive:true});await writeFile(inputFile,bytes);
      const result=await new Promise((resolveResult,reject)=>{
        child=spawn(python,[join(sourceRoot,'python','parse_pdf.py'),inputFile,resultFile,models],{windowsHide:true,env:{...process.env,PYTHONPATH:join(runtimeRoot,'docling','Lib','site-packages'),PYTHONNOUSERSITE:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',DO_NOT_TRACK:'1',OMP_NUM_THREADS:'4',TOKENIZERS_PARALLELISM:'false'}});running=child;
        let errorText='';child.stderr.on('data',data=>{errorText=(errorText+data.toString()).slice(-4000);});
        let cancelled=false;const abort=()=>{cancelled=true;child.kill();};
        signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
        const timer=setTimeout(()=>{child.kill();reject(Error('本机 PDF 解析超时，请尝试较小的文件。'));},15*60*1000);
        child.once('error',()=>reject(Error('无法启动本机 Docling 运行环境。')));
        child.once('close',async code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(cancelled)return reject(Error('本机 PDF 解析已停止。'));if(code!==0)return reject(Error('Docling 解析失败；原文仍保留。'+(errorText.includes('MODEL_MISSING')?' 本机模型文件不完整。':'')));try{resolveResult(JSON.parse(await readFile(resultFile,'utf8')));}catch{reject(Error('Docling 未输出有效的文档结构。'));}});
      });
      return result;
    }finally{running=null;await rm(inputFile,{force:true}).catch(()=>{});}
  }
  return{available,parse,close(){running?.kill();}};
}
