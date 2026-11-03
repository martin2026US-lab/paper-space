// Geometry-backed typography is rendered as DOM text. No inferred isotope/name patterns.
export function renderTextRuns(node,runs,makeGlyph){
 node.replaceChildren();for(const run of runs){if(run.imageBox&&makeGlyph){node.append(makeGlyph(run));}else if(run.script==='sup'||run.script==='sub'){const span=document.createElement(run.script);span.textContent=run.text;node.append(span);}else node.append(document.createTextNode(run.text));}
}
export function selectionEvidence(range){
 const fragment=range.cloneContents();
 const walk=node=>{if(node.nodeType===3)return node.textContent;if(node.nodeType!==1&&node.nodeType!==11)return '';if(node.nodeType===1&&node.matches('.edition-actions,.edition-translation,.edition-answer,.edition-review-note'))return '';if(node.nodeType===1&&node.matches('img.edition-inline-glyph'))return '[原图符号]';const text=[...node.childNodes].map(walk).join('');return node.nodeName==='SUP'?'^{'+text+'}':node.nodeName==='SUB'?'_{'+text+'}':text;};
 // A partial selection wholly inside a superscript loses its ancestor in cloneContents().
 const parent=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
 const script=parent?.closest?.('sup,sub');const result=walk(fragment).trim();
 return script&&!fragment.querySelector?.('sup,sub')?(script.tagName==='SUP'?'^{':'_{')+result+'}':result;
}
export function translationText(unit){return unit.modelText??unit.text;}
