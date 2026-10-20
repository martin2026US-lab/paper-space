// Serial recognition jobs; a cancelled or superseded result can never commit.
export function createPdfBackground({parse,apply,changed,canApply=()=>true,capture=()=>({}),delay=ms=>new Promise(r=>setTimeout(r,ms))}){
 const jobs=new Map();let tail=Promise.resolve(),pending=0;
 const status=doc=>jobs.get(doc.id)?.status||null;
 function cancel(doc){const job=jobs.get(doc.id);if(!job||!job.promise||['error','cancelled'].includes(job.status.phase))return false;job.controller.abort();job.status={...job.status,phase:'cancelled',message:'已停止识别，原文和现有结构保留'};changed(doc,job.status);return true;}
 function start(doc,options={}){
  const previous=jobs.get(doc.id);if(previous?.promise&&!['error','cancelled'].includes(previous.status.phase))return previous.promise;
  options={...capture(doc),...options};const job={controller:new AbortController(),status:{phase:pending?'queued':'running',message:pending?'等待前一份文献识别，原文可继续阅读':'正在后台识别结构，原文可继续阅读',startedAt:Date.now()}};jobs.set(doc.id,job);changed(doc,job.status);pending++;
  const current=()=>jobs.get(doc.id)===job&&!job.controller.signal.aborted&&!doc.deletedAt;
  const update=(phase,message,extra={})=>{if(current()){job.status={...job.status,phase,message,...extra};changed(doc,job.status);}};
  const task=tail.then(async()=>{if(!current())return null;update('running','正在后台识别结构，原文可继续阅读');return parse(doc,{...options,signal:job.controller.signal,onProgress:progress=>update('running',progress.message||job.status.message,progress)});});
  tail=task.catch(()=>{}).finally(()=>pending--);
  job.promise=(async()=>{try{const result=await task;if(!current())return false;update('waiting','识别已完成，正在等待当前操作结束');while(current()&&!canApply(doc))await delay(100);if(!current())return false;await apply(doc,result);if(jobs.get(doc.id)===job){jobs.delete(doc.id);changed(doc,null);}return true;}catch(error){if(current()){job.status={...job.status,phase:'error',message:error.message||'结构识别失败'};changed(doc,job.status);}return false;}})();return job.promise;
 }
 return{start,status,cancel};
}
