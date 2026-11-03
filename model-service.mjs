import {endpointFor} from './public/context.mjs';
export async function requestChat(config,messages,{signal,fetchImpl=fetch}={}){
 const endpoint=endpointFor(config.baseUrl,config.format);
 if(!config.model||!Array.isArray(messages)||!messages.length||messages.length>80)throw Error('请配置模型，并提供有效的对话内容。');
 const imageOk=p=>p.type==='image_url'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(p.image_url?.url||'')&&p.image_url.url.length<=2_000_000;
 if(messages.some(m=>!['system','user','assistant'].includes(m.role)||!(typeof m.content==='string'||m.role==='user'&&Array.isArray(m.content)&&m.content.length<=12&&m.content.every(p=>p.type==='text'?typeof p.text==='string':imageOk(p)))))throw Error('消息格式不正确；原图必须是本机生成的图片。');
 if(messages.flatMap(m=>Array.isArray(m.content)?m.content:[]).filter(p=>p.type==='image_url').length>8)throw Error('一次最多发送 8 张原图。');
 const headers={'Content-Type':'application/json'};
 let payload={model:config.model,messages,stream:false};
 if(config.format==='anthropic'){
  headers['anthropic-version']='2023-06-01';if(config.apiKey)headers['x-api-key']=config.apiKey;
  payload={model:config.model,max_tokens:4096,system:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n'),messages:messages.filter(m=>m.role!=='system').map(m=>({...m,content:Array.isArray(m.content)?m.content.map(p=>{if(p.type==='text')return p;const [,media_type,data]=p.image_url.url.match(/^data:([^;]+);base64,(.+)$/);return {type:'image',source:{type:'base64',media_type,data}};}):m.content}))};
 }else if(config.apiKey)headers.Authorization='Bearer '+config.apiKey;
 const response=await fetchImpl(endpoint,{method:'POST',headers,body:JSON.stringify(payload),redirect:'error',signal});
 let result;try{result=await response.json();}catch{throw Error('模型服务未返回 JSON（HTTP '+response.status+'）。请检查接口地址。');}
 if(!response.ok)throw Error('模型服务 HTTP '+response.status+'：请检查接口、模型名称、密钥和额度。');
 const text=config.format==='anthropic'?result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n'):result.choices?.[0]?.message?.content;
 if(typeof text!=='string'||!text.trim())throw Error('模型没有返回文本。请检查模型名称或接口格式。');
 return{text,usage:result.usage||null};
}
