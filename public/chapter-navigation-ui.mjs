import {uiText,uiError} from './ui-language.mjs';
import {chapterTree,chapterAncestors,stepChapter} from './chapter-navigation.mjs';
import {apertureGeometry,aperturePosition,chapterOrdinals} from './aperture-layout.mjs';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(label,fn,cls)=>{const b=el('button',cls,label);b.type='button';b.onclick=fn;return b;};
const icon=name=>{const img=el('img','aperture-icon');img.src='/vendor/phosphor/'+name+'.svg';img.alt='';return img;};
const svgNode=(tag,attrs)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs||{}))node.setAttribute(key,String(value));return node;};

export function createChapterNavigation({host,getItems,onNavigate,onNotes=()=>{},getNoteCount=()=>0,isBusy=()=>false}){
 let items=[],tree=[],docId=null,signature='',active=-1,candidate=0,ordinals=[],pending=false,revision=0,geometry,drag=null,suppressClick=false,wheelCarry=0,wheelAt=0,frame;
 host.classList.add('aperture-outline');host.replaceChildren();
 const empty=el('p','chapter-empty',uiText('尚未识别到章节，可使用顶部翻页。'));
 const lens=el('section','chapter-aperture');lens.setAttribute('aria-label',uiText('弧形章节目录'));
 const heading=el('div','aperture-heading'),meta=el('div','aperture-meta'),status=el('span','aperture-status'),count=el('span','aperture-count');
 meta.append(status,count);const title=el('strong','aperture-title'),trail=el('p','aperture-path');heading.append(meta,title,trail);
 const viewport=el('div','aperture-viewport');viewport.id='chapterAperture';viewport.tabIndex=0;viewport.setAttribute('role','listbox');viewport.setAttribute('aria-label',uiText('章节目录'));viewport.setAttribute('aria-describedby','apertureHelp');
 const svg=svgNode('svg',{'aria-hidden':'true',focusable:'false',class:'aperture-scale'}),choices=el('div','aperture-choices'),pointer=el('i','aperture-pointer');pointer.setAttribute('aria-hidden','true');viewport.append(svg,choices,pointer);
 const footer=el('div','aperture-footer'),controls=el('div','aperture-controls'),previous=button('',()=>select(candidate-1),'aperture-step aperture-previous'),next=button('',()=>select(candidate+1),'aperture-step aperture-next');
 previous.append(icon('arrow-left'));next.append(icon('arrow-left'));previous.setAttribute('aria-label',uiText('上一章节'));next.setAttribute('aria-label',uiText('下一章节'));
 const enter=button('',()=>navigate(items[candidate]),'aperture-enter');enter.id='chapterApertureEnter';controls.append(previous,enter,next);
 const notes=button('',()=>{const item=items[candidate];if(item&&!pending)onNotes(item);},'aperture-notes chapter-note-button');notes.id='chapterApertureNotes';
 const help=el('p','aperture-help',uiText('滚动或拖动选择 · 点击阅读'));help.id='apertureHelp';footer.append(controls,notes,help);lens.append(heading,viewport,footer);host.append(empty,lens);

 function layout(){
  const box=viewport.getBoundingClientRect();if(!box.width||!box.height)return;
  geometry=apertureGeometry(box.width,box.height);const {width,height,radius,cx,cy,step}=geometry;svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.replaceChildren();
  const point=(r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)],begin=point(radius,-Math.PI*.45),end=point(radius,Math.PI*.45),path='M '+begin.join(' ')+' A '+radius+' '+radius+' 0 0 1 '+end.join(' ');
  svg.append(svgNode('path',{d:path,class:'aperture-track'}),svgNode('path',{d:path,class:'aperture-rim'}));
  for(let j=-48;j<=48;j++){const angle=j*step/8*Math.PI/180;if(Math.abs(angle)>Math.PI*.45)continue;const major=j%8===0,a=point(radius,angle),b=point(radius-(major?18:j%4===0?11:6),angle);svg.append(svgNode('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:major?'aperture-tick major':'aperture-tick'}));}
  pointer.style.top=cy+'px';positionChoices();
 }
 function positionChoices(){
  if(!geometry)return;
  for(const row of choices.children){const index=Number(row.dataset.index),p=aperturePosition(geometry,index-candidate);row.hidden=!p.visible||p.y<44||p.y>geometry.height-44;row.inert=row.hidden;row.style.top=p.y+'px';row.style.width=Math.min(geometry.width-14,p.labelRight)+'px';row.style.setProperty('--aperture-label-right',p.labelRight+'px');row.classList.toggle('is-selected',index===candidate);row.classList.toggle('is-reading',index===active);const target=row.querySelector('.chapter-target');target.classList.toggle('active',index===active);target.setAttribute('aria-selected',String(index===candidate));if(index===active)target.setAttribute('aria-current','location');else target.removeAttribute('aria-current');}
 }
 function renderChoices(){
  choices.replaceChildren();items.forEach((item,index)=>{const row=el('div','aperture-item chapter-row');row.dataset.index=index;row.dataset.key=item.key;row.dataset.depth=item.depth||0;
   const ordinal=el('span','aperture-ordinal',ordinals[index]);ordinal.setAttribute('aria-hidden','true');
   const target=button(item.title,()=>{if(suppressClick){suppressClick=false;return;}select(index);void navigate(item);},'chapter-target');target.id='aperture-option-'+index;target.dataset.key=item.key;target.dataset.index=index;target.title=item.title;target.tabIndex=-1;target.setAttribute('role','option');target.setAttribute('aria-label',item.title+' · '+uiText('第 {0} 页',item.page));row.append(target,ordinal);choices.append(row);});
 }
 function refreshNotes(){const item=items[candidate],n=item?getNoteCount(item):0;notes.replaceChildren(icon('note-pencil'),document.createTextNode(n?uiText('本章批注 · {0}',n):uiText('本章批注')));notes.dataset.key=item?.key||'';notes.disabled=!item||pending;notes.title=item?item.title+' · '+uiText('本章批注'):uiText('本章批注');}
 function renderSelection(){
  empty.hidden=!!items.length;lens.hidden=!items.length;if(!items.length)return;
  const item=items[candidate];status.textContent=candidate===active?uiText('正在阅读'):uiText('选择章节');count.textContent=String(candidate+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');title.textContent=item.title;
  trail.textContent=chapterAncestors(tree,item.key).slice(0,-1).map(c=>c.title).join(' / ')||uiText('第 {0} 页',item.page);trail.title=chapterAncestors(tree,item.key).map(c=>c.title).join(' / ');
  enter.textContent=pending?uiText('正在打开…'):candidate===active?uiText('定位本章'):uiText('阅读此章');enter.disabled=pending||!item;previous.disabled=pending||candidate<=0;next.disabled=pending||candidate>=items.length-1;
  viewport.setAttribute('aria-activedescendant','aperture-option-'+candidate);viewport.setAttribute('aria-busy',String(pending));refreshNotes();positionChoices();
 }
 function select(index){if(pending||!items.length)return;candidate=Math.max(0,Math.min(items.length-1,index));renderSelection();}
 async function navigate(item){
  if(!item||pending)return;
  if(isBusy()){trail.textContent=uiText('请先结束当前任务，再切换阅读位置。');return;}
  const token=++revision;let failure;pending=true;renderSelection();
  try{await onNavigate(item);}catch(error){failure=uiError(error.message);}
  finally{if(token===revision){pending=false;candidate=active>=0?Math.min(active,items.length-1):candidate;renderSelection();if(failure)trail.textContent=failure;}}
 }
 function setActive(index){if(index===active)return;active=index;if(active>=0&&!drag)candidate=active;renderSelection();}
 function update(id,index){
  const nextItems=getItems(),key=JSON.stringify(nextItems.map(i=>[i.key,i.depth,i.blockId,i.y]));
  if(id!==docId){docId=id;signature='';revision++;pending=false;drag=null;wheelCarry=0;candidate=Math.max(0,index);}
  items=nextItems;if(key!==signature){signature=key;tree=chapterTree(items);ordinals=chapterOrdinals(items);candidate=Math.max(0,Math.min(items.length-1,index));renderChoices();}
  setActive(index);renderSelection();layout();
 }
 function close(){drag=null;wheelCarry=0;if(active>=0)candidate=active;renderSelection();}
 viewport.addEventListener('wheel',event=>{if(!items.length||pending)return;event.preventDefault();const now=Date.now();if(now-wheelAt>180)wheelCarry=0;wheelAt=now;wheelCarry+=(event.deltaY||event.deltaX)*(event.deltaMode===1?20:1);const steps=Math.max(-3,Math.min(3,Math.trunc(wheelCarry/55)));if(steps){wheelCarry-=steps*55;select(candidate+steps);}},{passive:false});
 viewport.addEventListener('keydown',event=>{
  if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End','PageDown','PageUp'].includes(event.key)){event.preventDefault();select(event.key==='Home'?0:event.key==='End'?items.length-1:event.key==='PageDown'?candidate+5:event.key==='PageUp'?candidate-5:stepChapter(candidate,['ArrowDown','ArrowRight'].includes(event.key)?1:-1,items.length));}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();void navigate(items[candidate]);}
  else if(event.key==='Escape'&&candidate!==active){event.preventDefault();close();}
 });
 viewport.addEventListener('pointerdown',event=>{if(event.button!==0||pending)return;drag={id:event.pointerId,y:event.clientY,index:candidate,moved:false};});
 viewport.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const dy=event.clientY-drag.y;if(!drag.moved&&Math.abs(dy)>7){drag.moved=true;viewport.setPointerCapture(event.pointerId);}if(drag.moved){event.preventDefault();select(drag.index-Math.round(dy/75));}});
 function endDrag(event){if(!drag||drag.id!==event.pointerId)return;suppressClick=drag.moved;drag=null;if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);if(suppressClick)setTimeout(()=>suppressClick=false,0);}
 viewport.addEventListener('lostpointercapture',()=>{drag=null;});viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',()=>{drag=null;suppressClick=false;});
 const resize=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);});resize.observe(viewport);
 document.addEventListener('paper-space:sidebar',()=>requestAnimationFrame(layout));document.addEventListener('paper-space:layout',()=>requestAnimationFrame(layout));
 renderSelection();return{update,setActive,close,refreshNotes};
}
