import {readingUnit,pageFragment} from './reading-units.mjs';
import {resolvePdfSource} from './pdf-layout.mjs';
import {pdfBlockSpans} from './pdf-text.mjs';
const compact=text=>String(text||'').normalize('NFKC').replace(/\s/g,'');
export function findSourceBlock(doc,material) {
  if(material.sourceSnapshot)return {...material.sourceSnapshot,legacy:true};
  if(material.sourceSegments)return material;
  const sourceId=material.blockId||material.id;
  const saved=(doc.legacyBlocks||[]).find(b=>b.id===sourceId&&(!material.text||compact(b.text).includes(compact(material.text))));
  if(saved&&!doc.blocks.some(b=>b.id===sourceId&&b.text===saved.text))return {...saved,legacy:true};
  if(Array.isArray(material.itemIndices)&&material.page)return {...material,id:sourceId,legacy:!doc.blocks.some(b=>b.id===sourceId)};
  const exact=readingUnit(doc,material.blockId||material.id);if(exact)return exact;
  const legacy=resolvePdfSource(doc,material);if(legacy)return legacy;
  const text=compact(material.text);if(!text)return null;
  return doc.blocks.find(b=>(!material.page||b.page===material.page)&&compact(b.text).includes(text.slice(0,Math.min(80,text.length))))||null;
}
export function highlightSource(block,{scroll=true}={}) {
  document.querySelectorAll('.source-highlight').forEach(el=>el.remove());
  document.querySelectorAll('.source-located').forEach(el=>el.classList.remove('source-located'));
  if(!block)return false;
  let target=[...document.querySelectorAll('[data-block-id]')].find(el=>el.dataset.blockId===block.id&&el.classList.contains('word-block'));
  if(target)target.classList.add('source-located');
  else {
    const page=document.querySelector('.pdf-page');if(!page)return false;
    block=pageFragment(block,Number(page.dataset.page));if(!block)return false;
    const pageRect=page.getBoundingClientRect(),matches=pdfBlockSpans(page,block);
    for(const span of matches){const r=span.getBoundingClientRect();if(!r.width||!r.height)continue;const mark=document.createElement('div');mark.className='source-highlight';mark.style.left=(r.left-pageRect.left-2)+'px';mark.style.top=(r.top-pageRect.top-1)+'px';mark.style.width=(r.width+4)+'px';mark.style.height=(r.height+2)+'px';page.append(mark);target||=mark;}
  }
  document.querySelectorAll('.explanation-card').forEach(el=>{if(el.dataset.blockId===block.id)el.classList.add('source-located');});
  if(target&&scroll)target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
  return !!target;
}
