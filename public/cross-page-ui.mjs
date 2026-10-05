import {readingUnits,pageRange,boundaryPair,linkBoundary,unlinkUnit} from './reading-units.mjs';
export function createCrossPageUI({state,saveDoc,renderReading,locate,toast}){
  const e=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const dialog=e('dialog');dialog.className='structure-dialog cross-page-dialog';dialog.id='crossPageDialog';document.body.append(dialog);let doc,page,saving=false;
  const button=(label,fn)=>{const b=e('button',label);b.className='button';b.onclick=fn;return b;};
  dialog.addEventListener('cancel',ev=>{if(saving)ev.preventDefault();});
  async function change(fn){if(saving)return;saving=true;const before=structuredClone(doc.crossPageLinks||[]);dialog.querySelectorAll('button').forEach(b=>b.disabled=true);try{fn();if(!await saveDoc(doc))throw Error('连接未保存，请重试。');dialog.close();await renderReading();toast('跨页连接已更新；原有旁注和个人批注仍保留。');}catch(err){doc.crossPageLinks=before;toast(err.message);}finally{saving=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  function render(){dialog.replaceChildren();const heading=e('div');heading.className='management-heading';heading.append(e('h2','跨页段落'),button('关闭',()=>dialog.close()));dialog.append(heading,e('p','完整段落只解读一次，两页分别定位原文。手动连接保留原始文字，可随时撤销。'));
    const validIds=new Set(readingUnits(doc).map(b=>b.id));for(const link of (doc.crossPageLinks||[]).filter(l=>!l.deletedAt&&!validIds.has(l.id)&&l.sources.some(s=>s.page===page))){const warning=e('p','此前的跨页连接因原文校正而暂停，原始记录仍保留。请核对新的段落后重新连接。');warning.className='structure-warning';dialog.append(warning,button('撤销已暂停连接',()=>change(()=>unlinkUnit(doc,link.id))));}
    const existing=readingUnits(doc).filter(b=>b.crossPage&&b.sourceSegments.some(s=>s.page===page));for(const unit of existing){const row=e('section');row.append(e('h3','第 '+pageRange(unit)+' 页 · '+(unit.manualLink?'手动连接':'识别到的跨页段落')),e('pre',unit.text));for(const part of unit.sourceSegments)row.append(button('查看第 '+part.page+' 页',()=>{dialog.close();locate(part);}));if(unit.manualLink)row.append(button('撤销此连接',()=>change(()=>unlinkUnit(doc,unit.id))));dialog.append(row);}
    let count=0;for(const boundary of [page-1,page]){const pair=boundaryPair(doc,boundary);if(!pair)continue;count++;const row=e('section');row.append(e('h3','连接第 '+boundary+' 页末与第 '+(boundary+1)+' 页首'),e('p','请核对下列两段确实是同一段的前后部分，再连接。'),e('pre',pair.map(b=>'第 '+b.page+' 页\n'+b.text).join('\n\n')),button('连接这两段',()=>change(()=>linkBoundary(doc,pair))));dialog.append(row);}if(!count&&!existing.length)dialog.append(e('p','当前页没有可连接的相邻正文。请先完成识别，或补充漏识别的段落。'));
  }
  return {open(){if(!state.doc||state.busy||state.mutating)return;doc=state.doc;page=state.page;render();dialog.showModal();}};
}
