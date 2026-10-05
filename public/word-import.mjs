// Retain only local raster image data. Imported HTML is never mounted in the app.
export function readWordHTML(html, Parser=DOMParser) {
  const parsed=new Parser().parseFromString(html,'text/html');
  const blocks=[],figures=[];let page=1,count=0;
  for(const el of [...parsed.body.querySelectorAll('h1,h2,h3,p,li,table')].filter(el=>!el.parentElement?.closest('table,li'))){
    const text=el.tagName==='TABLE'?[...el.rows].map(row=>[...row.cells].map(cell=>cell.textContent.trim()).join(' | ')).join('\n'):el.textContent.trim();
    if(text){if(count+text.length>3500&&count){page++;count=0;}count+=text.length;blocks.push({id:`w${blocks.length+1}`,page,text,heading:/^H/.test(el.tagName),...(/^H/.test(el.tagName)?{headingLevel:Number(el.tagName.slice(1))}:{}),...(el.tagName==='TABLE'?{kind:'table',table:readTable(el)}:{})});}
    for(const img of el.querySelectorAll('img')){
      const src=img.getAttribute('src')||'';
      figures.push({id:`figure-${figures.length+1}`,afterId:blocks.at(-1)?.id||null,page,alt:img.getAttribute('alt')||`文档插图 ${figures.length+1}`,src:/^data:image\/(png|jpeg|gif|webp|bmp);base64,[a-z0-9+/=\s]+$/i.test(src)?src:'',unsupported:!/^data:image\/(png|jpeg|gif|webp|bmp);base64,/i.test(src)});
    }
  }
  return {blocks,figures,pages:page,outline:blocks.filter(b=>b.heading).map(b=>({title:b.text,page:b.page,blockId:b.id,depth:Math.max(0,(b.headingLevel||1)-1)})),imageVersion:1,tableVersion:1,chapterVersion:1};
}
export function matchWordSource(existing,parsed){
  const normalize=text=>text.replace(/\s+/g,' ').trim();
  return existing.blocks.length===parsed.blocks.length&&existing.blocks.every((b,i)=>normalize(b.text)===normalize(parsed.blocks[i].text));
}

function readTable(table){return {rows:[...table.rows].map((row,index)=>({cells:[...row.cells].map(cell=>({text:cellText(cell),header:cell.tagName==='TH'||(index===0&&!!cell.querySelector('strong')&&cell.textContent.trim()===cell.querySelector('strong').textContent.trim()),colSpan:Math.max(1,Math.min(100,cell.colSpan||1)),rowSpan:Math.max(1,Math.min(1000,cell.rowSpan||1))}))}))};}
// Only add presentation metadata; preserve IDs, page numbers and exact historical source text.
export function restoreWordTables(doc,parsed){
  if(!matchWordSource(doc,parsed))throw Error('保存的 Word 与阅读原文不匹配，未覆盖已有内容。');
  return {...doc,tableVersion:1,chapterVersion:1,blocks:doc.blocks.map((b,i)=>({...b,...(parsed.blocks[i].headingLevel?{headingLevel:parsed.blocks[i].headingLevel}:{}),...(parsed.blocks[i].table?{kind:'table',table:parsed.blocks[i].table}:{})}))};
}
export function renderWordBlock(block,document){
  if(!block.table){const p=document.createElement(block.heading?'h3':'p');p.className='word-block'+(block.heading?' word-heading':'');p.dataset.blockId=block.id;p.textContent=block.text;return p;}
  const wrap=document.createElement('div');wrap.className='word-block word-table-wrap';wrap.dataset.blockId=block.id;wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','原文表格，可横向滚动');
  const table=document.createElement('table');table.className='word-table';const body=document.createElement('tbody');
  for(const row of block.table.rows){const tr=document.createElement('tr');for(const cell of row.cells){const td=document.createElement(cell.header?'th':'td');td.textContent=cell.text;td.colSpan=cell.colSpan;td.rowSpan=cell.rowSpan;if(cell.header)td.scope='col';tr.append(td);}body.append(tr);}
  table.append(body);wrap.append(table);return wrap;
}

function cellText(cell){function walk(n){if(n.nodeType===3)return n.textContent;if(n.nodeType!==1)return '';if(n.tagName==='BR')return '\n';return [...n.childNodes].map(walk).join('')+(/^(P|DIV|LI|TR)$/.test(n.tagName)?'\n':'');}return [...cell.childNodes].map(walk).join('').replace(/\n{3,}/g,'\n\n').trim();}
