import {chapterTree,chapterAncestors} from './chapter-navigation.mjs';

export function matchesQuery(text,query){
  const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
  const haystack=normalize(text);
  return normalize(query).split(' ').filter(Boolean).every(term=>haystack.includes(term));
}
export function finderEntries({docs,doc,chapters,scope,query=''}){
  if(scope==='documents')return docs.filter(d=>!d.deletedAt&&matchesQuery(d.name,query)).map(d=>({key:d.id,title:d.name,detail:(d.type||'文献').toUpperCase()+' · '+d.pages+(d.type==='pdf'?' 页':' 阅读页'),doc:d,current:d.id===doc?.id}));
  const tree=chapterTree(chapters);
  return chapters.map(item=>{const path=chapterAncestors(tree,item.key).slice(0,-1).map(p=>p.title).join(' › ');return{key:item.key,title:item.title,detail:path||'主章节',item};}).filter(e=>matchesQuery(e.title+' '+e.detail,query));
}
export function loadLayout(storage){
  try{const v=JSON.parse(storage.getItem('paper-space-layout')||'{}');return{focus:v.focus===true,assistant:v.assistant!==false};}catch{return{focus:false,assistant:true};}
}
export function createWorkspaceTools({state,getChapters,getActive,navigate,activate,toast,onLayoutChange,onBeforeLayout=()=>{},closeNavigation=()=>{}}){
  const $=id=>document.getElementById(id),layout=loadLayout(localStorage),dialog=$('finderDialog'),input=$('finderInput'),results=$('finderResults'),menu=$('readingMenu');
  let scope='chapters',entries=[],selected=0,opener=null,pending=false;
  const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  function applyLayout(notify=true){
    if(notify)onBeforeLayout();
    const assistant=document.querySelector('.conversation');
    document.body.classList.toggle('reading-focus',layout.focus);
    document.body.classList.toggle('assistant-hidden',!layout.assistant);
    document.querySelector('.library').inert=layout.focus;
    assistant.inert=layout.focus||!layout.assistant;
    $('focusBtn').textContent=layout.focus?'退出专注':'专注阅读';
    $('focusBtn').setAttribute('aria-pressed',String(layout.focus));
    $('assistantToggle').setAttribute('aria-pressed',String(!layout.focus&&layout.assistant));
    $('assistantToggle').title=(!layout.focus&&layout.assistant?'收起':'打开')+'阅读助手';
    try{localStorage.setItem('paper-space-layout',JSON.stringify(layout));}catch{}
    if(notify){closeNavigation();onLayoutChange();}
  }
  function toggleFocus(){layout.focus=!layout.focus;applyLayout();}
  function openAssistant(){if(layout.focus||!layout.assistant){layout.focus=false;layout.assistant=true;applyLayout();}}
  $('focusBtn').onclick=toggleFocus;
  $('assistantToggle').onclick=()=>{if(layout.focus){layout.focus=false;layout.assistant=true;}else layout.assistant=!layout.assistant;applyLayout();};
  $('assistantClose').onclick=()=>{layout.assistant=false;applyLayout();$('assistantToggle').focus();};
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
    input.placeholder=scope==='documents'?'输入文献名称…':'输入章节名称，也可搜索所属主章节…';
    entries=finderEntries({docs:state.docs,doc:state.doc,chapters:getChapters(),scope,query:input.value});
    $('finderCount').textContent=entries.length?entries.length+' 个结果'+(entries.length>200?' · 显示前 200 个，请继续输入缩小范围':''):(scope==='chapters'&&!getChapters().length?'尚未识别到章节，仍可使用顶部翻页。':'没有匹配结果，试试较短的关键词。');
    entries=entries.slice(0,200);selected=Math.max(0,Math.min(selected,entries.length-1));results.replaceChildren();
    entries.forEach((entry,i)=>{const b=make('button','finder-result');b.type='button';b.id='finder-result-'+i;b.setAttribute('role','option');b.append(make('span','finder-kind',scope==='documents'?(entry.doc.type||'DOC').toUpperCase():entry.item.depth===0?'章':'节'));const text=make('span','finder-result-text');text.append(make('strong','',entry.title),make('small','',entry.detail));b.append(text);if(entry.current||entry.item?.index===getActive())b.append(make('small','finder-current','正在阅读'));b.onclick=()=>choose(i);results.append(b);});mark();
  }
  async function choose(i){
    if(pending||!entries[i])return;if(state.busy||state.mutating){$('finderCount').textContent='请先结束当前任务，再切换阅读位置。';return;}
    const entry=entries[i];pending=true;input.disabled=true;dialog.setAttribute('aria-busy','true');results.inert=true;
    try{if(entry.doc){if(entry.doc!==state.doc)await activate(entry.doc);}else await navigate(entry.item.page,entry.item);
      pending=false;close();
    }catch{toast('暂时无法打开，请稍后重试。');}finally{pending=false;input.disabled=false;results.inert=false;dialog.removeAttribute('aria-busy');}
  }
  input.oninput=()=>{selected=0;render();};
  input.onkeydown=e=>{if(e.isComposing)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();selected=Math.max(0,Math.min(entries.length-1,selected+(e.key==='ArrowDown'?1:-1)));mark();}else if(e.key==='Enter'){e.preventDefault();void choose(selected);}};
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
    const item=getChapters()[getActive()],title=item?.title||'浏览章节';
    $('currentChapter').textContent=title;$('currentChapter').title=title+' · 点击快速跳转';
    $('readingProgress').textContent=state.doc?'第 '+state.page+' / '+state.doc.pages+' 页':'开始阅读';
    $('readingProgressBar').style.width=state.doc?Math.min(100,state.page/Math.max(1,state.doc.pages)*100)+'%':'0%';
    $('chapterFindBtn').disabled=!state.doc;$('currentChapter').disabled=!state.doc;$('personalNotesBtn').disabled=!state.doc;
  }
  applyLayout(false);
  return{update,openAssistant,open};
}
