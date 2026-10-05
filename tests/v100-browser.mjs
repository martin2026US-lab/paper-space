// Isolated regression fixture: explicitly acknowledge the notice before exercising the app.
import {saveUsageConsent} from '/usage-consent.mjs';saveUsageConsent(localStorage);
import * as pdfjs from '/vendor/pdfjs/build/pdf.mjs';import {extractPdfParagraphs} from '/pdf-layout.mjs';import {pdfNavigation} from '/pdf-navigation.mjs';import {readingUnits} from '/reading-units.mjs';import {pdfBlockSpans} from '/pdf-text.mjs';
pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/build/pdf.worker.mjs';
const out=document.getElementById('results');let passed=0,failed=0;const assert=(v,m)=>{if(!v)throw Error(m);},sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label='condition',timeout=15000){const t=Date.now();while(Date.now()-t<timeout){if(await fn())return;await sleep(40);}throw Error('Timeout '+label);}
async function test(name,fn){try{await fn();passed++;out.textContent+='\nPASS '+name;}catch(e){failed++;out.textContent+='\nFAIL '+name+': '+e.message;}}
async function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('paper-space',2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('documents'))r.result.createObjectStore('documents',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function put(d){const db=await database();await new Promise((r,j)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put(d);tx.oncomplete=r;tx.onerror=j;});db.close();}
async function saved(id=docId){const db=await database();const d=await new Promise((r,j)=>{const x=db.transaction('documents').objectStore('documents').get(id);x.onsuccess=()=>r(x.result);x.onerror=j;});db.close();return d;}

const bytes=await(await fetch('/cross.pdf')).arrayBuffer(),pdf=await pdfjs.getDocument({data:bytes.slice(0)}).promise,blocks=[];
for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n);blocks.push(...extractPdfParagraphs(await p.getTextContent(),p.getViewport({scale:1}),n));}
for(const b of blocks)b.heading=/^(First|Later|Final) section$/.test(b.text.trim());
const docId='v100-'+Date.now(),wordId=docId+'word',sampleId=docId+'sample';
await put({id:docId,name:'导航回归测试.pdf',type:'pdf',bytes,blocks,pages:2,parser:'docling',doclingLayoutVersion:1,history:[],cards:[],code:[],summary:'',lastPage:1,...await pdfNavigation(pdf,blocks)});
const {readWordHTML}=await import('/word-import.mjs');const wp=readWordHTML('<h1>5 Training</h1><p>'+('Opening paragraph for semantic Word reading. '.repeat(28))+'</p><h2>5.1 Training Data and Batching</h2><p>'+('Training data and batches. '.repeat(28))+'</p><h2>5.2 Hardware and Schedule</h2><p>'+('Hardware schedule. '.repeat(28))+'</p><h2>5.3 Optimizer</h2><p>Last section.</p><h1>6 Results</h1><p>Results.</p>');
await put({id:wordId,name:'章节层级与定位-'+wordId+'.docx',type:'docx',...wp,history:[],cards:[],code:[],summary:'',lastPage:1});
localStorage.removeItem('paper-space-layout');localStorage.setItem('paper-space-active-doc',docId);localStorage.setItem('paper-space-seeded','1');localStorage.removeItem('paper-space-models');
const frame=document.createElement('iframe');frame.src='/';document.getElementById('frame').append(frame);const $=id=>frame.contentDocument?.getElementById(id),q=s=>frame.contentDocument?.querySelector(s),all=s=>[...frame.contentDocument.querySelectorAll(s)];
const chapter=t=>all('.chapter-target').find(b=>b.textContent===t),clickDoc=t=>all('.document-item').find(b=>b.textContent.includes(t)).click();
const ready=()=>until(()=>$('startupScreen')?.hidden&&q('.pdf-paragraph-notice'),'ready',30000);await ready();

const nativeBefore=(await(await fetch('/test-requests')).json()).length;
const ratio=()=>$('readerScroll').scrollTop/Math.max(1,$('readerScroll').scrollHeight-$('readerScroll').clientHeight);
await test('Focus reading expands original PDF and preserves reading position',async()=>{
 chapter('Later section').click();await until(()=>q('.chapter-target.active')?.textContent==='Later section');await sleep(100);
 const previous=ratio(),canvas=q('canvas'),width=q('.pdf-page').getBoundingClientRect().width;
 $('focusBtn').click();await until(()=>q('canvas')!==canvas&&q('.pdf-paragraph-notice'));await sleep(150);
 assert(frame.contentWindow.getComputedStyle(q('.library')).display==='none','library not hidden');
 assert(q('.conversation').inert,'hidden assistant still interactive');assert(q('.pdf-page').getBoundingClientRect().width>width,'paper did not expand');
 assert(Math.abs(ratio()-previous)<.03,'reading position lost');
});
await test('Layout preference survives reload and explicit assistant opens from focus mode',async()=>{
 const previousDocument=frame.contentDocument;frame.contentWindow.location.reload();await until(()=>frame.contentDocument!==previousDocument,'reload committed');await ready();assert(frame.contentDocument.body.classList.contains('reading-focus'),'focus not restored');
 $('assistantToggle').click();await until(()=>!frame.contentDocument.body.classList.contains('reading-focus'));await sleep(350);
 assert(!q('.conversation').inert,'assistant not restored');assert(!q('.library').inert,'library not restored');
});
await test('Closing assistant preserves the question draft and restores keyboard focus',async()=>{
 $('question').value='Keep this local draft';$('assistantClose').click();await sleep(350);
 assert($('question').value==='Keep this local draft','draft discarded');assert(frame.contentDocument.activeElement===$('assistantToggle'),'focus left hidden: '+frame.contentDocument.activeElement?.outerHTML.slice(0,180));
 $('assistantToggle').click();await sleep(350);assert($('question').value==='Keep this local draft','draft discarded on reopen');
 $('question').value='';
});
await test('Quick finder supports document search, clear empty state and text-safe rendering',async()=>{
 $('findBtn').click();$('finderInput').value='no matching title';$('finderInput').dispatchEvent(new Event('input'));assert(!q('.finder-result'),'unexpected results');
 assert($('finderCount').textContent.includes('没有匹配'),'empty state missing');
 $('finderInput').value='章节层级与定位';$('finderInput').dispatchEvent(new Event('input'));assert(all('.finder-result').length>=1,'word result absent');
 q('.finder-result').click();await until(()=>q('.word-page')&&!$('finderDialog').open);
 assert($('docTitle').textContent.includes('章节层级与定位'),'did not switch');
});
await test('Search by parent plus child opens exact same-page Word heading',async()=>{
 $('chapterFindBtn').click();$('finderInput').value='Training Hardware';$('finderInput').dispatchEvent(new Event('input'));
 assert(all('.finder-result').length===1,'ancestor query incorrect');assert(q('.finder-result small').textContent==='Training','hierarchy context missing');
 $('finderInput').dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 await until(()=>!$('finderDialog').open&&q('.chapter-target.active')?.textContent==='Hardware and Schedule');
 assert($('currentChapter').textContent==='Hardware and Schedule','location not synced');assert($('readerScroll').scrollTop>0,'position not located');
});
await test('Arrow selection and Enter use the chosen result; Escape returns focus to opener',async()=>{
 $('currentChapter').click();$('finderInput').value='Training';$('finderInput').dispatchEvent(new Event('input'));
 $('finderInput').dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
 assert($('finderInput').getAttribute('aria-activedescendant')==='finder-result-1','arrow did not select');
 $('finderInput').dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 await until(()=>!$('finderDialog').open);assert(q('.chapter-target.active').textContent==='Training Data and Batching','wrong keyboard destination');
 $('currentChapter').focus();$('currentChapter').click();$('finderDialog').dispatchEvent(new Event('cancel',{cancelable:true}));assert(!$('finderDialog').open,'cancel failed');
 assert(frame.contentDocument.activeElement===$('currentChapter'),'focus not returned: '+frame.contentDocument.activeElement?.outerHTML.slice(0,180));
});
await test('Layout changes followed immediately by navigation cannot restore an old page position',async()=>{
 clickDoc('导航回归测试');await until(()=>q('.pdf-paragraph-notice'));$('focusBtn').click();chapter('Final section').click();
 await until(()=>q('.pdf-page')?.dataset.page==='2'&&q('.pdf-paragraph-notice'));await sleep(400);
 assert($('pageInput').value==='2'&&q('.chapter-target.active')?.textContent==='Final section','resize superseded navigation');
 $('focusBtn').click();await sleep(350);
});
await test('Sidebar and picker behavior still works after focus mode',async()=>{
 $('chapterWheelBtn').click();assert(!$('chapterWheelPanel').hidden,'picker unavailable');
 q('.chapter-dial-center').click();await sleep(250);assert(!$('chapterWheelPanel').hidden,'picker closed after selection');
 frame.contentDocument.body.dispatchEvent(new frame.contentWindow.PointerEvent('pointerdown',{bubbles:true}));assert($('chapterWheelPanel').hidden,'outside dismissal failed');
});
await test('More tools are reachable and dismiss after choosing a command',async()=>{
 $('readingMenu').open=true;$('codeBtn').click();assert($('codeDialog').open,'code dialog absent');assert(!$('readingMenu').open,'menu remained open');$('codeDialog').close();
});
await test('Keyboard shortcuts ignore text editing and modal annotation drafts',async()=>{
 const old=$('pageInput').value;$('question').dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'ArrowRight',altKey:true,bubbles:true,cancelable:true}));
 assert($('pageInput').value===old,'editing caused navigation');
 $('personalNotesBtn').click();const layout=frame.contentDocument.body.className;
 frame.contentDocument.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'F',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true}));
 assert(frame.contentDocument.body.className===layout,'modal draft changed layout');$('personalNotesDialog').close();
});
await test('390px window keeps controls accessible without horizontal overflow',async()=>{
 if($('assistantToggle').getAttribute('aria-pressed')==='true')$('assistantToggle').click();
 frame.style.width='390px';frame.style.height='820px';await sleep(800);
 const d=frame.contentDocument;assert(d.documentElement.scrollWidth<=400,'viewport overflows');
 for(const id of ['focusBtn','assistantToggle','currentChapter','prevPage','nextPage']){const r=$(id).getBoundingClientRect();assert(r.left>=0&&r.right<=391&&r.width>0,id+' inaccessible');}
 d.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}));
 assert($('finderDialog').open,'narrow finder missing');assert($('finderDialog').getBoundingClientRect().right<=391,'dialog overflow');$('finderClose').click();
 frame.style.width='1480px';await sleep(500);
});
await test('Escape dismisses the chapter picker before exiting focus reading',async()=>{
 if($('focusBtn').getAttribute('aria-pressed')!=='true')$('focusBtn').click();await sleep(350);
 $('chapterWheelBtn').click();assert(!$('chapterWheelPanel').hidden,'picker did not open');
 frame.contentDocument.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert($('chapterWheelPanel').hidden,'picker not dismissed');assert($('focusBtn').getAttribute('aria-pressed')==='true','Escape also exited focus');
 frame.contentDocument.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert($('focusBtn').getAttribute('aria-pressed')==='false','plain Escape did not restore workspace');
});
await test('Search, layout and navigation never call the model',async()=>{
 assert((await(await fetch('/test-requests')).json()).length===nativeBefore,'unexpected model call');
});
out.textContent+='\nTOTAL '+passed+' passed; '+failed+' failed';document.title=failed?'FAIL v100':'PASS v100';
