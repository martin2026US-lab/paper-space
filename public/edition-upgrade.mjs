// Add a derived reader without migrating existing notes, translations or source anchors.
export function needsEditionUpgrade(doc){
 return doc?.type==='pdf'&&doc.parser==='docling'&&!doc.readingEdition&&doc.readingLayout?.quality?.version!=='reading-quality-v3'&&!doc.structure?.operations?.length&&!doc.structure?.conflict&&!doc.blocks?.some(b=>b.manual)&&!(doc.crossPageLinks||[]).some(l=>!l.deletedAt);
}
export function withReadingLayout(doc,parsed){
 if(!parsed.readingLayout?.blocks?.length||parsed.fileFingerprint!==doc.fileFingerprint||parsed.pages!==doc.pages)throw Error('单栏阅读来源不匹配，原有资料保持不变。');
 return {...doc,readingLayout:parsed.readingLayout};
}
