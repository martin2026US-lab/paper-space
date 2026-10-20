export const PDF_VIEW_KEY='paper-space-pdf-view';
export function normalizePdfZoom(value){if(['fit-width','fit-page'].includes(value))return value;const n=Number(value);return Number.isFinite(n)&&n>=25&&n<=400?String(Math.round(n)):'fit-width';}
export function loadPdfZoom(storage){try{return normalizePdfZoom(storage?.getItem(PDF_VIEW_KEY)||'fit-width');}catch{return'fit-width';}}
export function pdfViewScale({width,height,availableWidth,availableHeight,mode='fit-width'}){
 if(![width,height,availableWidth,availableHeight].every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid PDF viewport');
 const zoom=normalizePdfZoom(mode),scale=zoom==='fit-width'?availableWidth/width:zoom==='fit-page'?Math.min(availableWidth/width,availableHeight/height):Number(zoom)/100*4/3;
 return Math.max(.05,Math.min(8,scale));
}
