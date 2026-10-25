export function apertureGeometry(width,height){
 const w=Math.max(120,Number(width)||240),h=Math.max(160,Number(height)||360),radius=Math.max(h*.88,w*1.25);
 return {width:w,height:h,radius,cx:w-22-radius,cy:h/2,step:Math.min(23,Math.max(12,84/radius*180/Math.PI))};
}
export function aperturePosition(geometry,offset){
 const {radius,cx,cy,step,height}=geometry,angle=offset*step*Math.PI/180,x=cx+radius*Math.cos(angle),y=cy+radius*Math.sin(angle);
 return {x,y,angle,visible:Math.abs(angle)<Math.PI*.46&&y>-32&&y<height+32,labelRight:Math.max(92,x-48)};
}
export function chapterOrdinals(items){
 const counters=[];return items.map(item=>{const depth=Math.max(0,Math.min(12,Number(item.depth)||0));while(counters.length<=depth)counters.push(0);counters.length=depth+1;counters[depth]++;return counters.filter(Boolean).join('.');});
}
