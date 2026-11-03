export function visualMessage(unit,images){
 if(!Array.isArray(images)||!images.length||images.length>8)throw Error('原图未准备完成，请重新打开原文后重试。');
 return {role:'user',content:[{type:'text',text:`请根据随附的论文原图解释这一处内容。图片来自文件页序 ${[...new Set(unit.boxes.map(b=>b.page))].join('、')}，按原文顺序排列。只能使用图片中可辨认的内容；看不清的姓名、符号、公式或数值请明确说明，不要猜测。\n${unit.text||''}`},...images.map(url=>({type:'image_url',image_url:{url}}))]};
}
