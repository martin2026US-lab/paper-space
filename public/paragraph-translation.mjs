import {readingUnit,pageRange} from './reading-units.mjs';
import {normalizeOutputLanguage,translationPrompt} from './output-language.mjs';
import {translationKey} from './sentences.mjs';

// Translate the immutable, complete reading unit, including explicit cross-page joins.
export function paragraphTranslationRequest(doc,blockId,config,language) {
  const block=readingUnit(doc,blockId);
  if(!block?.text?.trim())throw new Error('这段原文已改变，请重新选择段落。');
  if(block.text.length>24000)throw new Error('这段原文超过 24,000 字符，请划选较短的内容翻译。');
  const outputLanguage=normalizeOutputLanguage(language);
  const snapshot={...config,outputLanguage};
  return {
    block:structuredClone(block),text:block.text,range:pageRange(block),config:snapshot,
    key:JSON.stringify(['paragraph',...JSON.parse(translationKey(block.text,snapshot,outputLanguage))]),
    messages:[{role:'system',content:translationPrompt(outputLanguage,'paragraph')},{role:'user',content:block.text}],
  };
}
