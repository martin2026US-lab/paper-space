import {uiText as t} from './ui-language.mjs';
export function createMagazineUI({state,workspaceTools,toast}){
 const $=id=>document.getElementById(id),body=document.body,library=document.querySelector('.library'),app=document.querySelector('.app'),topbar=document.querySelector('.topbar'),actions=document.querySelector('.top-actions'),footer=document.querySelector('.reader-footer'),toolbar=document.querySelector('.reader-toolbar');
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;};
 const icon=name=>{const image=el('img','editorial-icon');image.src='/vendor/phosphor/'+name+'.svg';image.alt='';return image;};
 const button=(id,label,name,fn)=>{const node=el('button','',t(label));node.id=id;node.type='button';if(name)node.prepend(icon(name));node.onclick=fn;return node;};
 const compact=matchMedia('(max-width:1480px)'),small=matchMedia('(max-width:900px)');let drawer=false,libraryMode=false,opener,frame;
 const brand=button('magazineBrand','纸间',null,()=>openSidebar(true));brand.className='magazine-brand';const logo=el('img');logo.src='/favicon.svg';logo.alt='';brand.prepend(logo);topbar.prepend(brand);
 const switcher=el('div','reading-style-switch');switcher.id='readingStyleSwitch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label',t('阅读风格'));
 for(const [style,label]of [['classic','经典'],['magazine','杂志']]){const b=button('style'+(style==='classic'?'Classic':'Magazine'),label,null,()=>workspaceTools.setReadingStyle(style));b.dataset.readingStyle=style;b.setAttribute('aria-pressed','false');switcher.append(b);}actions.prepend(switcher);
 const rail=el('nav','magazine-rail');rail.setAttribute('aria-label',t('阅读导航'));
 rail.append(button('magazineLibrary','文献','books',()=>openSidebar(true)),button('magazineContents','目录','list',()=>openSidebar(false)),button('magazineSearch','搜索','magnifying-glass',()=>workspaceTools.open('documents')),button('magazineSettings','设置','gear-six',()=>$('settingsBtn').click()));app.prepend(rail);
 const sideHeader=el('div','magazine-sidebar-header'),back=button('magazineLibraryBack','返回文献库','arrow-left',()=>{libraryMode=!libraryMode;update();}),close=button('magazineSidebarClose','收起目录','x',()=>closeSidebar());close.setAttribute('aria-label',t('收起目录'));sideHeader.append(back,close);library.prepend(sideHeader);
 const dismiss=button('magazineSidebarDismiss','收起目录',null,()=>closeSidebar());dismiss.className='magazine-sidebar-dismiss';dismiss.textContent='';dismiss.setAttribute('aria-label',t('收起目录'));app.append(dismiss);
 const page=document.querySelector('.page-controls'),pageMarker=document.createComment('original page controls');page.before(pageMarker);const pager=el('div','magazine-footer-pager');footer.append(pager);
 const selection=$('selectionChip'),selectionMarker=document.createComment('original selection context');selection.before(selectionMarker);
 const notes=button('magazineNotes','个人批注','note-pencil',()=>$('personalNotesBtn').click());footer.append(notes);
 const tools=el('div','magazine-translation-tools'),target=el('select');target.id='magazineTranslationLanguage';target.setAttribute('aria-label',t('翻译目标语言'));target.onchange=()=>{const source=$('translationLanguage');source.value=target.value;source.dispatchEvent(new Event('change'));update();};
 const translate=button('magazineTranslatePage','翻译本页','translate',()=>{const source=$('bilingualTranslatePage');if(source&&!source.disabled)source.click();}),stop=button('magazineTranslateStop','停止',null,()=>$('bilingualStop')?.click());stop.hidden=true;tools.append(target,translate,stop);toolbar.append(tools);
 const focus=button('magazineFocus','专注阅读',null,()=>workspaceTools.toggleFocus());focus.className='magazine-menu-command';$('readingMenu').querySelector('.menu-caption').after(focus);
 function isMagazine(){return workspaceTools.readingStyle==='magazine';}
 function isCollapsed(){return small.matches||(compact.matches&&!body.classList.contains('assistant-hidden'));}
 function openSidebar(documents){if(!isMagazine())return;opener=document.activeElement;libraryMode=documents;if(body.classList.contains('reading-focus'))workspaceTools.toggleFocus();drawer=isCollapsed();update();(documents?$('importBtn'):$('outline').querySelector('button')||back).focus();}
 function closeSidebar(focus=true){drawer=false;update();if(focus&&opener?.isConnected)opener.focus();}
 function update(){
  const magazine=isMagazine(),collapsed=magazine&&isCollapsed(),focused=body.classList.contains('reading-focus');if(!magazine)drawer=false;
  body.classList.toggle('magazine-library-open',magazine&&(libraryMode||!state.doc));body.classList.toggle('magazine-sidebar-open',magazine&&drawer);body.classList.toggle('magazine-compact',collapsed);
  for(const b of switcher.children)b.setAttribute('aria-pressed',String(b.dataset.readingStyle===workspaceTools.readingStyle));
  for(const [id,short,long]of [['originalTab','原文','原文阅读'],['bilingualTab','双语','双语阅读'],['summaryTab','导读','全文导读']]){const node=$(id),label=t(magazine?short:long);if(node.textContent!==label)node.textContent=label;}
  if(magazine){if(page.parentElement!==pager)pager.append(page);if(selection.parentElement!==$('assistantPanel'))document.querySelector('.assistant-tabs').after(selection);library.inert=focused||(collapsed&&!drawer);}else{if(page.parentNode!==pageMarker.parentNode)pageMarker.after(page);if(selection.parentNode!==selectionMarker.parentNode)selectionMarker.after(selection);}
  rail.inert=!magazine||!collapsed||focused;dismiss.hidden=!magazine||!drawer;back.lastChild.textContent=t(libraryMode||!state.doc?'返回阅读目录':'返回文献库');
  for(const id of ['magazineLibrary','magazineContents'])$(id).setAttribute('aria-expanded',String(drawer&&((id==='magazineLibrary')===libraryMode)));
  notes.disabled=!state.doc;const count=(state.doc?.personalNotes||[]).filter(n=>!n.deletedAt).length,label=t('批注{0}',count?' · '+count:'');notes.lastChild.textContent=label;notes.title=t('个人批注');
  target.disabled=state.busy||state.mutating;const source=$('translationLanguage');if(source){const signature=source.innerHTML;if(target.dataset.options!==signature){target.replaceChildren(...[...source.options].map(o=>o.cloneNode(true)));target.dataset.options=signature;}target.value=source.value;}
  tools.hidden=!magazine||state.view!=='bilingual';const all=$('bilingualTranslatePage');translate.disabled=!all||all.disabled||state.busy;stop.hidden=!$('bilingualStop')||$('bilingualStop').hidden;translate.hidden=!stop.hidden;focus.textContent=t(focused?'退出专注':'专注阅读');
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(update);}
 document.addEventListener('paper-space:layout',()=>{if(isCollapsed())drawer=false;update();});document.addEventListener('change',schedule);compact.addEventListener('change',()=>{drawer=false;update();});small.addEventListener('change',()=>{drawer=false;update();});
 library.addEventListener('click',event=>{if(event.target.closest('.chapter-target,.document-item')&&drawer)closeSidebar(false);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drawer&&!document.querySelector('dialog[open]')&&!event.defaultPrevented){event.preventDefault();closeSidebar();}});
 const observer=new MutationObserver(schedule);observer.observe($('readingContent'),{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden']});observer.observe($('personalNotesBtn'),{childList:true});observer.observe($('translationLanguage'),{childList:true});observer.observe($('docTitle'),{childList:true});
 update();return{update,openLibrary:()=>openSidebar(true)};
}
