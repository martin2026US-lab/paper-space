export function apertureGeometry(width,height){
 const w=Math.max(120,Number(width)||240),h=Math.max(120,Number(height)||360),radius=Math.max(h*.88,w*1.25),step=Math.min(23,84/radius*180/Math.PI);
 return {width:w,height:h,radius,cx:w-22-radius,cy:h/2,step,spacing:radius*Math.sin(step*Math.PI/180)};
}
export function aperturePosition(geometry,offset){
 const {radius,cx,cy,step,height}=geometry,angle=offset*step*Math.PI/180,x=cx+radius*Math.cos(angle),y=cy+radius*Math.sin(angle);
 return {x,y,angle,visible:Math.abs(angle)<Math.PI*.46&&y>-32&&y<height+32,labelRight:Math.max(76,x-48)};
}
export function apertureStep(position,target,elapsed,immediate=false){
 if(immediate||Math.abs(target-position)<.001)return target;
 const next=position+(target-position)*(1-Math.exp(-Math.max(0,Math.min(32,elapsed))/36));
 return Math.abs(target-next)<.001?target:next;
}
export function chapterOrdinals(items){
 const counters=[];return items.map(item=>{const depth=Math.max(0,Math.min(12,Number(item.depth)||0));while(counters.length<=depth)counters.push(0);counters.length=depth+1;counters[depth]++;return counters.filter(Boolean).join('.');});
}
