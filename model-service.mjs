import {endpointFor} from './public/context.mjs';
export async function requestChat(config,messages,{signal,fetchImpl=fetch}={}){
 const endpoint=endpointFor(config.baseUrl,config.format);
 if(!config.model||!Array.isArray(messages)||!messages.length||messages.length>80)throw Error('请配置模型，并提供有效的对话内容。');
 if(messages.some(m=>!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'))throw Error('消息格式不正确。');
 const headers={'Content-Type':'application/json'};
 let payload={model:config.model,messages,stream:false};
 if(config.format==='anthropic'){
  headers['anthropic-version']='2023-06-01';if(config.apiKey)headers['x-api-key']=config.apiKey;
  payload={model:config.model,max_tokens:4096,system:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n'),messages:messages.filter(m=>m.role!=='system')};
 }else if(config.apiKey)headers.Authorization='Bearer '+config.apiKey;
 const response=await fetchImpl(endpoint,{method:'POST',headers,body:JSON.stringify(payload),redirect:'error',signal});
 let result;try{result=await response.json();}catch{throw Error('模型服务未返回 JSON（HTTP '+response.status+'）。请检查接口地址。');}
 if(!response.ok)throw Error('模型服务 HTTP '+response.status+'：请检查接口、模型名称、密钥和额度。');
 const text=config.format==='anthropic'?result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n'):result.choices?.[0]?.message?.content;
 if(typeof text!=='string'||!text.trim())throw Error('模型没有返回文本。请检查模型名称或接口格式。');
 return{text,usage:result.usage||null};
}
