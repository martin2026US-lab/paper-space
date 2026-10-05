export const PDF_LAYOUT_VERSION=2;
const median=a=>quantile(a,.5);
function quantile(values,q){const a=values.toSorted((a,b)=>a-b);return a.length?a[Math.min(a.length-1,Math.floor(a.length*q))]:0;}
const compact=t=>String(t||'').normalize('NFKC').replace(/\s/g,'');
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];

function structureGroups(tree){
  const groups=new Map();let serial=0;
  function visit(node,group){if(!node)return;if(/^(P|H[1-6]|Title|Caption|LBody|TH|TD)$/.test(node.role||''))group={id:++serial,role:node.role};if(node.type==='content'&&group)groups.set(node.id,group);for(const child of node.children||[])visit(child,group);}
  visit(tree);return groups;
}
function joinText(left,right,gap,font){if(!left)return right;if(/\s$/.test(left)||/^\s/.test(right)||/[-‐‑]$/.test(left)||/^[,.;:!?，。；：！？)\]]/.test(right))return left+right;if(/[\u3400-\u9fff]$/.test(left)&&/^[\u3400-\u9fff]/.test(right))return left+right;return left+(gap>font*.12?' ':'')+right;}

export function extractPdfParagraphs(content,viewport,page,structure=null){
  const groups=structureGroups(structure),stack=[],runs=[];let index=0;
  for(const item of content.items){
    if(item.str===undefined){if(item.type==='beginMarkedContent'||item.type==='beginMarkedContentProps')stack.push(item.id);else if(item.type==='endMarkedContent')stack.pop();continue;}
    const itemIndex=index++;if(!item.str.trim())continue;
    const t=multiply(viewport.transform,item.transform),height=Math.hypot(t[2],t[3])||Math.abs(item.height)||10,style=content.styles?.[item.fontName]||{};
    const group=[...stack].reverse().map(id=>groups.get(id)).find(Boolean);
    runs.push({text:item.str,itemIndex,x:t[4],baseline:t[5],y:t[5]-height*(style.ascent||.8),height,right:t[4]+Math.abs(item.width*(viewport.scale||1)),fontName:item.fontName,group});
  }
  if(!runs.length)return [];
  const rows=[];
  for(const run of runs.toSorted((a,b)=>a.baseline-b.baseline||a.x-b.x)){
    let row=rows.find(r=>Math.abs(r.baseline-run.baseline)<Math.max(2,Math.max(r.height,run.height)*.32));
    if(!row){row={baseline:run.baseline,height:run.height,runs:[]};rows.push(row);}row.runs.push(run);row.height=Math.max(row.height,run.height);
  }
  const lines=[];
  for(const row of rows){let line;for(const run of row.runs.toSorted((a,b)=>a.x-b.x)){
    if(!line||run.x-line.right>Math.max(18,row.height*2.3)){
      line={text:run.text,x:run.x,y:run.y,right:run.right,bottom:run.y+run.height,baseline:row.baseline,height:row.height,itemIndices:[run.itemIndex],groups:run.group?[run.group]:[],fontNames:[run.fontName]};lines.push(line);
    }else{line.text=joinText(line.text,run.text,run.x-line.right,row.height);line.right=Math.max(line.right,run.right);line.y=Math.min(line.y,run.y);line.bottom=Math.max(line.bottom,run.y+run.height);line.itemIndices.push(run.itemIndex);if(run.group)line.groups.push(run.group);line.fontNames.push(run.fontName);}
  }}
  const weighted=runs.flatMap(r=>Array(Math.min(100,Math.max(1,r.text.length))).fill(r.height)),bodyHeight=median(weighted);
  const body=lines.filter(l=>l.text.length>20&&l.right-l.x>viewport.width*.15&&l.height<bodyHeight*1.2);
  const left=body.filter(l=>l.x<viewport.width*.35&&l.right<viewport.width*.57),right=body.filter(l=>l.x>viewport.width*.43&&l.x<viewport.width*.72);
  const gutterLeft=quantile(left.map(l=>l.right),.85),gutterRight=quantile(right.map(l=>l.x),.15);
  const twoColumns=left.length>=3&&right.length>=3&&gutterRight-gutterLeft>bodyHeight&&body.filter(l=>l.x<viewport.width*.35&&l.right>viewport.width*.7).length<body.length*.2;
  const split=(gutterLeft+gutterRight)/2;
  for(const line of lines){const roles=line.groups.map(g=>g.role);line.heading=roles.some(r=>/^H[1-6]$|^Title$/.test(r))||line.text.length<120&&((line.height>bodyHeight*1.15&&!/[.!?。！？]$/.test(line.text))||/^(?:\d+(?:\.\d+)*\s+\p{L}|Abstract$|Introduction$|References$|Discussion$|Conclusion[s]?$|Results$|Methods$)/u.test(line.text));line.artifact=/^\d+$/.test(line.text.trim())&&(line.y>viewport.height*.9||line.y<viewport.height*.06);line.column=twoColumns?(line.x<split&&line.right>split+bodyHeight?2:line.x<split?0:1):0;}
  // Full-width headings divide reading bands; inside each band read left then right.
  const spanning=lines.filter(l=>l.column===2).toSorted((a,b)=>a.y-b.y);
  for(const l of lines)l.band=spanning.filter(s=>s.baseline<l.baseline-2).length;
  const ordered=lines.toSorted((a,b)=>a.band-b.band||a.column-b.column||a.baseline-b.baseline||a.x-b.x);
  const stats=new Map();
  for(const column of [...new Set(lines.map(l=>l.column))]){const col=lines.filter(l=>l.column===column&&!l.heading&&!l.artifact).toSorted((a,b)=>a.baseline-b.baseline);const deltas=col.slice(1).map((l,i)=>l.baseline-col[i].baseline).filter(d=>d>bodyHeight*.65&&d<bodyHeight*2.2);const bins=new Map();for(const d of deltas){const key=Math.round(d*2)/2;bins.set(key,(bins.get(key)||0)+1);}const leading=[...bins].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0]||bodyHeight*1.2;stats.set(column,{leading,left:quantile(col.map(l=>l.x),.15),right:quantile(col.map(l=>l.right),.9)});}
  const blocks=[];let current,prev;
  for(const line of ordered){
    const stat=stats.get(line.column),delta=prev?line.baseline-prev.baseline:Infinity;
    const groupIds=new Set(line.groups.map(g=>g.id)),prevGroups=new Set(prev?.groups.map(g=>g.id)||[]);
    const sameTag=groupIds.size===1&&prevGroups.size===1&&[...groupIds][0]===[...prevGroups][0];
    const newTag=groupIds.size&&prevGroups.size&&![...groupIds].some(id=>prevGroups.has(id));
    const endsSentence=/[.!?。！？](?:[\s\d\]）)"'”’])*$/u.test(prev?.text||'');
    const shortLine=prev&&stat.right-prev.right>Math.max(bodyHeight*2,(stat.right-stat.left)*.12);
    const indent=line.x-stat.left>bodyHeight*.65&&(!prev||Math.abs(line.x-prev.x)>bodyHeight*.4);
    const start=!current||line.column!==prev.column||line.band!==prev.band||line.heading||prev.heading||line.artifact||prev.artifact||newTag||(!sameTag&&(delta>stat.leading*1.24+1||delta<0||indent||(shortLine&&endsSentence)))||Math.abs(line.height-prev.height)>bodyHeight*.35;
    if(start){current={id:`p${page}r${blocks.length+1}`,page,text:line.text,x:line.x,y:line.y,bottom:line.bottom,right:line.right,height:line.bottom-line.y,heading:line.heading,artifact:line.artifact,column:line.column,lines:[],itemIndices:[]};blocks.push(current);}
    else{current.text=joinText(current.text,line.text,bodyHeight,bodyHeight);current.x=Math.min(current.x,line.x);current.y=Math.min(current.y,line.y);current.right=Math.max(current.right,line.right);current.bottom=Math.max(current.bottom,line.bottom);current.height=current.bottom-current.y;}
    current.lines.push({x:line.x,y:line.y,right:line.right,bottom:line.bottom,itemIndices:line.itemIndices});current.itemIndices.push(...line.itemIndices);prev=line;
  }
  return blocks.filter(b=>b.text.trim().length>1);
}

export function migratePdfLayout(doc,parsed){
  const legacy=new Map([...(doc.legacyBlocks||[]),...doc.blocks].map(b=>[b.id,b]));
  const oldCards=(doc.cards||[]).map(c=>({...c,sourceText:doc.blocks.find(b=>b.id===c.blockId)?.text||c.sourceText||'',legacy:true}));
  return {...doc,blocks:parsed.blocks,outline:parsed.outline,pages:parsed.pages,pdfLayoutVersion:PDF_LAYOUT_VERSION,legacyBlocks:[...legacy.values()],archivedCards:[...(doc.archivedCards||[]),...oldCards],cards:[]};
}
export function resolvePdfSource(doc,material){
  const id=material.blockId||material.id,legacy=doc.legacyBlocks?.find(b=>b.id===id);
  if(!legacy)return null;
  // Historical evidence retains its old extent; never silently relabel it as a new paragraph.
  const matches=doc.blocks.filter(b=>b.page===legacy.page&&compact(legacy.text).includes(compact(b.text)));
  if(matches.length===1&&compact(matches[0].text)===compact(legacy.text))return matches[0];
  return {...legacy,legacy:true};
}
