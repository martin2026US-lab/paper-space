// One job per document. Results commit against the latest saved/manual state.
export function createPdfBackground({parse,apply,changed,canApply=()=>true,delay=ms=>new Promise(r=>setTimeout(r,ms))}){
  const jobs=new Map();let parseTail=Promise.resolve();let queued=0;
  function status(doc){return jobs.get(doc.id)?.status||null;}
  function start(doc){
    const previous=jobs.get(doc.id);if(previous?.promise&&previous.status.phase!=='error')return previous.promise;
    const job={status:{phase:queued?'queued':'running',message:queued?'等待前一份文献识别，原文可继续阅读':'正在后台识别结构，原文可继续阅读'}};jobs.set(doc.id,job);changed(doc,job.status);
    queued++;const parsedTask=parseTail.then(()=>{if(doc.deletedAt)return null;job.status={phase:'running',message:'正在后台识别结构，原文可继续阅读'};changed(doc,job.status);return parse(doc);});parseTail=parsedTask.catch(()=>{}).finally(()=>{queued--;});
    job.promise=(async()=>{try{
      const parsed=await parsedTask;job.status={phase:'waiting',message:'识别已完成，正在等待当前操作结束'};changed(doc,job.status);
      while(!doc.deletedAt&&!canApply(doc))await delay(100);
      if(doc.deletedAt){jobs.delete(doc.id);return false;}
      await apply(doc,parsed);jobs.delete(doc.id);changed(doc,null);return true;
    }catch(error){job.status={phase:'error',message:error.message||'结构识别失败'};changed(doc,job.status);return false;}})();
    return job.promise;
  }
  return {start,status};
}
