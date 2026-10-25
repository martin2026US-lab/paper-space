import {uiText,uiError} from './ui-language.mjs';
import {chapterTree,chapterAncestors,stepChapter} from './chapter-navigation.mjs';
import {apertureGeometry,aperturePosition,chapterOrdinals,apertureStep} from './aperture-layout.mjs';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(label,fn,cls)=>{const b=el('button',cls,label);b.type='button';b.onclick=fn;return b;};
const icon=name=>{const img=el('img','aperture-icon');img.src='/vendor/phosphor/'+name+'.svg';img.alt='';return img;};
const svgNode=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,String(v));return n;};

export function createChapterNavigation({host,getItems,onNavigate,onNotes=()=>{},getNoteCount=()=>0,isBusy=()=>false}){
 let items=[],tree=[],docId=null,signature='',active=-1,candidate=0,ordinals=[],paths=[],pending=false,revision=0,geometry,drag=null,suppressClick=false;
 let rows=[],visible=new Set(),position=0,destination=0,motionFrame=0,layoutFrame=0,lastTime=0,wheelTimer,metadataKey='',lastCandidate=-1,lastActive=-1,numberWidth=30;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 host.classList.add('aperture-outline');host.replaceChildren();
 const empty=el('p','chapter-empty',uiText('尚未识别到章节，可使用顶部翻页。'));
 const lens=el('section','chapter-aperture');lens.setAttribute('aria-label',uiText('弧形章节目录'));
 const heading=el('div','aperture-heading'),meta=el('div','aperture-meta'),status=el('span','aperture-status'),count=el('span','aperture-count');
 meta.append(status,count);const title=el('strong','aperture-title'),trail=el('p','aperture-path');heading.append(meta,title,trail);
 const viewport=el('div','aperture-viewport');viewport.id='chapterAperture';viewport.tabIndex=0;viewport.setAttribute('role','listbox');viewport.setAttribute('aria-label',uiText('章节目录'));viewport.setAttribute('aria-describedby','apertureHelp');
 const svg=svgNode('svg',{'aria-hidden':'true',focusable:'false',class:'aperture-scale'}),track=svgNode('path',{class:'aperture-track'}),rim=svgNode('path',{class:'aperture-rim'}),ticks=svgNode('g',{class:'aperture-ticks'});
 svg.append(track,rim,ticks);const choices=el('div','aperture-choices'),pointer=el('i','aperture-pointer');pointer.setAttribute('aria-hidden','true');viewport.append(svg,choices,pointer);
 const footer=el('div','aperture-footer'),controls=el('div','aperture-controls');
 const previous=button('',()=>select(Math.round(destination)-1),'aperture-step aperture-previous'),next=button('',()=>select(Math.round(destination)+1),'aperture-step aperture-next');
 previous.append(icon('arrow-left'));next.append(icon('arrow-left'));previous.setAttribute('aria-label',uiText('上一章节'));next.setAttribute('aria-label',uiText('下一章节'));
 const enter=button('',()=>navigate(items[candidate]),'aperture-enter');enter.id='chapterApertureEnter';controls.append(previous,enter,next);
 const notes=button('',()=>{if(items[candidate]&&!pending)onNotes(items[candidate]);},'aperture-notes chapter-note-button');notes.id='chapterApertureNotes';
 const noteText=document.createTextNode('');notes.append(icon('note-pencil'),noteText);
 const help=el('p','aperture-help',uiText('滚动或拖动选择 · 点击阅读'));help.id='apertureHelp';footer.append(controls,notes,help);lens.append(heading,viewport,footer);host.append(empty,lens);
 const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
 const clamp=value=>Math.max(0,Math.min(Math.max(0,items.length-1),Number.isFinite(value)?value:0));

 function layout(){
  const box=viewport.getBoundingClientRect();if(!box.width||!box.height)return;
  if(geometry&&Math.abs(geometry.width-box.width)<.5&&Math.abs(geometry.height-box.height)<.5)return;
  geometry=apertureGeometry(box.width,box.height);const {width,height,radius,cx,cy,step}=geometry;
  svg.setAttribute('viewBox','0 0 '+width+' '+height);
  const point=(r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)],a=point(radius,-Math.PI*.49),b=point(radius,Math.PI*.49),path='M '+a.join(' ')+' A '+radius+' '+radius+' 0 0 1 '+b.join(' ');
  track.setAttribute('d',path);rim.setAttribute('d',path);
  const marks=document.createDocumentFragment(),limit=Math.ceil(100/step*8);
  for(let j=-limit;j<=limit;j++){const angle=j*step/8*Math.PI/180,major=j%8===0,start=point(radius,angle),end=point(radius-(major?15:j%4===0?9:5),angle);marks.append(svgNode('line',{x1:start[0],y1:start[1],x2:end[0],y2:end[1],class:major?'aperture-tick major':'aperture-tick'}));}
  ticks.replaceChildren(marks);pointer.style.top=cy+'px';viewport.style.setProperty('--aperture-number-width',numberWidth+'px');requestPaint();
 }
 function scheduleLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;layout();});}
 function markSelection(){
  for(const index of new Set([lastCandidate,candidate,lastActive,active])){const row=rows[index];if(!row)continue;const selected=index===candidate,reading=index===active;row.node.classList.toggle('is-selected',selected);row.node.classList.toggle('is-reading',reading);row.target.classList.toggle('active',reading);row.target.setAttribute('aria-selected',String(selected));if(reading)row.target.setAttribute('aria-current','location');else row.target.removeAttribute('aria-current');}
  lastCandidate=candidate;lastActive=active;
 }
 function paint(){
  if(!geometry||!items.length)return;
  const nowVisible=new Set(),range=Math.ceil(geometry.height/(2*geometry.spacing))+2;
  const first=Math.max(0,Math.floor(position)-range),last=Math.min(rows.length-1,Math.ceil(position)+range);
  for(let i=first;i<=last;i++){
   const row=rows[i],p=aperturePosition(geometry,i-position),show=p.visible&&p.y>=40&&p.y<=geometry.height-40;
   if(!show)continue;nowVisible.add(i);if(!row.visible){row.node.hidden=false;row.node.inert=false;row.visible=true;}
   // Only the small visible window is positioned. No layout reads in this hot path.
   row.node.style.transform='translate3d(10px,'+(p.y-38).toFixed(2)+'px,0)';
   row.node.style.width=Math.min(geometry.width-18,p.labelRight).toFixed(2)+'px';
  }
  for(const i of visible)if(!nowVisible.has(i)){const row=rows[i];row.node.hidden=true;row.node.inert=true;row.visible=false;}
  visible=nowVisible;
  const phase=(position-Math.round(position))*geometry.step;
  ticks.setAttribute('transform','rotate('+(-phase).toFixed(4)+' '+geometry.cx+' '+geometry.cy+')');
 }
 function requestPaint(){if(!motionFrame)motionFrame=requestAnimationFrame(animate);}
 function animate(time){
  motionFrame=0;if(!items.length||!geometry){lastTime=0;return;}
  const elapsed=lastTime?Math.min(32,time-lastTime):16.67;lastTime=time;
  position=apertureStep(position,destination,elapsed,reduced.matches||!!drag);
  const nearest=Math.round(position);if(nearest!==candidate){candidate=nearest;renderMetadata();}
  paint();if(Math.abs(position-destination)>.001)requestPaint();else lastTime=0;
 }
 function stopMotion(){clearTimeout(wheelTimer);if(motionFrame)cancelAnimationFrame(motionFrame);motionFrame=0;lastTime=0;}
 function setPosition(value,immediate=false){
  destination=clamp(value);if(immediate||Math.abs(destination-position)>5){position=destination;candidate=Math.round(position);renderMetadata();}
  requestPaint();
 }
 function select(index){if(pending||!items.length)return;clearTimeout(wheelTimer);setPosition(index);}
 function renderChoices(){
  const fragment=document.createDocumentFragment();visible.clear();rows=[];lastActive=-1;lastCandidate=-1;
  numberWidth=Math.min(56,Math.max(30,...ordinals.map(n=>n.length*6+5)));viewport.style.setProperty('--aperture-number-width',numberWidth+'px');
  items.forEach((item,index)=>{
   const row=el('div','aperture-item chapter-row');row.dataset.index=index;row.dataset.key=item.key;row.dataset.depth=item.depth||0;row.hidden=true;row.inert=true;
   const ordinal=el('span','aperture-ordinal',ordinals[index]);ordinal.setAttribute('aria-hidden','true');
   const target=button(item.title,()=>{if(suppressClick){suppressClick=false;return;}setPosition(index,true);void navigate(item);},'chapter-target');
   target.id='aperture-option-'+index;target.dataset.key=item.key;target.dataset.index=index;target.title=item.title;target.tabIndex=-1;target.setAttribute('role','option');target.setAttribute('aria-selected','false');target.setAttribute('aria-label',item.title+' · '+uiText('第 {0} 页',item.page));
   row.append(ordinal,target);fragment.append(row);rows.push({node:row,target,ordinal,visible:false});
  });choices.replaceChildren(fragment);metadataKey='';
 }
 function renderMetadata(force=false){
  empty.hidden=!!items.length;lens.hidden=!items.length;if(!items.length)return;
  const key=candidate+'|'+active+'|'+pending;if(!force&&key===metadataKey)return;metadataKey=key;
  const item=items[candidate];text(status,candidate===active?uiText('正在阅读'):uiText('选择章节'));
  text(count,String(candidate+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0'));
  text(title,item.title);title.title=item.title;title.scrollTop=0;
  text(trail,paths[candidate].slice(0,-1).join(' / ')||uiText('第 {0} 页',item.page));trail.title=paths[candidate].join(' / ');
  text(enter,pending?uiText('正在打开…'):candidate===active?uiText('定位本章'):uiText('阅读此章'));enter.disabled=pending;previous.disabled=pending||candidate<=0;next.disabled=pending||candidate>=items.length-1;
  viewport.setAttribute('aria-activedescendant','aperture-option-'+candidate);viewport.setAttribute('aria-busy',String(pending));
  const n=getNoteCount(item),label=n?uiText('本章批注 · {0}',n):uiText('本章批注');if(noteText.data!==label)noteText.data=label;notes.dataset.key=item.key;notes.disabled=pending;notes.title=item.title+' · '+uiText('本章批注');markSelection();
 }
 async function navigate(item){
  if(!item||pending)return;if(isBusy()){text(trail,uiText('请先结束当前任务，再切换阅读位置。'));return;}
  stopMotion();setPosition(items.indexOf(item),true);const token=++revision;let failure;pending=true;renderMetadata();
  try{await onNavigate(item);}catch(error){failure=uiError(error.message);}
  finally{if(token===revision){pending=false;setPosition(active>=0?active:candidate,true);renderMetadata(true);if(failure)text(trail,failure);}}
 }
 function setActive(index){
  if(index===active)return;active=index;
  if(active>=0&&!drag){stopMotion();setPosition(active,true);}else renderMetadata();
 }
 function update(id,index){
  if(!host.contains(lens))host.replaceChildren(empty,lens);
  const nextItems=getItems(),key=JSON.stringify(nextItems.map(i=>[i.key,i.depth,i.blockId,i.y]));
  if(id!==docId){docId=id;signature='';revision++;pending=false;drag=null;stopMotion();position=destination=Math.max(0,index);candidate=Math.max(0,index);}
  items=nextItems;if(key!==signature){signature=key;tree=chapterTree(items);ordinals=chapterOrdinals(items);paths=items.map(i=>chapterAncestors(tree,i.key).map(c=>c.title));position=destination=clamp(index);candidate=Math.round(position);renderChoices();}
  setActive(index);renderMetadata();scheduleLayout();requestPaint();
 }
 function close(){drag=null;stopMotion();setPosition(active>=0?active:candidate,true);}
 viewport.addEventListener('wheel',event=>{
  if(!items.length||pending)return;event.preventDefault();const scale=event.deltaMode===1?18:event.deltaMode===2?(geometry?.height||300):1;
  setPosition(destination+(event.deltaY||event.deltaX)*scale/100);
  clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>setPosition(Math.round(destination)),120);
 },{passive:false});
 viewport.addEventListener('keydown',event=>{
  if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End','PageDown','PageUp'].includes(event.key)){event.preventDefault();const base=Math.round(destination);select(event.key==='Home'?0:event.key==='End'?items.length-1:event.key==='PageDown'?base+5:event.key==='PageUp'?base-5:stepChapter(base,['ArrowDown','ArrowRight'].includes(event.key)?1:-1,items.length));}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();void navigate(items[candidate]);}
  else if(event.key==='Escape'&&(candidate!==active||Math.abs(position-active)>.001)){event.preventDefault();close();}
 });
 viewport.addEventListener('pointerdown',event=>{if(event.button!==0||pending)return;stopMotion();destination=position;drag={id:event.pointerId,y:event.clientY,index:position,moved:false};});
 viewport.addEventListener('pointermove',event=>{
  if(!drag||drag.id!==event.pointerId)return;const dy=event.clientY-drag.y;
  if(!drag.moved&&Math.abs(dy)>7){drag.moved=true;viewport.setPointerCapture(event.pointerId);}
  if(drag.moved){event.preventDefault();setPosition(drag.index-dy/(geometry?.spacing||84));}
 });
 function endDrag(event){
  if(!drag||drag.id!==event.pointerId)return;const moved=drag.moved;suppressClick=moved;drag=null;
  if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
  if(moved){setPosition(Math.round(destination));setTimeout(()=>suppressClick=false,0);}
 }
 viewport.addEventListener('lostpointercapture',()=>{if(drag){drag=null;setPosition(Math.round(destination));}});
 viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',()=>{drag=null;suppressClick=false;setPosition(Math.round(destination));});
 const resize=new ResizeObserver(scheduleLayout);resize.observe(viewport);
 document.addEventListener('paper-space:sidebar',scheduleLayout);document.addEventListener('paper-space:layout',scheduleLayout);
 renderMetadata();return{update,setActive,close,refreshNotes:()=>renderMetadata(true)};
}
