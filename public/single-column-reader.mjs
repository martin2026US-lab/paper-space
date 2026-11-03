import {canTranscribe} from './transcription.mjs';
import {openTranscription} from './transcription-ui.mjs';
import {uiText as t} from './ui-language.mjs';
import {renderAnswer} from './answer-markdown.mjs';
import {renderTextRuns,selectionEvidence} from './reading-text.mjs';
import {editionFor,editionUnitFor,validEdition} from './reading-edition.mjs';
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=t(text);return n;};
const btn=(text,fn,cls='button')=>{const n=el('button',cls,text);n.type='button';n.onclick=fn;return n;};
export function createSingleColumnReader({state,onPage,translate,getTranslation=()=>null,onAnnotate,answer,answerVisual,extractText,persistText,toast}){
 let edition,root,article,rail,opener,panel,sourceScroll,sourceStage,pageTabs,current,activePage,observer,resizeObserver,epoch=0,open=false,pending=new Set(),controller,anchor=null,frame,sourceSerial=0,alive=false,ready=false,closeTimer;
 const scroll=document.getElementById('readerScroll'),cache=new Map();let cacheDoc;
 let pinned=null,selectionSnapshot=null,selectedUnits=[],actionFrame,resizeFrame,stableAnchor=null,layoutWidth=0,layoutHeight=0,hoverTimer,hoverTarget=null,pointer=null;
 const sourceUnits=()=>selectedUnits.length?selectedUnits:current?[current]:[];
 const sectionFor=n=>(n?.nodeType===1?n:n?.parentElement)?.closest('.edition-unit');
 const unitFor=n=>edition?.units.find(u=>u.id===sectionFor(n)?.dataset.unitId);
 function targetFor(unit){if(!selectionSnapshot||!selectedUnits.some(u=>u.id===unit.id))return unit;return {...unit,selectedText:true,text:selectionSnapshot.text,evidenceText:selectionSnapshot.evidenceText,modelText:selectionSnapshot.evidenceText,page:selectedUnits[0].page,sourceBlockIds:[...new Set(selectedUnits.flatMap(u=>u.sourceBlockIds))],boxes:selectedUnits.flatMap(u=>u.boxes)};}
 function placeActions(section,rect){if(!section||!rect)return;article.querySelectorAll('.edition-actions.is-active').forEach(n=>n.classList.remove('is-active'));const actions=section.querySelector('.edition-actions');actions.classList.add('is-active');const bounds=scroll.getBoundingClientRect(),unitRect=section.getBoundingClientRect(),width=actions.offsetWidth,height=actions.offsetHeight;actions.style.left=Math.max(bounds.left+8,Math.min(unitRect.right-width,bounds.right-width-10))+'px';actions.style.top=Math.max(bounds.top+6,Math.min(unitRect.top-height-5,bounds.bottom-height-8))+'px';}
 function hoverUnit(unit,event){if(!unit||event.pointerType==='touch'||event.buttons||selectionSnapshot||document.querySelector('dialog[open]'))return;pointer={x:event.clientX,y:event.clientY};if(hoverTarget===unit.id)return;clearTimeout(hoverTimer);hoverTarget=unit.id;hoverTimer=setTimeout(()=>{if(!alive||!ready||selectionSnapshot||hoverTarget!==unit.id)return;pinned=unit.id;article.querySelectorAll('.edition-actions.is-active').forEach(n=>n.classList.remove('is-active'));setCurrent(unit);if(state.page!==unit.page)onPage(unit.page);},75);}
 function selectUnit(unit,rect){if(!unit)return;clearTimeout(hoverTimer);hoverTarget=unit.id;if(selectionSnapshot&&!selectedUnits.some(u=>u.id===unit.id)){selectionSnapshot=null;selectedUnits=[];delete root.dataset.selectionUnits;window.getSelection()?.removeAllRanges();}pinned=unit.id;setCurrent(unit,{force:true});if(state.page!==unit.page)onPage(unit.page);placeActions(article.querySelector(`[data-unit-id="${unit.id}"]`),rect);}
 function syncSelection(){if(!alive||!ready)return;const selection=window.getSelection();if(!selection?.rangeCount||selection.isCollapsed||!selection.toString().trim())return;const range=selection.getRangeAt(0),first=sectionFor(range.startContainer),last=sectionFor(range.endContainer);if(!first||!last||!article.contains(first)||!article.contains(last))return;
  const content=[...article.querySelectorAll('.edition-text,.edition-table-note')].filter(t=>range.intersectsNode(t));const rows=[...new Set(content.map(sectionFor))];if(!rows.length)return;
  const rects=[];const text=content.map(t=>{const part=document.createRange();part.selectNodeContents(t);if(range.compareBoundaryPoints(Range.START_TO_START,part)>0)part.setStart(range.startContainer,range.startOffset);if(range.compareBoundaryPoints(Range.END_TO_END,part)<0)part.setEnd(range.endContainer,range.endOffset);rects.push(...part.getClientRects());return part.toString();}).filter(Boolean).join('\n\n').trim();if(!text)return;
  selectedUnits=rows.map(unitFor);selectionSnapshot={text,evidenceText:selectionEvidence(range)};root.dataset.selectionUnits=selectedUnits.map(u=>u.id).join(',');const focus=unitFor(selection.focusNode)||selectedUnits[0],backwards=selection.focusNode===range.startContainer&&selection.focusOffset===range.startOffset;selectUnit(focus,backwards?rects[0]:rects.at(-1));
 }
 document.addEventListener('selectionchange',()=>{cancelAnimationFrame(actionFrame);actionFrame=requestAnimationFrame(syncSelection);});
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function capture(){if(!alive)return null;const top=scroll.getBoundingClientRect().top;const n=[...article.querySelectorAll('.edition-unit')].find(n=>n.getBoundingClientRect().bottom>top+35);return n?{docId:state.doc.id,id:n.dataset.unitId,offset:n.getBoundingClientRect().top-top}:null;}
 function restore(a){if(!a||a.docId!==state.doc.id)return;const n=article?.querySelector(`[data-unit-id="${a.id}"]`);if(n)scroll.scrollTop+=n.getBoundingClientRect().top-scroll.getBoundingClientRect().top-a.offset;}
 function dispose(){clearTimeout(closeTimer);clearTimeout(hoverTimer);hoverTarget=null;pointer=null;anchor=capture()||anchor;alive=false;epoch++;sourceSerial++;observer?.disconnect();resizeObserver?.disconnect();controller?.abort();pending.clear();pinned=null;selectionSnapshot=null;selectedUnits=[];cancelAnimationFrame(actionFrame);cancelAnimationFrame(resizeFrame);root?.remove();root=null;}
 async function pageCanvas(page,scale=1.5){const doc=state.doc,pdf=state.pdf;if(cacheDoc!==doc.id){cache.clear();cacheDoc=doc.id;}const key=doc.id+':'+page+':'+scale;
  if(!cache.has(key)){const job=(async()=>{const p=await pdf.getPage(page),v=p.getViewport({scale}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;return c;})();cache.set(key,job);job.catch(()=>cache.delete(key));if(cache.size>8)cache.delete(cache.keys().next().value);}return cache.get(key);
 }
 async function sourcePage(page){if(!current||!alive)return;const unit=current,units=sourceUnits(),boxes=units.flatMap(u=>u.boxes),ticket=++sourceSerial,local=epoch;activePage=page;
  pageTabs.replaceChildren();for(const p of [...new Set(boxes.map(b=>b.page))].sort((a,b)=>a-b)){const b=btn(t('第 {0} 页',p),()=>sourcePage(p),'edition-page-tab');b.setAttribute('aria-pressed',String(p===page));pageTabs.append(b);}
  sourceStage.setAttribute('aria-busy','true');try{const canvas=await pageCanvas(page);if(local!==epoch||ticket!==sourceSerial||!alive)return;
   const image=el('img');image.src=canvas.toDataURL('image/png');image.alt='原文第 '+page+' 页';sourceStage.replaceChildren(image);sourceStage.dataset.page=page;sourceStage.dataset.unitId=unit.id;
   sourceStage.dataset.unitIds=units.map(u=>u.id).join(',');for(const b of boxes.filter(b=>b.page===page)){const mark=el('div','edition-source-mark');Object.assign(mark.style,{left:b.x/b.pageWidth*100+'%',top:b.y/b.pageHeight*100+'%',width:(b.right-b.x)/b.pageWidth*100+'%',height:(b.bottom-b.y)/b.pageHeight*100+'%'});sourceStage.append(mark);}
   const thumb=opener.querySelector('img');thumb.src=image.src;thumb.alt='原文第 '+page+' 页缩略图';
   const position=()=>{if(ticket!==sourceSerial||!alive)return;const b=boxes.find(b=>b.page===page);sourceScroll.scrollTop=Math.max(0,b.y/b.pageHeight*sourceStage.clientHeight-32);};if(image.complete)position();else image.onload=position;
  }catch(e){if(ticket===sourceSerial&&alive){sourceStage.replaceChildren(el('p','', '原页暂未载入，可重试。'));toast(e.message);}}finally{if(ticket===sourceSerial)sourceStage.removeAttribute('aria-busy');}
 }
 function setCurrent(unit,{force=false}={}){if(!unit)return;if(!force&&unit.id===current?.id)return;current=unit;root.dataset.activeUnit=unit.id;article.querySelectorAll('.edition-current').forEach(n=>n.classList.remove('edition-current'));article.querySelector(`[data-unit-id="${unit.id}"]`)?.classList.add('edition-current');opener.title='查看原文第 '+unit.page+(unit.endPage!==unit.page?'–'+unit.endPage:'')+' 页';void sourcePage(unit.page);}
 function toggle(next=!open){if(!alive)return;clearTimeout(closeTimer);const before=capture(),local=epoch;open=next;opener.setAttribute('aria-expanded',String(open));panel.classList.remove('closing');if(open){root.classList.add('source-open');panel.hidden=false;void sourcePage(activePage||current.page);panel.querySelector('.edition-close').focus({preventScroll:true});requestAnimationFrame(()=>restore(before));}else{panel.classList.add('closing');const finish=()=>{if(!alive||epoch!==local||open)return;panel.hidden=true;panel.classList.remove('closing');root.classList.remove('source-open');restore(before);opener.focus({preventScroll:true});};if(reduced())finish();else closeTimer=setTimeout(finish,170);}}
 function navigate(page,blockId){pinned=null;selectionSnapshot=null;selectedUnits=[];if(root)delete root.dataset.selectionUnits;const unit=editionUnitFor(edition,blockId)||edition.units.find(u=>u.page===page&&u.kind!=='footer')||edition.units.find(u=>u.boxes.some(b=>b.page===page));if(!unit)return false;const n=article.querySelector(`[data-unit-id="${unit.id}"]`);if(n){scroll.scrollTop+=n.getBoundingClientRect().top-scroll.getBoundingClientRect().top-24;setCurrent(unit,{force:true});}return !!n;}
 function track(){if(!alive||!ready)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!alive||scroll.clientWidth!==layoutWidth||scroll.clientHeight!==layoutHeight)return;stableAnchor=capture();article.querySelectorAll('.edition-actions.is-active').forEach(n=>n.classList.remove('is-active'));if(selectionSnapshot)return;const pointed=pointer?document.elementFromPoint(pointer.x,pointer.y):null,hovered=article.contains(pointed)?unitFor(pointed):null;if(hovered){pinned=hovered.id;setCurrent(hovered);if(state.page!==hovered.page)onPage(hovered.page);return;}const bounds=scroll.getBoundingClientRect(),selected=article.querySelector(`[data-unit-id="${pinned}"]`)?.getBoundingClientRect();if(selected&&selected.bottom>bounds.top&&selected.top<bounds.bottom)return;pinned=null;const top=bounds.top+80,rows=[...article.querySelectorAll('.edition-unit')];const n=rows.find(n=>{const r=n.getBoundingClientRect();return r.bottom>top&&r.top<bounds.bottom;});if(n){const u=edition.units.find(u=>u.id===n.dataset.unitId);setCurrent(u);if(state.page!==u.page)onPage(u.page);}});}
 scroll.addEventListener('scroll',track,{passive:true});
 document.addEventListener('keydown',e=>{if(alive&&open&&e.key==='Escape'){e.preventDefault();toggle(false);}});
 async function drawVisual(unit,image,local){if(unit.image){image.src=unit.image;return;}try{const box=image._box||unit.boxes[0],canvas=await pageCanvas(box.page,unit.kind==='formula'||unit.glyphFallback||image.classList.contains('edition-inline-glyph')?3:2);if(epoch!==local||!alive)return;const c=document.createElement('canvas'),sx=canvas.width/box.pageWidth,sy=canvas.height/box.pageHeight;c.width=Math.ceil((box.right-box.x)*sx);c.height=Math.ceil((box.bottom-box.y)*sy);c.getContext('2d').drawImage(canvas,box.x*sx,box.y*sy,c.width,c.height,0,0,c.width,c.height);image.src=c.toDataURL('image/png');}catch{image.replaceWith(el('p','edition-warning','此区域请打开原文查看。'));}}

 async function sourceImages(unit,signal){
  const local=epoch,boxes=(unit.inlineGlyphs||unit.transcriptionSourceKey)?unit.boxes:(unit.visualBoxes||[unit.boxes[0]]),images=[];
  if(boxes.length>8)throw Error(t('原图区域过多，请逐页查看后再解答。'));
  for(const box of boxes){
   const canvas=await pageCanvas(box.page,3);signal.throwIfAborted();if(local!==epoch||!alive)throw new DOMException('Cancelled','AbortError');
   const sx=canvas.width/box.pageWidth,sy=canvas.height/box.pageHeight,w=(box.right-box.x)*sx,h=(box.bottom-box.y)*sy,scale=Math.min(1,1600/Math.max(w,h));
   const crop=document.createElement('canvas');crop.width=Math.max(1,Math.ceil(w*scale));crop.height=Math.max(1,Math.ceil(h*scale));crop.getContext('2d').drawImage(canvas,box.x*sx,box.y*sy,w,h,0,0,crop.width,crop.height);images.push(crop.toDataURL('image/jpeg',.9));
  }
  if(images.reduce((n,s)=>n+s.length,0)>2_400_000)throw Error(t('原图较大，请逐页查看后再解答。'));
  return images;
 }
 async function explainTarget(unit,signal){
  if((!unit.visual&&!unit.inlineGlyphs)||unit.selectedText||!answerVisual)return answer(unit,signal);
  return answerVisual(unit,await sourceImages(unit,signal),signal);
 }
 function appendAnswer(section,actions,unit,local){
  const response=el('div','edition-answer');response.hidden=true;response.setAttribute('role','status');
  const usesImage=answerVisual&&(unit.visual||unit.inlineGlyphs);let answeredText=null;
  const action=btn(usesImage?'解答原图':'解答',async()=>{
   const target=targetFor(unit);selectUnit(unit);
   if(unit.text&&answeredText===target.text){response.hidden=!response.hidden;return;}
   action.disabled=true;response.hidden=false;response.textContent=t('正在解答…');
   try{const text=await explainTarget(target,controller.signal);if(local===epoch&&alive){renderAnswer(response,text);answeredText=target.text;}}
   catch(e){if(local===epoch&&alive)response.textContent=e.name==='AbortError'?t('已取消'):e.message;}
   finally{action.disabled=false;}
  },'edition-action edition-explain');
  if(usesImage)action.title=t('将当前区域原图发送给已配置的阅读模型；需要模型支持识图。');
  actions.append(action);section._answer=response;
 }
 function format(node,u){if(Array.isArray(u.textRuns)){renderTextRuns(node,u.textRuns,run=>{const b=run.imageBox,image=el('img','edition-inline-glyph'),size=b.fontSize||10;image.alt='[原图符号]';image.title=t('点击查看原页');image._box=b;image._unit=u;image.style.width=(b.right-b.x)/size+'em';image.style.height=(b.bottom-b.y)/size+'em';image.style.verticalAlign=(b.baseline-b.bottom)/size+'em';image.tabIndex=0;image.setAttribute('role','button');image.onclick=e=>{e.stopPropagation();selectUnit(u);toggle(true);void sourcePage(b.page);};image.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();image.click();}};observer.observe(image);return image;});return;}node.textContent=u.text;}
 async function render(host,{view='original',preserve=false}={}){
  const candidate=preserve?(capture()||anchor):null,saved=candidate?.docId===state.doc.id?candidate:null;ready=false;dispose();edition=editionFor(state.doc);if(!edition||!validEdition(edition,state.doc))return false;alive=true;const local=epoch;controller=new AbortController();
  root=el('div','edition-shell'+(open?' source-open':''));root.dataset.edition=edition.provenance;root.dataset.mode=view;rail=el('aside','edition-rail');opener=btn('',()=>toggle(),'edition-opener');opener.setAttribute('aria-label','展开原文对照');opener.setAttribute('aria-expanded',String(open));opener.append(el('img'),el('span','','原文'));rail.append(opener);
  panel=el('section','edition-source-panel');panel.hidden=!open;panel.setAttribute('aria-label','原文对照');const top=el('div','edition-source-top');pageTabs=el('div','edition-page-tabs');const fit=btn('放大',()=>{sourceStage.classList.toggle('zoomed');fit.textContent=sourceStage.classList.contains('zoomed')?'适宽':'放大';},'edition-page-tab');const close=btn('收起',()=>toggle(false),'edition-page-tab edition-close');top.append(pageTabs,fit,close);sourceScroll=el('div','edition-source-scroll');sourceStage=el('div','edition-source-stage');sourceScroll.append(sourceStage);panel.append(top,sourceScroll);rail.append(panel);root.append(rail);
  article=el('article','edition-document');article.setAttribute('aria-label','全文阅读文档');root.append(article);host.append(root);document.addEventListener('pointermove',e=>{if(!article.contains(e.target)){pointer=null;hoverTarget=null;clearTimeout(hoverTimer);}},{signal:controller.signal});
  observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);void drawVisual(e.target._unit,e.target,local);}},{root:scroll,rootMargin:'500px'});
  const footer=el('details','edition-footers');footer.append(el('summary','','页脚与出版标记'));
  for(const u of edition.units){const section=el('section','edition-unit edition-'+u.kind);if(u.glyphFallback)section.classList.add('edition-glyph-fallback');section.dataset.unitId=u.id;section.dataset.page=u.page;section.dataset.blockId=u.sourceBlockIds[0];
   const actions=el('div','edition-actions');actions.setAttribute('role','toolbar');actions.setAttribute('aria-label','段落操作');
   actions.addEventListener('pointerdown',e=>e.preventDefault());
   actions.append(btn('批注',()=>{const selected=targetFor(u);selectUnit(u);onAnnotate(selected);},'edition-action edition-annotate'));
   if(u.text){
    const result=el('div','edition-translation');result.hidden=true;result.setAttribute('role','status');let shownText=null;
    const tr=btn('翻译',async()=>{const target=targetFor(u);selectUnit(u);if(pending.has(u.id))return;if(shownText===target.text){result.hidden=!result.hidden;return;}pending.add(u.id);tr.disabled=true;result.hidden=false;result.textContent='正在翻译…';try{const translated=await translate(target,controller.signal);if(local===epoch&&alive){result.textContent=translated;shownText=target.text;}}catch(e){if(local===epoch&&alive)result.textContent=e.name==='AbortError'?'已取消':e.message;}finally{pending.delete(u.id);tr.disabled=false;}},'edition-action edition-translate');
    const cached=getTranslation(u);if(cached){result.hidden=false;result.textContent=cached;shownText=u.text;}
    actions.append(tr);section._translation=result;
   }
   if(u.text||(u.visual&&answerVisual))appendAnswer(section,actions,u,local);
   section.append(actions);
   if(canTranscribe(u)&&extractText&&persistText){
    const tools=el('div','edition-transcription-tools'),doc=state.doc;
    tools.append(btn(u.transcribed?'编辑文字':'提取文字',()=>{selectUnit(u);openTranscription({unit:u,signal:controller.signal,crops:s=>sourceImages(u,s),extract:(images,s)=>extractText(u,images,s),save:text=>persistText(doc,u,text),onSaved:()=>{if(alive&&epoch===local&&state.doc===doc)return render(host,{view,preserve:true});}});},'edition-page-tab edition-extract'));
    if(u.transcribed)tools.append(btn('恢复原图',async()=>{try{await persistText(doc,u,null);await render(host,{view,preserve:true});}catch(e){toast(e.message);}},'edition-page-tab edition-restore'));
    section.append(tools);
   }
   if(u.image||u.visual)for(const visualBox of u.visualBoxes||[u.boxes[0]]){const image=el('img','edition-figure');image.alt=u.label||u.text.slice(0,100)||(u.glyphFallback?'文字原图':u.kind==='formula'?'公式原图':'原版图表');const box=visualBox;image._box=box;let iw=box.right-box.x,ih=box.bottom-box.y;if(u.image?.startsWith('data:image/png;base64,')){const bytes=Uint8Array.from(atob(u.image.split(',')[1].slice(0,48)),c=>c.charCodeAt(0)),v=new DataView(bytes.buffer);iw=v.getUint32(16);ih=v.getUint32(20);}if(u.glyphFallback)image.style.width=iw/(u.sourceFontSize||10)+'em';image.style.aspectRatio=iw+'/'+ih;image.width=iw;image.height=ih;image._unit=u;image.tabIndex=0;image.setAttribute('role','button');image.title='点击查看原页';image.onclick=e=>{if(!e.detail)pointer=null;selectUnit(u);toggle(true);};image.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();image.click();}};section.append(image);observer.observe(image);}
   if(u.text){const tag=u.kind==='title'?'h1':u.kind==='heading'?'h2':u.kind==='subheading'?'h3':'p',text=el(tag,'word-block edition-text');text.dataset.blockId=u.sourceBlockIds[0];if(u.transcribed)text.classList.add('edition-transcribed-text');format(text,u);section.append(text);}
   if(u.glyphFallback)section.append(el('p','edition-review-note','原图文字'));
   if(u.kind==='formula'&&!u.text)section.append(el('p','edition-review-note','公式 · 原图'));
   for(const note of u.notes||[])section.append(el('p','edition-table-note',note));
   if(section._translation){section.append(section._translation);}
   if(section._answer)section.append(section._answer);
   section.addEventListener('focusin',e=>{if(e.target.closest('.edition-actions'))selectUnit(u);});
   section.addEventListener('pointerenter',e=>{section.classList.add('edition-hover');hoverUnit(u,e);});section.addEventListener('pointermove',e=>hoverUnit(u,e));section.addEventListener('pointerleave',()=>{section.classList.remove('edition-hover');clearTimeout(hoverTimer);hoverTarget=null;});
   section.addEventListener('pointerdown',e=>{if(e.target.closest('.edition-actions,.edition-translation,.edition-answer'))return;selectionSnapshot=null;selectedUnits=[];delete root.dataset.selectionUnits;pinned=u.id;});
   section.addEventListener('mouseup',e=>{if(e.button!==0||e.target.closest('button,.edition-translation,.edition-answer'))return;if(window.getSelection()?.toString().trim()){syncSelection();return;}selectUnit(u,{right:e.clientX,bottom:e.clientY});});
   section.addEventListener('click',e=>{if(e.target.closest('.edition-text,.edition-table-note')&&!window.getSelection()?.toString().trim())selectUnit(u,{right:e.clientX,bottom:e.clientY});});
   (u.kind==='footer'?footer:article).append(section);
  }
  article.append(footer);if(edition.quality){const qa=el('details','edition-footers edition-quality');qa.append(el('summary','','阅读校验 · '+edition.quality.events.filter(e=>e.type==='formula-original').length+' 处公式保留原图 · '+edition.quality.uncertain.length+' 处文字保留原图'));for(const issue of edition.quality.uncertain){const u=edition.units.find(u=>u.sourceRefs.includes(issue.sourceRef));if(u)qa.append(btn('第 '+u.page+' 页 · '+(u.text.slice(0,60)||'原文区域'),()=>{navigate(u.page,u.id);toggle(true);},'edition-page-tab'));}article.append(qa);}if(edition.provenance!=='reviewed-paper')article.append(el('p','edition-review-note','自动整理的阅读版本 · 遇到顺序或符号疑点，可展开原文核对。'));
  const resize=()=>{if(!alive||epoch!==local)return;const before=ready?(stableAnchor||capture()):null;layoutWidth=scroll.clientWidth;layoutHeight=scroll.clientHeight;root.classList.toggle('source-overlay',scroll.clientWidth<1020);root.style.setProperty('--source-height',Math.max(180,scroll.clientHeight-30)+'px');requestAnimationFrame(()=>{if(alive&&epoch===local){restore(before);stableAnchor=capture();}});};resizeObserver=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resize);});resizeObserver.observe(scroll);resize();
  await document.fonts.ready;if(epoch!==local||!alive)return true;if(saved){restore(saved);const u=edition.units.find(u=>u.id===saved.id);setCurrent(u,{force:true});}else navigate(state.page);ready=true;stableAnchor=capture();return true;
 }
 return{render,dispose,capture,navigate,track,toggle,get active(){return alive;},get edition(){return edition;},get current(){return current;}};
}
