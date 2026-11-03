import {applyTranscription} from './transcription.mjs';
// Additive reading editions: never replace doc.blocks, original bytes or old anchors.
export const READING_EDITION_VERSION=1;
const clone=x=>structuredClone(x);
const sectionKinds=new Set(['title','section_header']);
const furniture=new Set(['page_header','page_footer']);
export function editionFor(doc){
  // Manual structural edits are authoritative; retain the legacy reader until reconciled.
  if(doc.readingLayout?.quality&&(doc.structure?.operations?.length||doc.structure?.conflict||doc.blocks?.some(b=>b.manual)||(doc.crossPageLinks||[]).some(l=>!l.deletedAt)))return null;
  const saved=doc.readingEdition;
  if(saved?.version===READING_EDITION_VERSION&&saved.fingerprint===doc.fileFingerprint&&Array.isArray(saved.units))return bindEdition(doc,clone(saved));
  const layout=doc.readingLayout;
  if(!layout?.blocks?.length)return null;
  const quality=['reading-quality-v1','reading-quality-v2','reading-quality-v3'].includes(layout.quality?.version)&&Array.isArray(layout.normalizedBlocks);
  const units=(quality?layout.normalizedBlocks:layout.blocks).map((b,i)=>({id:'edition-'+(b.sourceRef||i).replace(/[^a-z\d-]/gi,'-'),kind:sectionKinds.has(b.kind)?'heading':b.kind==='picture'?'figure':b.kind==='footnote'?'note':furniture.has(b.kind)?'footer':b.kind==='caption'?'caption':b.kind==='table'?'table':b.kind==='formula'?'formula':'paragraph',text:b.kind==='picture'?'':b.text,textRuns:b.textRuns&&clone(b.textRuns),modelText:b.evidenceText,glyphFallback:b.glyphFallback,inlineGlyphs:b.inlineGlyphs,sourceFontSize:b.sourceFontSize,sourceRefs:clone(b.sourceRefs||[b.sourceRef].filter(Boolean)),boxes:clone(b.boxes),visualBoxes:b.visualBoxes&&clone(b.visualBoxes),visual:!!b.visualOnly||b.kind==='picture'||b.kind==='table'||b.kind==='formula',quality:!!quality,evidenceText:b.evidenceText??(b.kind==='formula'?'[公式以原图保留，尚无可靠文字转写；请核对原页，不能据此推断公式内容。]':b.kind==='table'?'[表格以原图为准；以下为自动转写，数值、符号和表格关系需核对。]\n'+b.text:undefined),section:sectionKinds.has(b.kind)?b.text:undefined}));
  // Keep the parser's semantic order and all footnotes. Never guess joins from prose.
  for(let i=0;i<units.length;i++){
    const unit=units[i];
    const raw=(quality?layout.normalizedBlocks:layout.blocks)[i];
    unit.typographyVersion=['reading-quality-v2','reading-quality-v3'].includes(layout.quality?.version)?1:undefined;
    if(quality&&raw.unverifiedGlyphs&&!unit.evidenceText)unit.evidenceText='[本段有尚未核实的字符，数学符号须核对原文，不能据此推导。]\n'+unit.text;
    if(unit.kind==='table'){
      const caption=units[i+1];
      if(caption?.kind==='caption'&&/^table\b|^表/i.test(caption.text)&&caption.boxes[0]?.page===unit.boxes[0]?.page){unit.text=caption.text;unit.textRuns=caption.textRuns;unit.inlineGlyphs=caption.inlineGlyphs;unit.modelText=caption.modelText;unit.evidenceText=caption.evidenceText;unit.sourceRefs.push(...caption.sourceRefs);unit.captionBoxes=clone(caption.boxes);unit.boxes.push(...caption.boxes);caption.attached=true;}
      else unit.text=unit.text.split(/\n\s*\n|\n\|/)[0];
      if(caption?.glyphFallback&&caption.boxes[0]?.page===unit.boxes[0]?.page){unit.text='';unit.textRuns=[];unit.modelText=undefined;}
      if(quality)unit.evidenceText=unit.text+'\n[表格已保留原图；单元格数值和符号尚未逐格验证，本轮不提供表格文字转写，不能据此推断表中数值。]';
    }
    if(unit.kind==='figure'){
      const caption=units[i+1];if(caption?.kind==='caption'&&/^fig(?:ure)?\.?\s*\d|^图/i.test(caption.text)&&caption.boxes[0]?.page===unit.boxes[0]?.page){unit.text=caption.text;unit.textRuns=caption.textRuns;unit.inlineGlyphs=caption.inlineGlyphs;unit.modelText=caption.modelText;unit.evidenceText=caption.evidenceText;unit.sourceRefs.push(...caption.sourceRefs);unit.captionBoxes=clone(caption.boxes);unit.boxes.push(...caption.boxes);caption.attached=true;}
    }
  }
  return bindEdition(doc,{version:1,fingerprint:doc.fileFingerprint,provenance:'automatic-layout',quality:quality?clone(layout.quality):undefined,units:units.filter(u=>!u.attached),review:'自动结构转换；复杂顺序及字体符号仍需核对'});
}
function bindEdition(doc,edition){
  for(const u of edition.units){
    u.sourceBlockIds=(doc.blocks||[]).filter(b=>(b.sourceRefs||[b.sourceRef]).some(r=>u.sourceRefs.includes(r))).map(b=>b.id);
    if(u.quality){u.legacySourceBlockIds=u.sourceBlockIds;u.sourceBlockIds=[u.id];}
    u.page=u.boxes[0]?.page||1;u.endPage=Math.max(...u.boxes.map(b=>b.page),u.page);
    if(!u.sourceBlockIds.length)u.sourceBlockIds=[u.id];
  }
  edition.units=edition.units.map(u=>applyTranscription(doc,u));return edition;
}
export function editionUnitFor(edition,blockId){const direct=edition?.units.find(u=>u.id===blockId||u.sourceBlockIds?.includes(blockId));if(direct)return direct;const legacy=edition?.units.filter(u=>u.legacySourceBlockIds?.includes(blockId));return legacy?.length===1?legacy[0]:undefined;}
export function validEdition(edition,doc){return edition?.fingerprint===doc.fileFingerprint&&edition.units.every(u=>u.boxes.length&&u.boxes.every(b=>Number.isInteger(b.page)&&b.page>0&&b.page<=doc.pages&&[b.x,b.y,b.right,b.bottom,b.pageWidth,b.pageHeight].every(Number.isFinite)&&b.pageWidth>0&&b.pageHeight>0&&b.right>=b.x&&b.bottom>=b.y));}
