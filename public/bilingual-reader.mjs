import {uiText as t,uiError} from './ui-language.mjs';
import {readingUnits,pageFragment,pageRange} from './reading-units.mjs';
import {renderWordBlock} from './word-import.mjs';
import {translationCacheKey} from './translation-config.mjs';
import {outputLanguage} from './output-language.mjs';
export function createBilingualReader({state,getConfig,translate,saveDoc,showSettings,toast,onBusy=()=>{}}){
 let controller,epoch=0,running=false,resetControls=()=>{};
 function cancel(){epoch++;controller?.abort();controller=null;if(running){running=false;onBusy(false);}resetControls();}
 function render(host){cancel();const serial=epoch,doc=state.doc,page=state.page,config=structuredClone(getConfig()),rows=[];
  const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const view=el('article','bilingual-view'),bar=el('header','bilingual-toolbar'),heading=el('div','',t('段落双语阅读'));bar.append(heading);const target=el('small','',outputLanguage(config.targetLanguage).label),all=el('button','button',t('翻译本页')),stop=el('button','button',t('停止'));all.id='bilingualTranslatePage';stop.id='bilingualStop';stop.hidden=true;resetControls=()=>{all.disabled=false;all.textContent=t('翻译本页');stop.hidden=true;for(const row of rows){row.button.disabled=false;if(row.result.getAttribute('aria-busy')==='true'){row.result.setAttribute('aria-busy','false');row.result.textContent=t('已取消。');}}};stop.onclick=cancel;bar.append(target,all,stop);view.append(bar,el('p','bilingual-hint',t('译文按需生成，切换到双语视图不会自动发送原文。PDF 原版可随时在“原文阅读”中查看。')));
  const units=readingUnits(doc).filter(b=>pageFragment(b,page)&&!b.artifact);for(const unit of units){const section=el('section','bilingual-unit');section.dataset.blockId=unit.id;section.dataset.page=page;const source=renderWordBlock(unit,document);source.classList.add('bilingual-source');source.dir='auto';section.append(source);if(unit.crossPage)section.append(el('small','cross-page-label',t('完整跨页段落 · {0}',pageRange(unit))));
   if(!unit.heading){const tools=el('div','bilingual-actions'),button=el('button','button',t('翻译本段')),collapse=el('button','button quiet',t('收起译文')),result=el('div','bilingual-target');button.classList.add('bilingual-translate-one');result.dir='auto';result.setAttribute('role','status');collapse.hidden=true;let key;try{key=translationCacheKey(unit.text,config,'paragraph');}catch{}
    const cached=key&&doc.translations?.[key];if(cached){result.textContent=cached;button.hidden=true;collapse.hidden=false;}else result.hidden=true;
    collapse.onclick=()=>{result.hidden=!result.hidden;collapse.textContent=result.hidden?t('展开译文'):t('收起译文');};tools.append(button,collapse);section.append(tools,result);rows.push({unit,key,button,collapse,result});button.onclick=()=>run([rows.find(r=>r.unit===unit)]);
   }view.append(section);
  }if(!units.length)view.append(el('p','',t('本页尚无可用段落，请先识别文档结构。')));host.append(view);
  async function run(selected){if(running||state.busy||state.mutating)return toast(t('请先结束当前任务。'));if(['ollama','ai','inherit'].includes(config.provider)&&!config.model){showSettings();return;}
   controller=new AbortController();const signal=controller.signal;running=true;onBusy(true);all.disabled=true;stop.hidden=false;for(const r of rows)r.button.disabled=true;
   try{let n=0;for(const row of selected){if(signal.aborted||epoch!==serial||state.doc!==doc)break;if(row.key&&doc.translations?.[row.key])continue;row.result.hidden=false;row.result.textContent=t('正在翻译整个段落…');row.result.setAttribute('aria-busy','true');try{if(!row.key)throw Error(t('请先配置翻译服务。'));if(row.unit.text.length>24000)throw Error(t('这段原文超过 24,000 字符，请选择较短内容。'));const text=await translate(row.unit.text,config,{scope:'paragraph',signal});if(signal.aborted||epoch!==serial||state.doc!==doc)break;doc.translations||={};doc.translations[row.key]=text;await saveDoc(doc);row.result.textContent=text;row.button.hidden=true;row.collapse.hidden=false;}catch(e){if(e.name==='AbortError')break;row.result.textContent=uiError(e.message);}finally{row.result.setAttribute('aria-busy','false');}n++;all.textContent=t('翻译进度 {0}/{1}',n,selected.length);}
   }finally{if(epoch===serial){running=false;controller=null;onBusy(false);all.disabled=false;all.textContent=t('翻译本页');stop.hidden=true;for(const r of rows)r.button.disabled=false;}}
  }
  all.onclick=()=>run(rows);return view;
 }
 return{render,cancel,get busy(){return running;}};
}
