export function createPdfToolbar({count,parsed,corrected,conflict,archivedCount,onAdjust,onRecover,onReparse,onArchive,recognition=null,gaps=[],onReview,onDismiss}){
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const bar=el('div','pdf-paragraph-notice');bar.setAttribute('aria-label','本页阅读辅助');
  const info=el('div','pdf-page-info'),title=el('div','pdf-page-summary');
  title.append(el('span','pdf-unit-symbol','▤'),el('strong','',recognition?.phase==='queued'?'等待后台识别':recognition?.phase==='running'?'正在后台识别结构':recognition?.phase==='waiting'?'结构识别已完成':parsed?`${count} 个解读单元`:'基础文字阅读'));
  if(corrected&&!conflict)title.append(el('span','pdf-correction-status','已校正'));
  info.append(title,el('small','pdf-page-hint',recognition?.phase==='error'?'结构识别未完成 · 原文可继续阅读，点击重新识别重试':recognition?recognition.message:parsed?'段落、公式与表格 · 点击页边 ✧ 阅读':'可重新识别，或手动补入遗漏文字'));
  const actions=el('div','pdf-page-actions');actions.setAttribute('role','group');actions.setAttribute('aria-label','结构与旁注操作');
  const button=(label,action,cls='')=>{const b=el('button','button '+cls,label);b.type='button';b.onclick=action;return b;};
  const primary=el('div','pdf-edit-actions');
  primary.append(button('结构校正',onAdjust),button('补充漏识别',onRecover));
  const secondary=el('div','pdf-secondary-actions');
  const retry=button(recognition&&recognition.phase!=='error'?'识别中…':'重新识别',onReparse,'pdf-action-quiet');retry.disabled=!!recognition&&recognition.phase!=='error';secondary.append(retry);
  if(archivedCount)secondary.append(button(`旧版旁注 ${archivedCount}`,onArchive,'pdf-action-quiet'));
  actions.append(primary,secondary);bar.append(info,actions);
  if(conflict){const warning=el('div','pdf-structure-conflict','识别结果有差异，已保留手动校正。');warning.setAttribute('role','status');warning.append(button('查看校正',onAdjust,'pdf-action-quiet'));bar.append(warning);}
  if(gaps.length){const hint=el('div','pdf-gap-notice');hint.setAttribute('role','status');hint.append(el('span','',`本页有 ${gaps.length} 处可能漏识别，请核对原文`),button('核对漏段',onReview,'pdf-gap-review'),button('本页暂不提示',onDismiss,'pdf-action-quiet'));bar.append(hint);}
  return bar;
}
