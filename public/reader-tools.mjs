import {uiText,uiHTML,uiError,uiDateLocale} from './ui-language.mjs';
import {translationCacheKey,providerLabel} from './translation-config.mjs';
import {outputLanguage,noteInLanguage} from './output-language.mjs';
import {readingUnit,pageFragment,pageRange} from './reading-units.mjs';
import {paragraphCandidates} from './paragraph-notes.mjs';
import {splitSentences,RequestSlot} from './sentences.mjs';
import {renderMarkdown} from './rich-text.mjs';
import {highlightSource} from './highlight.mjs';
import {pdfBlockSpans} from './pdf-text.mjs';
const create=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(cls==='card-explanation')e.dir='auto';if(text!==undefined)e.textContent=text;return e;};
const action=(label,fn,cls='button')=>{const e=create('button',cls,label);e.onclick=fn;return e;};
export function createReaderTools({state,callModel,saveDoc,showSettings,discuss,locate,generate,getTranslationConfig,translateText,showTranslationSettings}){
  const slot=new RequestSlot();let drawer,popup,pointer,timer,activeButton,translationButton;
  const reading=document.querySelector('.reading'),host=document.getElementById('readingContent');
  function closeTranslation(restoreFocus=false){clearTimeout(timer);slot.cancel();popup?.remove();popup=null;translationButton?.setAttribute('aria-expanded','false');if(restoreFocus&&translationButton?.isConnected)translationButton.focus({preventScroll:true});translationButton=null;host.querySelectorAll('.sentence-highlight,.paragraph-translation-highlight').forEach(e=>e.remove());host.querySelectorAll('.translation-located').forEach(e=>e.classList.remove('translation-located'));}
  function closeDrawer(){drawer?.remove();drawer=null;activeButton?.setAttribute('aria-expanded','false');activeButton=null;host.querySelectorAll('.source-highlight').forEach(e=>e.remove());host.querySelectorAll('.source-located').forEach(e=>e.classList.remove('source-located'));}
  function reset(){closeTranslation();closeDrawer();}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeTranslation(true);closeDrawer();}});
  async function openCard(card,button){card=state.doc.cards.find(c=>c.blockId===card.blockId&&noteInLanguage(c,state.outputLanguage))||card;if(card.pending){if(!state.config.model){showSettings();return;}if(state.busy)return;closeDrawer();closeTranslation();activeButton=button;button.setAttribute('aria-expanded','true');const doc=state.doc,block=readingUnit(doc,card.blockId);highlightSource(block,{scroll:false});drawer=create('aside','annotation-drawer');drawer.append(create('strong','',uiText("正在解读这段内容…")),action('×',closeDrawer,'dialog-close'));const pending=drawer;reading.append(drawer);try{const generated=await generate(block);if(drawer===pending&&state.doc===doc){button.classList.remove('pending-note');button.title=generated.title;card=generated;}}catch(e){if(drawer===pending){pending.replaceChildren(create('p','',uiError(e.message)),action(uiText("关闭"),closeDrawer));}return;}if(drawer!==pending||state.doc!==doc)return;}closeDrawer();closeTranslation();activeButton=button;button.setAttribute('aria-expanded','true');const block=readingUnit(state.doc,card.blockId);highlightSource(block,{scroll:false});drawer=create('aside','annotation-drawer');drawer.id='annotationDrawer';drawer.setAttribute('aria-label',uiText("段落解读"));const heading=create('div','reader-overlay-heading');heading.append(create('strong','',card.demo?uiText("旁注解读 · 示例"):uiText("旁注解读")),action('×',closeDrawer,'dialog-close'));heading.lastChild.setAttribute('aria-label',uiText("关闭段落解读"));drawer.append(heading,create('small','',card.category||uiText("段落解读")),create('h3','',card.title),renderMarkdown(create('div','card-explanation'),card.explanation));const actions=create('div','card-actions');actions.append(action(uiText("继续讨论"),()=>discuss(block,card),''),action(uiText("定位原文"),()=>{highlightSource(block);},''));if(block?.crossPage){drawer.append(create('p','cross-page-label',uiText("跨页段落 · 第 {0} 页", pageRange(block))));for(const part of block.sourceSegments)actions.append(action(uiText("第 {0} 页原文", part.page),()=>locate(part),''));}drawer.append(actions);const source=create('details','annotation-source');source.append(create('summary','',uiText("查看本次解读的原文")),create('pre','',card.sourceText||block?.text||''));drawer.append(source);reading.append(drawer);drawer.querySelector('.dialog-close').focus();}
  function attach(){
    const paper=host.querySelector('.paper-column');if(!paper||state.view!=='original')return;paper.querySelectorAll('.paragraph-actions').forEach(e=>e.remove());
    const sheet=paper.querySelector('.paper-sheet'),pdf=sheet.querySelector('.pdf-page'),scale=pdf?Number(pdf.style.getPropertyValue('--scale-factor')):1;
    const pageBlocks=state.doc.blocks.filter(b=>b.page===state.page),columns=pdf&&pageBlocks.some(b=>b.column===1),leftEdge=Math.max(...pageBlocks.filter(b=>b.column===0&&!b.heading&&!b.artifact).map(b=>b.right)),rightEdge=Math.min(...pageBlocks.filter(b=>b.column===1&&!b.heading&&!b.artifact).map(b=>b.x));
    const candidates=paragraphCandidates(state.doc,state.page).filter(b=>state.doc.type!=='pdf'||state.doc.parser==='docling'||b.recovered);const notes=candidates.map(b=>state.doc.cards.find(c=>c.blockId===b.id&&noteInLanguage(c,state.outputLanguage))||{blockId:b.id,page:b.page,pending:true,title:(b.kind==='formula'?uiText("解读公式"):b.kind==='table'?uiText("解读表格"):uiText("解读段落"))+'：'+b.text.slice(0,50)});const cards=notes.concat(state.doc.type==='pdf'&&state.doc.parser!=='docling'?state.doc.cards.filter(c=>c.page===state.page&&!notes.some(n=>n.blockId===c.blockId)):[]).map(c=>{const b=pageFragment(readingUnit(state.doc,c.blockId),state.page);const p=[...sheet.querySelectorAll('.word-block')].find(p=>p.dataset.blockId===c.blockId);return{c,b,top:pdf?pdf.getBoundingClientRect().top-paper.getBoundingClientRect().top+(b?.y||0)*scale:p?p.getBoundingClientRect().top-paper.getBoundingClientRect().top:sheet.offsetTop};}).filter(item=>item.b).sort((a,b)=>a.top-b.top);
    const previous=new Map();for(const {c,b,top}of cards){
      const group=create('div','paragraph-actions');group.dataset.blockId=c.blockId;
      const marker=action('✧',()=>{if(!state.mutating)openCard(c,marker);},'paragraph-note'+(c.pending?' pending-note':''));
      marker.title=(readingUnit(state.doc,c.blockId)?.crossPage?uiText("跨页段落 · "):'')+c.title;marker.setAttribute('aria-label',uiText("解读段落：{0}", c.title));marker.setAttribute('aria-expanded','false');marker.setAttribute('aria-controls','annotationDrawer');marker.dataset.blockId=c.blockId;
      const translateButton=action(uiText("译"),()=>{if(!state.mutating)translateParagraph(c.blockId,translateButton);},'paragraph-translate');
      translateButton.title=uiText("翻译整段为{0}", outputLanguage(getTranslationConfig().targetLanguage).label);translateButton.setAttribute('aria-label',uiText("翻译整段：{0}", b.text.slice(0,50)));translateButton.setAttribute('aria-expanded','false');translateButton.setAttribute('aria-controls','translationPopup');translateButton.dataset.blockId=c.blockId;
      group.append(marker,translateButton);
      const lane=columns&&(rightEdge-leftEdge)*scale>=18?b.column:0,compact=columns&&b.column===0&&Number.isFinite(leftEdge+rightEdge)&&(rightEdge-leftEdge)*scale>=18,y=Math.max(top,(previous.get(lane)??-60)+(compact?56:34));previous.set(lane,y);group.style.top=y+'px';
      if(compact){const width=Math.max(14,Math.min(28,(rightEdge-leftEdge)*scale-4));group.classList.add('compact-actions');group.style.right='auto';group.style.left=(pdf.getBoundingClientRect().left-paper.getBoundingClientRect().left+(leftEdge+rightEdge)/2*scale-width/2)+'px';group.style.width=width+'px';}
      paper.append(group);
    }
  }
  function textMap(block){
    const word=[...host.querySelectorAll('.word-block')].find(p=>p.dataset.blockId===block.id);
    if(word){let text='';const segments=[],walker=document.createTreeWalker(word,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){if(text)text+=' ';const start=text.length;text+=n.textContent;segments.push({node:n,start,end:text.length});}return{text,segments};}
    const page=host.querySelector('.pdf-page');if(!page)return null;const scale=Number(page.style.getPropertyValue('--scale-factor')),r=page.getBoundingClientRect();
    const spans=pdfBlockSpans(page,block).map(e=>{const rect=e.getBoundingClientRect();return{e,rect,x:(rect.left-r.left)/scale,y:(rect.top-r.top)/scale};}).sort((a,b)=>Math.abs(a.y-b.y)<3?a.x-b.x:a.y-b.y);
    let text='';const segments=[];for(const s of spans){if(text)text+=' ';const start=text.length;text+=s.e.textContent;segments.push({node:s.e.firstChild,start,end:text.length,element:s.e});}return{text,segments};
  }
  function clickedSentence(event){
    const target=event.target.closest('.word-block,.textLayer span');if(!target)return null;
    const pos=document.caretPositionFromPoint?.(event.clientX,event.clientY),range=pos?null:document.caretRangeFromPoint?.(event.clientX,event.clientY);const textNode=pos?.offsetNode||range?.startContainer,offset=pos?.offset??range?.startOffset;
    if(!textNode||textNode.nodeType!==3)return null;
    let block=state.doc.blocks.find(b=>b.id===(target.closest('.word-block')?.dataset.blockId||target.dataset.blockId));
    if(!block){const page=host.querySelector('.pdf-page'),r=page.getBoundingClientRect(),scale=Number(page.style.getPropertyValue('--scale-factor'));const x=(event.clientX-r.left)/scale,y=(event.clientY-r.top)/scale;block=state.doc.blocks.filter(b=>b.page===state.page&&b.y!==undefined&&y>=b.y-5&&y<=b.bottom+5&&x>=b.x-8&&x<=(b.right||b.x+page.clientWidth/scale)+8).sort((a,b)=>Math.abs(x-a.x)-Math.abs(x-b.x))[0];}
    if(!block)return null;const map=textMap(block);const segment=map?.segments.find(s=>s.node===textNode);if(!segment)return null;const at=segment.start+offset;const sentence=splitSentences(map.text).find(s=>at>=s.start&&at<=s.end);return sentence?{sentence,map,block}:null;
  }
  function highlightSentence({sentence,map}){const page=host.querySelector('.pdf-page,.word-page'),r=page.getBoundingClientRect();for(const seg of map.segments){const a=Math.max(sentence.start,seg.start),b=Math.min(sentence.end,seg.end);if(a>=b)continue;const range=document.createRange();range.setStart(seg.node,a-seg.start);range.setEnd(seg.node,b-seg.start);for(const rect of range.getClientRects()){const mark=create('div','sentence-highlight');mark.style.cssText=`left:${rect.left-r.left}px;top:${rect.top-r.top}px;width:${rect.width}px;height:${rect.height}px`;page.append(mark);}}}
  function highlightParagraph(block){
    highlightSource(block,{scroll:false});
    host.querySelectorAll('.source-highlight').forEach(e=>{e.classList.remove('source-highlight');e.classList.add('paragraph-translation-highlight');});
    host.querySelectorAll('.source-located').forEach(e=>{e.classList.remove('source-located');e.classList.add('translation-located');});
  }
  async function translateParagraph(blockId,button){
    try{const block=readingUnit(state.doc,blockId);if(!block)throw Error(uiText("这段原文已改变，请重新选择段落。"));await translate({kind:'paragraph',block,button,sentence:{text:block.text}});}
    catch(e){closeTranslation();popup=create('aside','translation-popup');popup.append(create('p','translation-result',uiError(e.message)),action(uiText("关闭"),()=>closeTranslation(true),'button'));reading.append(popup);}
  }
  async function translate(info){
    closeTranslation();closeDrawer();const doc=state.doc,epoch=state.renderEpoch,isParagraph=info.kind==='paragraph',config={...getTranslationConfig()};
    if(isParagraph)highlightParagraph(info.block);else highlightSentence(info);
    translationButton=info.button;translationButton?.setAttribute('aria-expanded','true');
    popup=create('aside','translation-popup');popup.id='translationPopup';popup.setAttribute('aria-label',isParagraph?uiText("段落翻译"):uiText("句子翻译"));
    const heading=create('div','reader-overlay-heading');heading.append(create('strong','',(isParagraph?uiText("整段翻译 · "):'')+outputLanguage(config.targetLanguage).label),action('×',()=>closeTranslation(true),'dialog-close'));heading.lastChild.setAttribute('aria-label',uiText("关闭翻译"));
    popup.append(heading,create('div','translation-source',info.sentence.text),create('small','translation-model',providerLabel(config.provider)+(config.model?' · '+config.model:'')));
    if(info.block.crossPage)popup.append(create('small','cross-page-label',uiText("跨页完整段落 · 第 {0} 页", pageRange(info.block))));
    const result=create('div','translation-result');result.setAttribute('role','status');result.dir='auto';popup.append(result);reading.append(popup);if(isParagraph)heading.lastChild.focus({preventScroll:true});
    if(['ollama','ai','inherit'].includes(config.provider)&&!config.model){result.textContent=uiText("请先配置翻译模型或选择专用翻译服务。");popup.append(action(uiText("设置翻译服务"),showTranslationSettings));return;}
    let key;try{if(isParagraph&&info.sentence.text.length>24000)throw Error(uiText("这段原文超过 24,000 字符，请选择较短内容。"));key=translationCacheKey(info.sentence.text,config,isParagraph?'paragraph':'sentence');}catch(e){result.textContent=uiError(e.message);popup.append(action(uiText("设置翻译服务"),showTranslationSettings));return;}
    doc.translations||={};if(doc.translations[key]){result.textContent=doc.translations[key];popup.append(create('small','translation-cache',uiText("本机缓存")));return;}
    const token=slot.begin();result.setAttribute('aria-busy','true');result.textContent=isParagraph?uiText("正在翻译整个段落…"):uiText("正在翻译这个句子…");
    try{const text=await translateText(info.sentence.text,config,{scope:isParagraph?'paragraph':'sentence',signal:token.signal});if(!slot.current(token)||doc!==state.doc||epoch!==state.renderEpoch)return;result.textContent=text;doc.translations[key]=text;await saveDoc(doc);}
    catch(e){if(!slot.current(token)||e.name==='AbortError')return;result.textContent=uiText("翻译失败：{0}", uiError(e.message));popup.append(action(uiText("重试"),()=>translate(info)));}finally{result.setAttribute('aria-busy','false');}
  }
  host.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,button:e.button};});
  host.addEventListener('click',e=>{if(state.view!=='original'||state.mutating||!pointer||pointer.button!==0||e.detail>1||e.target.closest('a,button')||Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>5||window.getSelection()?.toString().trim())return;const info=clickedSentence(e);if(!info||info.sentence.text.length<2)return;clearTimeout(timer);timer=setTimeout(()=>translate(info),180);});
  host.addEventListener('dblclick',()=>clearTimeout(timer));
  return{reset,attach,closeTranslation,closeDrawer,openBlock:(blockId,button)=>openCard(state.doc.cards.find(c=>c.blockId===blockId&&noteInLanguage(c,state.outputLanguage))||{blockId,pending:true},button)};
}
