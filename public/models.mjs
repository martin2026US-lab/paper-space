import {endpointFor} from './context.mjs';
export function modelsEndpointFor(base,format='openai') {
  const url=new URL(endpointFor(base,format));
  url.pathname=url.pathname.replace(/\/(chat\/completions|messages)$/, '/models');
  return url.href;
}
export function normalizeModels(data) {
  const rows=Array.isArray(data)?data:data?.data||data?.models;
  if(!Array.isArray(rows))throw new Error('接口没有返回有效的模型列表。');
  const seen=new Set();return rows.flatMap(row=>{
    const id=typeof row==='string'?row:row?.id||row?.name;
    if(typeof id!=='string'||!id.trim()||id.length>300||seen.has(id))return[];
    seen.add(id);return[{id,name:typeof row?.display_name==='string'?row.display_name:typeof row?.name==='string'?row.name:id}];
  });
}
export function restoreProfiles(stored) {
  if(Array.isArray(stored?.profiles)) {
    const profiles=stored.profiles.filter(p=>p?.id&&p.baseUrl).map(p=>({id:String(p.id),name:String(p.name||'我的接口'),baseUrl:p.baseUrl,format:p.format==='anthropic'?'anthropic':'openai',models:normalizeModels(p.models||[]),model:p.model||''}));
    for(const p of profiles)if(!p.models.some(m=>m.id===p.model))p.model=p.models[0]?.id||'';
    return {profiles,activeId:profiles.some(p=>p.id===stored.activeId)?stored.activeId:profiles[0]?.id||''};
  }
  if(stored?.baseUrl&&stored.model) return {profiles:[{id:'migrated',name:'我的接口',baseUrl:stored.baseUrl,format:stored.format||'openai',model:stored.model,models:[{id:stored.model,name:stored.model}]}],activeId:'migrated'};
  return {profiles:[],activeId:''};
}
export function persistedProfiles(profiles,activeId) {
  // Allowlist metadata; credentials never enter browser storage.
  return {version:2,activeId,profiles:profiles.map(p=>({id:p.id,name:p.name,baseUrl:p.baseUrl,format:p.format,model:p.model,models:p.models.map(m=>({id:m.id,name:m.name}))}))};
}
