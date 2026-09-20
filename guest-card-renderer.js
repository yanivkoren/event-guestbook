// Browser-only deterministic renderer: no image generation, no rewriting source media/text.
export const CARD_WIDTH=1080,CARD_HEIGHT=1350;
export const TYPOGRAPHY={
 hebrew_clean:{family:'Arial, "Noto Sans Hebrew", sans-serif',weight:'400',titleWeight:'700'},
 hebrew_classic:{family:'Georgia, "Noto Serif Hebrew", serif',weight:'400',titleWeight:'700'}
};
const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,Number(v)));
function round(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y+h,x+w,y,r);ctx.closePath()}
export function defaultDesign(t){return {
 template_id:t.id,palette:Object.keys(t.palettes)[0],frame:t.frame_options[0],
 pattern_id:t.pattern_options[0],typography_id:t.typography_options[0],
 crop_strategy:'center',photo_position:t.photo_positions[0],crop_x:.5,crop_y:.5
}}
export function validateDesign(t,d){
 if(!t||!t.active||t.id!==d.template_id||!Object.hasOwn(t.palettes,d.palette)
 ||!t.frame_options.includes(d.frame)||!t.pattern_options.includes(d.pattern_id)
 ||!t.typography_options.includes(d.typography_id)
 ||!t.crop_strategies.includes(d.crop_strategy)||!t.photo_positions.includes(d.photo_position)
 ||!Number.isFinite(d.crop_x)||!Number.isFinite(d.crop_y)||d.crop_x<0||d.crop_x>1||d.crop_y<0||d.crop_y>1)throw Error('שילוב העיצוב אינו חוקי');
 return true;
}
export async function loadPhoto(url){
 if(!url)return null;const response=await fetch(url);if(!response.ok)throw Error('תמונת המקור אינה זמינה');
 const blob=await response.blob(),objectUrl=URL.createObjectURL(blob),img=new Image();
 try{img.src=objectUrl;await img.decode();return img}finally{URL.revokeObjectURL(objectUrl)}
}
function decorate(ctx,t,p,d){
 ctx.fillStyle=p.background;ctx.fillRect(0,0,CARD_WIDTH,CARD_HEIGHT);
 ctx.strokeStyle=p.accent;ctx.lineWidth=3;round(ctx,38,38,1004,1274,26);ctx.stroke();
 ctx.strokeStyle=p.accent2;ctx.lineWidth=1;round(ctx,55,55,970,1240,22);ctx.stroke();
 if(d.pattern_id==='none')return;
 ctx.save();ctx.globalAlpha=.75;
 if(d.pattern_id==='botanical'){
  for(const sign of [1,-1]){ctx.save();ctx.translate(sign===1?70:1010,190);ctx.scale(sign,1);
   ctx.strokeStyle=p.accent2;ctx.fillStyle=p.accent2;ctx.lineWidth=3;
   ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(30,-45,65,-95,75,-150);ctx.stroke();
   for(let i=0;i<5;i++){const x=15+i*11,y=-20-i*28;ctx.beginPath();ctx.ellipse(x,y,11,21,-.6,0,Math.PI*2);ctx.fill()}
   ctx.restore();}
 }else if(d.pattern_id==='confetti'){
  for(let i=0;i<24;i++){ctx.fillStyle=i%2?p.accent:p.accent2;ctx.beginPath();ctx.arc(80+(i*179)%915,74+(i*227)%1210,3+i%3,0,2*Math.PI);ctx.fill()}
 }else{
  ctx.fillStyle=p.accent2;ctx.fillRect(77,174,926,4);ctx.fillRect(77,1300,926,4);
 }
 ctx.restore();
}
function photo(ctx,img,rect,d,p){
 const {x,y,w,h,shape,radius}=rect;ctx.save();
 if(shape==='ellipse'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2)}
 else round(ctx,x,y,w,h,radius||20);
 ctx.clip();
 const iw=img.naturalWidth,ih=img.naturalHeight,scale=Math.max(w/iw,h/ih),sw=w/scale,sh=h/scale;
 const sx=(iw-sw)*clamp(d.crop_x),sy=(ih-sh)*clamp(d.crop_y);
 ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);ctx.restore();
 if(d.frame!=='none'){ctx.save();ctx.strokeStyle=p.accent;ctx.lineWidth=d.frame==='rounded_gold'?13:4;
  if(shape==='ellipse'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2)}else round(ctx,x,y,w,h,radius||20);
  ctx.stroke();ctx.restore();}
}
function splitWord(ctx,word,width){
 const out=[];let part='';
 for(const char of Array.from(word)){if(part&&ctx.measureText(part+char).width>width){out.push(part);part=char}else part+=char}
 if(part)out.push(part);return out;
}
function linesFor(ctx,text,width){
 const paragraphs=String(text).replace(/\r\n?/g,'\n').split('\n'),out=[];
 for(const paragraph of paragraphs){
  if(paragraph.length===0){out.push('');continue}
  let line='';
  for(const word of paragraph.trim().split(/\s+/)){
   const parts=ctx.measureText(word).width>width?splitWord(ctx,word,width):[word];
   for(const part of parts){
    const next=line?line+' '+part:part;
    if(line&&ctx.measureText(next).width>width){out.push(line);line=part}else line=next;
   }
  }
  out.push(line);
 }
 return out;
}
function drawLines(ctx,lines,x,y,leading,p){
 ctx.fillStyle=p.text;ctx.textAlign='center';ctx.textBaseline='top';ctx.direction='rtl';
 lines.forEach((line,i)=>ctx.fillText(line,x,y+i*leading));
}
function label(ctx,text,x,y,maxWidth,fontSize,typ,color,weight='700'){
 if(!text)return;
 ctx.save();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='top';ctx.direction='rtl';
 let font=fontSize;
 for(;font>20;font--){ctx.font=`${weight} ${font}px ${typ.family}`;if(ctx.measureText(text).width<=maxWidth)break}
 if(ctx.measureText(text).width>maxWidth){ctx.restore();throw Error('שם או כותרת ארוכים מדי לכרטיס')}
 ctx.fillText(text,x,y);ctx.restore();
}
function newPage(t,d){
 const c=document.createElement('canvas');c.width=CARD_WIDTH;c.height=CARD_HEIGHT;
 const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas אינו זמין');decorate(ctx,t,t.palettes[d.palette],d);return {c,ctx};
}
export async function renderCardPages({template,design,content,image}){
 validateDesign(template,design);await document.fonts.ready;
 if(!content.name?.trim())throw Error('חסר שם מברך');
 const p=template.palettes[design.palette],layout=template.layout,typ=TYPOGRAPHY[design.typography_id];
 if(!typ)throw Error('גופן לא זמין');
 const pages=[];let remaining=String(content.message||''),first=true;
 // Bound the loop and signal instead of ever dropping text silently.
 for(let pageNo=0;pageNo<20;pageNo++){
  const {c,ctx}=newPage(template,design);const withPhoto=first&&!!image;
  label(ctx,String(content.title||''),540,layout.title.y,910,layout.title.size,typ,p.text,typ.titleWeight);
  if(withPhoto)photo(ctx,image,layout.photo,design,p);
  if(first)label(ctx,String(content.name),540,withPhoto?layout.name.y:230,890,layout.name.size,typ,p.accent,typ.titleWeight);
  else label(ctx,String(content.name),540,205,890,36,typ,p.accent,typ.titleWeight);
  const top=withPhoto?layout.message.top:first?332:315;
  const bottom=first&&content.emoji?Math.min(layout.message.bottom,1230):first?1230:1230;
  let font=Math.max(22,Math.min(36,layout.message.size)),leading=Math.ceil(font*(layout.message.line_height||1.32));
  ctx.font=`${typ.weight} ${font}px ${typ.family}`;
  const lines=remaining?linesFor(ctx,remaining,858):[];
  const capacity=Math.floor((bottom-top)/leading);
  if(remaining&&capacity<1)throw Error('אין מקום למלל בעיצוב זה');
  const slice=lines.slice(0,capacity);
  // Preserve explicit blank lines by storing line offsets in the snapshot.
  ctx.save();drawLines(ctx,slice,540,top,leading,p);ctx.restore();
  remaining=lines.slice(capacity).join('\n');
  if(first&&content.emoji){
   const hasReactionLabel=!!String(content.reaction_label||'').trim();
   label(ctx,String(content.emoji),540,hasReactionLabel?1206:layout.emoji.y,790,hasReactionLabel?49:layout.emoji.size,typ,p.text,'400');
   if(hasReactionLabel)label(ctx,String(content.reaction_label),540,1265,840,30,typ,p.text,'400');
  }
  ctx.save();ctx.font=`22px ${typ.family}`;ctx.textAlign='center';ctx.fillStyle=p.accent;
  if(!first||remaining)ctx.fillText(`עמוד ${pageNo+1}`,540,1300);ctx.restore();
  pages.push(c);first=false;
  if(!remaining)return pages;
 }
 throw Error('הברכה ארוכה מדי למגבלת 20 עמודים; לא הושמט טקסט');
}
export async function cardFiles(pages){
 return Promise.all(pages.map((canvas,i)=>new Promise((resolve,reject)=>{
  canvas.toBlob(blob=>blob?resolve(new File([blob],`page-${i+1}.png`,{type:'image/png'})):reject(Error('לא ניתן לייצא PNG')),'image/png');
 })));
}
export function downloadPage(canvas,name='greeting-card.png'){
 const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=name;a.click();
}
