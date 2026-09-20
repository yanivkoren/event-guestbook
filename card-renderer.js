// Deterministic card compositor. Never sends media or text to an image-generation model.
export const CARD_WIDTH=1080;
export const CARD_HEIGHT=1350;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
function rounded(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y+h,x+w,y,r);ctx.closePath()}
function background(ctx,palette,layout){
 ctx.fillStyle=palette.background;ctx.fillRect(0,0,CARD_WIDTH,CARD_HEIGHT);
 ctx.strokeStyle=palette.accent;ctx.lineWidth=3;rounded(ctx,39,39,1002,1272,30);ctx.stroke();
 ctx.strokeStyle=palette.accent2;ctx.lineWidth=1.5;rounded(ctx,55,55,970,1240,25);ctx.stroke();
 ctx.save();ctx.globalAlpha=.72;
 if(layout.decoration==='botanical'){
  const stem=(x,y,flip)=>{ctx.save();ctx.translate(x,y);ctx.scale(flip,1);ctx.strokeStyle=palette.accent2;ctx.fillStyle=palette.accent2;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(38,-42,67,-95,70,-164);ctx.stroke();for(let i=0;i<5;i++){let z=i*31;ctx.beginPath();ctx.ellipse(20+i*10,-23-z,13,28,-.65,0,2*Math.PI);ctx.fill();ctx.beginPath();ctx.ellipse(39+i*6,-35-z,12,24,.65,0,2*Math.PI);ctx.fill()}ctx.restore()};
  stem(62,197,1);stem(1018,197,-1);stem(65,1290,1);stem(1015,1290,-1);
 }else if(layout.decoration==='confetti'){
  for(let i=0;i<26;i++){const x=85+(i*173%900),y=78+(i*263%1190);ctx.fillStyle=i%2?palette.accent:palette.accent2;ctx.beginPath();ctx.arc(x,y,3+(i%3)*2,0,Math.PI*2);ctx.fill()}
 }else{
  ctx.fillStyle=palette.accent2;ctx.fillRect(74,180,932,5);ctx.fillRect(74,1310,932,5);
 }
 ctx.restore();
}
function border(ctx,p,frame){
 if(frame==='none')return;
 ctx.save();ctx.strokeStyle=p.accent;ctx.lineWidth=frame==='rounded_gold'?14:4;
 ctx.stroke();ctx.restore();
}
function drawPhoto(ctx,image,rect,config,frame,palette){
 const {x,y,w,h,shape,radius}=rect;
 ctx.save();
 if(shape==='ellipse'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2)}
 else rounded(ctx,x,y,w,h,radius||24);
 ctx.clip();
 if(image){
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const scale=Math.max(w/iw,h/ih), sw=w/scale,sh=h/scale;
  const offsets={center:[.5,.5],top:[.5,0],bottom:[.5,1],left:[0,.5],right:[1,.5]};
  const [cx,cy]=offsets[config.crop_strategy]||[.5,.5];
  const fx=config.crop_x??cx,fy=config.crop_y??cy;
  const sx=(iw-sw)*clamp(fx,0,1),sy=(ih-sh)*clamp(fy,0,1);
  ctx.drawImage(image,sx,sy,sw,sh,x,y,w,h);
 }else{
  ctx.fillStyle=palette.accent2;ctx.globalAlpha=.12;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;
  ctx.fillStyle=palette.text;ctx.font='32px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('ללא תמונה',x+w/2,y+h/2);
 }
 ctx.restore();
 ctx.save();ctx.strokeStyle=palette.accent;ctx.lineWidth=frame==='rounded_gold'?14:frame==='thin'?4:0;
 if(shape==='ellipse'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2)}
 else rounded(ctx,x,y,w,h,radius||24);
 if(frame!=='none')ctx.stroke();ctx.restore();
}
function splitLongWord(ctx,word,width){
 let parts=[],part='';
 for(const ch of Array.from(word)){if(part&&ctx.measureText(part+ch).width>width){parts.push(part);part=ch}else part+=ch}
 if(part)parts.push(part);
 return parts;
}
function wrapText(ctx,text,maxWidth){
 const paragraphs=String(text??'').replace(/\r\n?/g,'\n').split('\n');
 const lines=[];
 for(const paragraph of paragraphs){
  if(!paragraph.trim()){lines.push('');continue}
  let line='';
  for(const word of paragraph.trim().split(/\s+/)){
   for(const piece of ctx.measureText(word).width>maxWidth?splitLongWord(ctx,word,maxWidth):[word]){
    const candidate=line?line+' '+piece:piece;
    if(line&&ctx.measureText(candidate).width>maxWidth){lines.push(line);line=piece}else line=candidate;
   }
  }
  lines.push(line);
 }
 return lines;
}
function textBlock(ctx,text,{x=CARD_WIDTH/2,y,maxWidth=890,maxHeight=180,fontSize=40,minSize=20,lineHeight=1.32,color='#222',weight='normal',direction='rtl'}){
 ctx.save();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='top';ctx.direction=direction;
 let lines=[],size=fontSize,leading=0;
 for(;size>=minSize;size--){ctx.font=`${weight} ${size}px Arial, "Noto Sans Hebrew", sans-serif`;lines=wrapText(ctx,text,maxWidth);leading=size*lineHeight;if(lines.length*leading<=maxHeight)break}
 // Don't silently truncate user content: fail rather than corrupt it.
 if(lines.length*leading>maxHeight){ctx.restore();throw new Error('הטקסט ארוך מדי לעיצוב זה. בחרו עיצוב אחר או ערכו את תוכן הכרטיס.')}
 for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],x,y+i*leading);
 ctx.restore();
}
export function defaultCardConfig(template){
 const palette=Object.keys(template.palettes)[0];
 return {template_id:template.id,palette,frame:template.frame_options[0],
  crop_strategy:'center',photo_position:template.photo_positions[0],crop_x:.5,crop_y:.5};
}
export function validateCardConfig(template,config){
 if(!template||!template.active)throw Error('עיצוב לא זמין');
 if(config.template_id!==template.id||!Object.hasOwn(template.palettes,config.palette)
 ||!template.frame_options.includes(config.frame)
 ||!template.crop_strategies.includes(config.crop_strategy)
 ||!template.photo_positions.includes(config.photo_position))throw Error('קונפיגורציית עיצוב לא חוקית');
 return true;
}
export async function loadOriginalPhoto(url){
 if(!url)return null;
 const response=await fetch(url);
 if(!response.ok)throw Error('לא ניתן לקרוא את תמונת המקור');
 const blob=await response.blob();const local=URL.createObjectURL(blob);
 try{const image=new Image();image.src=local;await image.decode();return image}
 finally{URL.revokeObjectURL(local)}
}
export async function renderGreetingCard({template,config,content,image}){
 validateCardConfig(template,config);
 const c=document.createElement('canvas');c.width=CARD_WIDTH;c.height=CARD_HEIGHT;
 const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas אינו זמין בדפדפן');
 const layout=template.layout,palette=template.palettes[config.palette];
 background(ctx,palette,layout);
 drawPhoto(ctx,image,layout.photo,config,config.frame,palette);
 textBlock(ctx,content.title,{y:layout.title.y,maxWidth:930,maxHeight:102,fontSize:layout.title.size,minSize:27,color:palette.text,weight:'bold'});
 textBlock(ctx,content.name,{y:layout.name.y,maxWidth:900,maxHeight:75,fontSize:layout.name.size,minSize:23,color:palette.accent,weight:'bold'});
 textBlock(ctx,content.message,{y:layout.message.top,maxWidth:870,maxHeight:layout.message.bottom-layout.message.top,fontSize:layout.message.size,minSize:16,lineHeight:layout.message.line_height||1.3,color:palette.text});
 if(content.emoji)textBlock(ctx,content.emoji,{y:layout.emoji.y,maxWidth:780,maxHeight:72,fontSize:layout.emoji.size,minSize:30,color:palette.text});
 return c;
}
export function downloadCard(canvas,filename='greeting-card.png'){
 const link=document.createElement('a');link.download=filename;link.href=canvas.toDataURL('image/png');link.click();
}
