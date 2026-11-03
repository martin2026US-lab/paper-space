import {editionFor} from './reading-edition.mjs';
import {readingUnits} from './reading-units.mjs';
// Additive evidence layer: old blocks, citations and manual edits retain their identities.
export function readingEvidence(doc){
  if(!['reading-quality-v1','reading-quality-v2','reading-quality-v3'].includes(doc.readingLayout?.quality?.version))return readingUnits(doc);
  const edition=editionFor(doc);if(!edition?.quality)return readingUnits(doc);
  return edition.units.filter(u=>u.kind!=='footer').map(u=>{
    const text=u.evidenceText??u.text;
    const source={id:u.id,page:u.page,endPage:u.endPage,text,kind:u.kind,sourceRefs:u.sourceRefs,
      sourceBoxes:structuredClone(u.boxes),fileFingerprint:doc.fileFingerprint,readingQualityVersion:doc.readingLayout.quality.version};
    source.sourceSegments=[...new Set(u.boxes.map(b=>b.page))].map(page=>({...source,page}));
    return {...source,sourceSnapshot:structuredClone(source)};
  }).filter(b=>b.text);
}
