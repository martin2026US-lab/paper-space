import {validLayout} from './pdf-service.mjs';
import {recognitionUrl,cleanRecognitionSettings} from './public/recognition-config.mjs';
function config(input){const clean=cleanRecognitionSettings(input),base=recognitionUrl(clean.baseUrl);if(input.apiKey!==undefined&&(typeof input.apiKey!=='string'||input.apiKey.length>8192||/[\r\n]/.test(input.apiKey)))throw Error('无效识别服务密钥。');return{...clean,base,apiKey:input.apiKey||''};}
async function responseJson(response){if(!response.ok)throw Error('识别服务 HTTP '+response.status+'：请检查地址、密钥和服务状态。');const size=Number(response.headers.get('content-length'));if(size>40000000)throw Error('识别结果过大。');const reader=response.body.getReader(),chunks=[];let total=0;for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>40000000){await reader.cancel();throw Error('识别结果过大。');}chunks.push(value);}try{return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));}catch{throw Error('识别服务未返回有效 JSON。');}}
export async function recognitionCapabilities(input,{signal,fetchImpl=fetch}={}){const c=config(input);const response=await fetchImpl(c.base+'/v1/capabilities',{headers:{Accept:'application/json',...(c.apiKey?{'X-Api-Key':c.apiKey}:{})},redirect:'error',signal});const data=await responseJson(response);return{available:true,formats:Array.isArray(data.output_formats)?data.output_formats.filter(v=>typeof v==='string'):[],api:'docling-v1'};}
export function normalizeDoclingResponse(data){
 if(!['success','partial_success'].includes(data?.status))throw Error('识别服务未成功完成，现有文档结构已保留。');
 const doc=data.document?.json_content;if(!doc||!doc.pages||!doc.body)throw Error('识别结果缺少 Docling JSON 结构，请检查服务输出格式。');
 const pages=Object.values(doc.pages),blocks=[],visited=new Set();if(!pages.length||pages.length>500)throw Error('识别结果页数无效。');
 const resolve=ref=>{const m=/^#\/(texts|tables|groups)\/(\d+)$/.exec(ref||'');return m?doc[m[1]]?.[Number(m[2])]:null;};
 function walk(item,depth=0){if(!item||depth>40)return;const ref=item.self_ref;if(ref&&visited.has(ref))return;if(ref)visited.add(ref);
  if(['table','picture'].includes(item.label)&&item.label==='picture')return;
  let text=item.text||'';if(item.label==='table'){const cells=item.data?.table_cells||[];const rows=new Map();for(const cell of cells){const r=cell.start_row_offset||0;if(!rows.has(r))rows.set(r,[]);rows.get(r).push(String(cell.text||''));}text=[...rows].sort((a,b)=>a[0]-b[0]).map(([,r])=>r.join(' | ')).join('\n');}
  if(typeof text==='string'&&text.trim()&&Array.isArray(item.prov)){const boxes=item.prov.map(p=>{const page=doc.pages[p.page_no],w=page?.size?.width,h=page?.size?.height,b=p.bbox;if(!b||![w,h,b.l,b.t,b.r,b.b].every(Number.isFinite)||w<=0||h<=0)return null;const bottom=b.coord_origin==='BOTTOMLEFT';return{page:p.page_no,x:b.l,y:bottom?h-b.t:b.t,right:b.r,bottom:bottom?h-b.b:b.b,pageWidth:w,pageHeight:h};}).filter(Boolean);if(boxes.length)blocks.push({sourceRef:ref,kind:item.label||'text',text,boxes});}
  for(const child of item.children||[])walk(resolve(child.$ref),depth+1);
 }walk(doc.body);if(!blocks.length)throw Error('识别没有获得有效段落，原文与现有结构已保留。');return{parser:'docling',layoutVersion:1,pages:pages.length,blocks,warnings:data.status==='partial_success'?['部分页面识别未完成，请核对原文。']:[]};
}
export async function recognizeRemote(bytes,input,{signal,fetchImpl=fetch}={}){
 const c=config(input),form=new FormData();form.append('files',new Blob([bytes],{type:'application/pdf'}),'document.pdf');for(const [key,value]of Object.entries({to_formats:'json',from_formats:'pdf',image_export_mode:'placeholder',do_ocr:String(c.ocr),do_formula_enrichment:String(c.mode==='accurate'),do_table_structure:'true',include_images:'false',include_page_images:'false',abort_on_error:'false'}))form.append(key,value);
 const response=await fetchImpl(c.base+'/v1/convert/file',{method:'POST',headers:{Accept:'application/json',...(c.apiKey?{'X-Api-Key':c.apiKey}:{})},body:form,redirect:'error',signal});return validLayout(normalizeDoclingResponse(await responseJson(response)));
}
