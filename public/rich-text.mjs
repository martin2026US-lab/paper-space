import {Lexer} from './vendor/marked.mjs';
const element=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
const decode=text=>String(text).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(raw,key)=>{const names={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(key[0]!=='#')return names[key.toLowerCase()]??raw;const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):raw;});
export function renderMarkdown(host,text,{materials=[],onCitation=()=>{}}={}) {
  host.replaceChildren();host.classList.add('markdown-body');
  const sources=new Map(materials.map(m=>[m.id,m]));
  function plain(parent,value,citations=true) {
    value=decode(value);let at=0;
    if(citations)for(const match of value.matchAll(/\[[a-zA-Z0-9_-]+\](?:[ \t]*\[[a-zA-Z0-9_-]+\])*/g)) {
      const ids=[...match[0].matchAll(/\[([a-zA-Z0-9_-]+)\]/g)].map(m=>m[1]);
      if(!ids.some(id=>sources.has(id)))continue;
      parent.append(document.createTextNode(value.slice(at,match.index)));
      const known=[...new Set(ids)].filter(id=>sources.has(id)).map(id=>sources.get(id));
      const makeButton=source=>{const btn=element('button',source.kind==='代码'?'代码来源':source.page?'第 '+source.page+' 页':'导读');btn.type='button';btn.className='citation';btn.title=(source.label||'定位原文')+' · '+(source.text||'').slice(0,180);btn.addEventListener('click',()=>onCitation(source));return btn;};
      if(known.length===1)parent.append(makeButton(known[0]));
      else {const group=element('span');group.className='citation-group';const toggle=element('button','来源 · '+known.length+' 处');toggle.className='citation';toggle.type='button';toggle.setAttribute('aria-expanded','false');const panel=element('span');panel.className='citation-sources';panel.hidden=true;toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));};for(const source of known){const row=element('span');row.className='citation-source';row.append(makeButton(source),element('span',(source.text||source.label||source.id).slice(0,160)));panel.append(row);}group.append(toggle,panel);parent.append(group);}
      for(const id of [...new Set(ids)].filter(id=>!sources.has(id)))parent.append(element('span',' ['+id+']（来源未核实）'));
      at=match.index+match[0].length;
    }
    parent.append(document.createTextNode(value.slice(at)));
  }
  function inline(parent,tokens=[]) {
    for(const t of tokens) {
      if(['strong','em','del'].includes(t.type)){const child=element(t.type==='strong'?'strong':t.type==='em'?'em':'s');inline(child,t.tokens);parent.append(child);}
      else if(t.type==='codespan')parent.append(element('code',decode(t.text)));
      else if(t.type==='br')parent.append(element('br'));
      else if(t.type==='link'){const child=element('span');child.className='markdown-link';child.title=t.href;inline(child,t.tokens);parent.append(child);}
      else if(t.type==='image')plain(parent,t.text||'图片',false);
      else if(t.tokens)inline(parent,t.tokens);
      else plain(parent,t.text??t.raw??'',t.type!=='html');
    }
  }
  function blocks(parent,tokens) {
    for(const t of tokens) {
      if(t.type==='space')continue;
      if(t.type==='heading'){const el=element('h'+Math.min(6,t.depth));inline(el,t.tokens);parent.append(el);}
      else if(t.type==='paragraph'||t.type==='text'){const el=element('p');t.tokens?inline(el,t.tokens):plain(el,t.text);parent.append(el);}
      else if(t.type==='blockquote'){const el=element('blockquote');blocks(el,t.tokens);parent.append(el);}
      else if(t.type==='list'){const el=element(t.ordered?'ol':'ul');if(t.ordered&&t.start)el.start=t.start;for(const item of t.items){const li=element('li');if(item.task)li.append(element('span',item.checked?'☑ ':'☐ '));blocks(li,item.tokens);el.append(li);}parent.append(el);}
      else if(t.type==='code'){const pre=element('pre');pre.append(element('code',t.text));parent.append(pre);}
      else if(t.type==='hr')parent.append(element('hr'));
      else if(t.type==='table'){const wrap=element('div');wrap.className='markdown-table';const table=element('table'),head=element('thead'),tr=element('tr');for(const cell of t.header){const th=element('th');inline(th,cell.tokens);tr.append(th);}head.append(tr);table.append(head);const body=element('tbody');for(const row of t.rows){const line=element('tr');for(const cell of row){const td=element('td');inline(td,cell.tokens);line.append(td);}body.append(line);}table.append(body);wrap.append(table);parent.append(wrap);}
      else {const p=element('p');plain(p,t.text??t.raw??'',false);parent.append(p);}
    }
  }
  try{blocks(host,Lexer.lex(String(text||''),{gfm:true,breaks:true}));}catch{host.textContent=String(text||'');}
  return host;
}
