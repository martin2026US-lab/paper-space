import {uiText,uiHTML,uiError,uiDateLocale} from './ui-language.mjs';
import {loadReadingStyle,saveReadingStyle,loadMagazineLayout,MAGAZINE_LAYOUT_KEY} from './reading-style.mjs';
import {chapterTree,chapterAncestors} from './chapter-navigation.mjs';

export function matchesQuery(text,query){
  const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
  const haystack=normalize(text);
  return normalize(query).split(' ').filter(Boolean).every(term=>haystack.includes(term));
}
export function finderEntries({docs,doc,chapters,scope,query=''}){
  if(scope==='documents')return docs.filter(d=>!d.deletedAt&&matchesQuery(d.name,query)).map(d=>({key:d.id,title:d.name,detail:(d.type||uiText("文献")).toUpperCase()+' · '+d.pages+(d.type==='pdf'?uiText(" 页"):uiText(" 阅读页")),doc:d,current:d.id===doc?.id}));
  const tree=chapterTree(chapters);
  return chapters.map(item=>{const path=chapterAncestors(tree,item.key).slice(0,-1).map(p=>p.title).join(' › ');return{key:item.key,title:item.title,detail:path||uiText("主章节"),item};}).filter(e=>matchesQuery(e.title+' '+e.detail,query));
}
export function loadLayout(storage){
  try{const v=JSON.parse(storage.getItem('paper-space-layout')||'{}');return{focus:v.focus===true,assistant:v.assistant!==false};}catch{return{focus:false,assistant:true};}
}
export function createWorkspaceTools({state,getChapters,getActive,navigate,activate,toast,onLayoutChange,onBeforeLayout=()=>{},closeNavigation=()=>{}}){
  const classicLayout=loadLayout(localStorage),magazineLayout=loadMagazineLayout(localStorage);let readingStyle=loadReadingStyle(localStorage),layout=readingStyle==='magazine'?magazineLayout:classicLayout;
  const $=id=>document.getElementById(id),dialog=$('finderDialog'),input=$('finderInput'),results=$('finderResults'),menu=$('readingMenu');
  let scope='chapters',entries=[],selected=0,opener=null,pending=false;
  const narrow=window.matchMedia('(max-width:1000px)');let narrowOpened=false;
  const assistantVisible=()=>!layout.focus&&layout.assistant&&(readingStyle==='magazine'||!narrow.matches||narrowOpened);
  const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  function applyLayout(notify=true){
    if(notify)onBeforeLayout();
    const assistant=document.querySelector('.conversation');
    document.body.classList.toggle('magazine-style',readingStyle==='magazine');
    document.body.classList.toggle('reading-focus',layout.focus);
    document.body.classList.toggle('assistant-hidden',!assistantVisible());
    document.querySelector('.library').inert=layout.focus;
    assistant.inert=!assistantVisible();
    $('focusBtn').textContent=layout.focus?uiText("退出专注"):uiText("专注阅读");
    $('focusBtn').setAttribute('aria-pressed',String(layout.focus));
    $('assistantToggle').setAttribute('aria-pressed',String(assistantVisible()));
    $('assistantToggle').textContent=readingStyle==='magazine'&&assistantVisible()?uiText('收起助手'):uiText('阅读助手');
    $('assistantToggle').title=uiText("{0}阅读助手", assistantVisible()?uiText("收起"):uiText("打开"));
    try{localStorage.setItem(readingStyle==='magazine'?MAGAZINE_LAYOUT_KEY:'paper-space-layout',JSON.stringify(layout));}catch{}
    document.dispatchEvent(new CustomEvent('paper-space:layout'));
    if(notify){closeNavigation();onLayoutChange();}
  }
  function toggleFocus(){layout.focus=!layout.focus;applyLayout();}
  function openAssistant(){if(!assistantVisible()){layout.focus=false;layout.assistant=true;narrowOpened=narrow.matches;applyLayout();}}
  $('focusBtn').onclick=toggleFocus;
  $('assistantToggle').onclick=()=>{if(readingStyle!=='magazine'&&narrow.matches){narrowOpened=!assistantVisible();layout.focus=false;if(narrowOpened)layout.assistant=true;}else if(layout.focus){layout.focus=false;layout.assistant=true;}else layout.assistant=!layout.assistant;applyLayout();};
  $('assistantClose').onclick=()=>{narrowOpened=false;layout.assistant=false;applyLayout();$('assistantToggle').focus();};
  narrow.addEventListener('change',()=>{narrowOpened=false;applyLayout();});
  $('findBtn').onclick=()=>open('documents');$('chapterFindBtn').onclick=()=>open('chapters');$('currentChapter').onclick=()=>open('chapters');
  function open(nextScope='chapters'){
    if(document.querySelector('dialog[open]'))return;
    closeNavigation();menu.open=false;scope=nextScope;input.value='';selected=0;opener=document.activeElement;
    dialog.showModal();render();input.focus();
  }
  function close(){if(pending)return;dialog.close();if(opener?.isConnected)opener.focus();}
  $('finderClose').onclick=close;
  dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close();});
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  for(const [id,value] of [['findDocuments','documents'],['findChapters','chapters']])$(id).onclick=()=>{if(pending)return;scope=value;selected=0;render();input.focus();};
  function mark(){
    const nodes=[...results.children];nodes.forEach((e,i)=>{e.classList.toggle('selected',i===selected);e.setAttribute('aria-selected',String(i===selected));});
    const target=nodes[selected];if(target){input.setAttribute('aria-activedescendant',target.id);target.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
  }
  function render(){
    $('findDocuments').setAttribute('aria-pressed',String(scope==='documents'));$('findChapters').setAttribute('aria-pressed',String(scope==='chapters'));
    input.placeholder=scope==='documents'?uiText("输入文献名称…"):uiText("输入章节名称，也可搜索所属主章节…");
    entries=finderEntries({docs:state.docs,doc:state.doc,chapters:getChapters(),scope,query:input.value});
    $('finderCount').textContent=entries.length?uiText("{0} 个结果{1}", entries.length, entries.length>200?uiText(" · 显示前 200 个，请继续输入缩小范围"):''):(scope==='chapters'&&!getChapters().length?uiText("尚未识别到章节，仍可使用顶部翻页。"):uiText("没有匹配结果，试试较短的关键词。"));
    entries=entries.slice(0,200);selected=Math.max(0,Math.min(selected,entries.length-1));results.replaceChildren();
    entries.forEach((entry,i)=>{const b=make('button','finder-result');b.type='button';b.id='finder-result-'+i;b.setAttribute('role','option');b.append(make('span','finder-kind',scope==='documents'?(entry.doc.type||'DOC').toUpperCase():entry.item.depth===0?uiText("章"):uiText("节")));const text=make('span','finder-result-text');text.append(make('strong','',entry.title),make('small','',entry.detail));b.append(text);if(entry.current||entry.item?.index===getActive())b.append(make('small','finder-current',uiText("正在阅读")));b.onclick=()=>choose(i);results.append(b);});mark();
  }
  async function choose(i){
    if(pending||!entries[i])return;if(state.busy||state.mutating){$('finderCount').textContent=uiText("请先结束当前任务，再切换阅读位置。");return;}
    const entry=entries[i];pending=true;input.disabled=true;dialog.setAttribute('aria-busy','true');results.inert=true;
    try{if(entry.doc){if(entry.doc!==state.doc)await activate(entry.doc);}else await navigate(entry.item.page,entry.item);
      pending=false;close();
    }catch{toast(uiText("暂时无法打开，请稍后重试。"));}finally{pending=false;input.disabled=false;results.inert=false;dialog.removeAttribute('aria-busy');}
  }
  input.oninput=()=>{selected=0;render();};
  input.onkeydown=e=>{if(e.isComposing)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();selected=Math.max(0,Math.min(entries.length-1,selected+(e.key==='ArrowDown'?1:-1)));mark();}else if(e.key==='Enter'){e.preventDefault();void choose(selected);}};
  function fitReadingMenu(){if(!menu.open)return;const panel=menu.querySelector('.reading-menu-content'),top=panel.getBoundingClientRect().top;panel.style.maxHeight=Math.max(40,window.innerHeight-top-12)+'px';}
  menu.addEventListener('toggle',()=>requestAnimationFrame(fitReadingMenu));window.addEventListener('resize',()=>requestAnimationFrame(fitReadingMenu));document.fonts?.ready.then(fitReadingMenu);
  menu.addEventListener('click',e=>{if(e.target.closest('button'))menu.open=false;});
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))menu.open=false;});
  const overlayEscape=new WeakSet();
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(document.querySelector('.annotation-drawer,.translation-popup')||!$('chapterWheelPanel')?.hidden||!$('selectionMenu').hidden))overlayEscape.add(e);},true);
  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.isComposing||document.querySelector('dialog[open]')||document.body.classList.contains('is-starting'))return;
    const edit=e.target.closest?.('input,textarea,select,[contenteditable=true]');const key=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&key==='k'){e.preventDefault();open();}
    else if(!edit&&(e.ctrlKey||e.metaKey)&&e.shiftKey&&key==='f'){e.preventDefault();toggleFocus();}
    else if(!edit&&e.altKey&&!e.ctrlKey&&!e.metaKey&&(key==='arrowleft'||key==='arrowright')){e.preventDefault();if(state.doc)void navigate(state.page+(key==='arrowright'?1:-1));}
    else if(e.key==='Escape'){if(menu.open){menu.open=false;return;}if(layout.focus&&!overlayEscape.has(e)&&!document.querySelector('.annotation-drawer,.translation-popup')&&$('selectionMenu').hidden){layout.focus=false;applyLayout();}}
  });
  function update(){
    const item=getChapters()[getActive()],title=item?.title||uiText("浏览章节");
    $('currentChapter').textContent=title;$('currentChapter').title=uiText("{0} · 点击快速跳转", title);
    $('readingProgress').textContent=state.doc?uiText("第 {0} / {1} 页", state.page, state.doc.pages):uiText("开始阅读");
    $('readingProgressBar').style.width=state.doc?Math.min(100,state.page/Math.max(1,state.doc.pages)*100)+'%':'0%';
    $('chapterFindBtn').disabled=!state.doc;$('currentChapter').disabled=!state.doc;$('personalNotesBtn').disabled=!state.doc;
  }
  applyLayout(false);
  function setReadingStyle(value){const next=value==='magazine'?'magazine':'classic';if(next===readingStyle)return true;if(state.busy||state.mutating||document.querySelector('.translation-popup .translation-result[aria-busy="true"]')){toast(uiText('请先结束当前任务，再切换阅读风格。'));return false;}if(!saveReadingStyle(localStorage,next)){toast(uiText('阅读风格未能保存，请检查本机存储。'));return false;}onBeforeLayout();readingStyle=next;layout=next==='magazine'?magazineLayout:classicLayout;narrowOpened=false;applyLayout(false);closeNavigation();onLayoutChange();return true;}
  return{update,openAssistant,open,toggleFocus,setReadingStyle,get readingStyle(){return readingStyle;}};
}
