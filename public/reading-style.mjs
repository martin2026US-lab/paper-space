export const READING_STYLE_KEY='paper-space-reading-style';
export const MAGAZINE_LAYOUT_KEY='paper-space-magazine-layout';
export function normalizeReadingStyle(value){return value==='magazine'?'magazine':'classic';}
export function loadReadingStyle(storage){try{return normalizeReadingStyle(storage?.getItem(READING_STYLE_KEY));}catch{return'classic';}}
export function saveReadingStyle(storage,value){try{const style=normalizeReadingStyle(value);storage.setItem(READING_STYLE_KEY,style);return storage.getItem(READING_STYLE_KEY)===style;}catch{return false;}}
export function loadMagazineLayout(storage){try{const value=JSON.parse(storage?.getItem(MAGAZINE_LAYOUT_KEY)||'{}');return{focus:value.focus===true,assistant:value.assistant===true};}catch{return{focus:false,assistant:false};}}
