import {defaultDesign,renderCardPages} from '/guest-card-renderer.js';

const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=x=>JSON.parse(JSON.stringify(x));
const titles={layout:'מבני כרטיס',palette:'פלטות צבע',pattern:'עיטורים',font_set:'שילובי גופנים'};
const labels={layout:'מבנה כרטיס',palette:'פלטת צבע',pattern:'עיטור',font_set:'שילוב גופנים'};
const colors=[['background','רקע'],['text','טקסט'],['accent','הדגשה'],['accent2','צבע עיטור']];
const cleanId=x=>String(x||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,55);
const validColor=x=>/^#[0-9a-f]{6}$/i.test(x||'');
const options=(items,chosen)=>items.map(([value,label])=>'<option value="'+escape(value)+'" '+(value===chosen?'selected':'')+'>'+escape(label)+'</option>').join('');
export async function renderDesignLibrary({app,supabase,ctx,go}){
 if(ctx.member.role!=='super_admin'){go('/manager');return}
 let components=[],kind='layout',current=null,previewSeq=0;
 const org=ctx.member.organization_id;
 async function reload(){
  const {data,error}=await supabase.from('design_components').select('*').or('organization_id.is.null,organization_id.eq.'+org).order('name');
  if(error)throw Error(error.message);
  components=data||[];
 }
 const info=(msg,bad=false)=>{const el=app.querySelector('#componentFeedback');if(el){el.textContent=msg;el.className=bad?'msg err':'msg ok'}};
 function list(){
  current=null;app.className='wrap';
  app.innerHTML='<div class="top"><div><button class="btn secondary" id="libraryBack">← לאירועים</button><h1>ספריות רכיבי עיצוב</h1><p class="small">ארבע ספריות נפרדות. מנהל האירוע בוחר מבנים, צבעים, עיטורים וגופנים באופן עצמאי.</p></div><button class="btn" id="addComponent">+ רכיב חדש</button></div><div id="componentFeedback" role="status"></div><div class="tabs">'+Object.entries(titles).map(([key,name])=>'<button class="tab '+(kind===key?'active':'')+'" data-kind="'+key+'">'+name+'</button>').join('')+'</div><div class="grid">'+components.filter(c=>c.kind===kind).map(c=>'<article class="event-card"><div class="row" style="justify-content:space-between"><h3>'+escape(c.name)+'</h3><span class="badge">'+(c.organization_id?'של הארגון':'רכיב בסיס')+'</span></div><p class="small">גרסה '+c.revision+' · '+(c.active?'פעיל':'מושבת')+'</p>'+(kind==='palette'?'<div class="row">'+colors.map(([key])=>'<span title="'+key+'" style="display:inline-block;width:40px;height:40px;border:1px solid #ddd;border-radius:10px;background:'+escape(c.config[key]||'#fff')+'"></span>').join('')+'</div>':'')+(kind==='pattern'&&c.config?.asset_url?'<img class="thumb" alt="עיטור" src="'+escape(c.config.asset_url)+'" style="max-height:90px;object-fit:contain">':'')+'<div class="row" style="margin-top:15px"><button class="btn secondary" data-open="'+escape(c.id)+'">'+(c.organization_id?'עריכה':'צפייה ושכפול')+'</button></div></article>').join('')+'</div>';
  app.querySelector('#libraryBack').onclick=()=>go('/manager');
  app.querySelector('#addComponent').onclick=()=>edit(null);
  app.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;list()});
  app.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>edit(components.find(c=>c.id===b.dataset.open)));
 }
 function newItem(){
  const base=components.find(c=>c.kind===kind&&c.active);
  if(!base)throw Error('אין רכיב בסיס בספרייה');
  return {...copy(base),id:'',name:'',organization_id:org,revision:1,active:true};
 }
 function paletteInputs(conf){
  return '<p class="small">בחירת הצבע מתעדכנת מיד בתצוגה, והקוד המלא מוצג לצד כל צבע.</p><div class="row">'+colors.map(([key,label])=>'<div class="field grow"><label class="label">'+label+'</label><input type="color" class="input" style="height:62px;cursor:pointer;padding:4px" data-color="'+key+'" value="'+escape(conf[key]||'#ffffff')+'"><div class="small" style="direction:ltr;text-align:center" data-color-value="'+key+'">'+escape(conf[key]||'#ffffff')+'</div></div>').join('')+'</div>';
 }
 function layoutInputs(conf){
  const p=conf.layout?.photo||{},m=conf.layout?.message||{},e=conf.layout?.emoji||{};
  const fields=[
   ['photo_x','תמונה — מיקום אופקי (X)',p.x,0,850,'מספר הפיקסלים מהקצה השמאלי.'],
   ['photo_y','תמונה — מיקום אנכי (Y)',p.y,60,950,'מספר הפיקסלים מהקצה העליון של אזור העיצוב.'],
   ['photo_w','תמונה — רוחב',p.w,160,1000,'רוחב אזור התמונה בפיקסלים.'],
   ['photo_h','תמונה — גובה',p.h,160,1000,'גובה אזור התמונה בפיקסלים.'],
   ['title_y','כותרת האירוע — גובה',conf.layout?.title?.y,60,600,'נקודת ההתחלה של כותרת האירוע.'],
   ['name_y','שם האורח — גובה',conf.layout?.name?.y,100,1190,'נקודת ההתחלה של שם המברך כשיש תמונה.'],
   ['message_top','ברכה — התחלה',m.top,180,1190,'הגבול העליון של אזור הטקסט בכרטיס עם תמונה.'],
   ['message_bottom','ברכה — סיום',m.bottom,250,1250,'הגבול התחתון של אזור הטקסט בכרטיס עם תמונה.'],
   ['message_size','ברכה — גודל גופן',m.size,22,36,'גודל ברירת המחדל של טקסט הברכה.'],
   ['emoji_y','אימוג׳י — גובה',e.y??1260,180,1290,'נקודת ההתחלה של האימוג׳י. יש להשאיר מקום לברכה ולתיאור התגובה.'],
   ['emoji_size','אימוג׳י — גודל',e.size??60,20,80,'גודל האימוג׳י בפיקסלים.']
  ];
  const checks=[['title','כותרת האירוע','להציג כותרת בחלק העליון'],['photo','תמונה','להציג תמונת אורח כשיש תמונה'],['emoji','אימוג׳י','להציג את האימוג׳י שנבחר'],['reaction_label','תיאור התגובה','להציג כיתוב מתחת לאימוג׳י']];
  return '<div class="field"><label class="label">יחס וגודל התוצר</label><select class="select" id="cardFormat">'+options([['4:5','4:5 — 1080×1350'],['9:16','9:16 — 1080×1920']],conf.format||'4:5')+'</select><p class="small">ב־9:16 האזור המעוצב נשאר במידותיו וממוקם במרכז הקנבס הארוך, בלי למתוח תמונה או טקסט.</p></div>'+
   '<h3>רכיבים שיוצגו בכרטיס</h3><p class="small">שם האורח והברכה נשארים חובה כדי שלא יאבד תוכן שנשלח. אפשר להסתיר את הרכיבים הבאים:</p>'+
   checks.map(([key,label,help])=>'<label class="switchrow"><span><strong>'+label+'</strong><br><span class="small">'+help+'</span></span><input type="checkbox" data-visible="'+key+'" '+(conf.layout?.visibility?.[key]===false?'':'checked')+'></label>').join('')+
   '<h3>מיקום וגודל</h3><p class="small">כל הערכים נמדדים בפיקסלים ביחס לאזור העיצוב (1080×1350). בתצוגה קו מקווקו מסמן כל אזור גלוי.</p>'+
   '<div class="row">'+fields.map(([key,label,value,min,max,help])=>'<div class="field grow"><label class="label">'+label+'</label><input class="input" data-layout="'+key+'" type="number" min="'+min+'" max="'+max+'" value="'+escape(value??0)+'"><p class="small">'+help+'</p></div>').join('')+'</div>'+
   '<div class="field"><label class="label">צורת חלון התמונה</label><select id="photoShape" class="select">'+options([['rounded','מלבן עם פינות מעוגלות'],['ellipse','אליפסה']],p.shape)+'</select></div>';
 }
 function patternInputs(conf){
  const choices=[['botanical','ענפים ועלים'],['modern','קווים אלגנטיים'],['confetti','קונפטי'],['stars','כוכבים'],['hearts','לבבות'],['geometric','צורות גאומטריות'],['waves','גלים'],['uploaded','עיטור מתמונה שהעלית'],['none','ללא עיטור']];
  return '<div class="field"><label class="label">סוג העיטור</label><select class="select" id="rendererPattern">'+options(choices,conf.renderer_id||'none')+'</select><p class="small">אפשר ליצור כמה רכיבי עיטור שונים מאותו סוג. כשדרושה צורה אחרת לגמרי, בחר ״עיטור מתמונה שהעלית״ והעלה PNG.</p></div><div class="field"><label class="label">קובץ עיטור PNG — מה זה?</label><p class="small">זו תמונה עם רקע שקוף, למשל פרח, מסגרת או איור ששירי הכינה. הקובץ משתלב בפינות הכרטיס מעל הרקע, בלי להחליף את תמונת האורח או את הברכה. עד 2MB; מומלץ PNG שקוף.</p><input id="patternPng" type="file" accept=".png,image/png"></div>'+(conf.asset_url?'<div class="field"><p class="small">העיטור השמור:</p><img class="thumb" style="max-height:130px;object-fit:contain" src="'+escape(conf.asset_url)+'" alt="עיטור קיים"></div>':'');
 }
 function fontInputs(conf){
  return '<div class="field"><label class="label">מקור הגופן</label><select class="select" id="rendererFont">'+options([['hebrew_clean','מובנה — עברית נקייה (Sans serif)'],['hebrew_classic','מובנה — עברית קלאסית (Serif)'],['uploaded','קובץ גופן שאני מעלה']],conf.renderer_id||'hebrew_clean')+'</select></div>'+
    '<div class="field"><label class="label">הוספת גופן חדש</label><p class="small">כדי להוסיף גופן שאינו בספרייה, בחר ״קובץ גופן שאני מעלה״ והעלה קובץ WOFF2, WOFF, TTF או OTF (עד 2MB). מומלץ WOFF2 שתומך בעברית. יש להשתמש רק בגופן שמותר לך להטמיע באתר.</p><input type="file" id="fontFile" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"></div>'+
    (conf.asset_url?'<p class="small">קיים קובץ גופן שמור. ניתן להחליף אותו בהעלאת קובץ חדש.</p>':'');
 }
 function editorMarkup(item,readOnly){
  const conf=item.config||{};
  return '<div class="top"><div><button class="btn secondary" id="backLibrary">← לספריות</button><h1>'+escape(readOnly?'צפייה ברכיב בסיס':item.id?'עריכת '+labels[kind]:'רכיב חדש: '+labels[kind])+'</h1></div></div><div id="componentFeedback" role="status"></div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr))"><section class="card"><div class="content"><div class="field"><label class="label">שם הרכיב</label><input class="input" id="componentName" maxlength="120" value="'+escape(item.name)+'"></div>'+
   (kind==='palette'?paletteInputs(conf):kind==='layout'?layoutInputs(conf):kind==='pattern'?patternInputs(conf):
    fontInputs(conf))+
   '<label class="switchrow"><span>פעיל לבחירה באירועים</span><input type="checkbox" id="componentActive" '+(item.active?'checked':'')+'></label><div class="actions"><button class="btn secondary" id="previewComponent">תצוגה מקדימה</button><button class="btn" id="saveComponent">'+(readOnly?'שכפל לרכיב חדש':'שמור רכיב')+'</button></div></div></section><section class="card"><div class="content"><h2>תצוגה מקדימה</h2><div id="componentPreview" class="personal-card-image"></div></div></section></div>';
 }
 function draft(item){
  const conf=copy(item.config||{});
  const name=app.querySelector('#componentName').value.trim();
  if(name.length<2)throw Error('יש לתת שם לרכיב');
  if(kind==='palette'){
   for(const [key] of colors){const v=app.querySelector('[data-color="'+key+'"]').value;if(!validColor(v))throw Error('צבע לא תקין');conf[key]=v}
   conf.label=name;
  }else if(kind==='layout'){
   const v={};for(const field of app.querySelectorAll('[data-layout]')){const num=Number(field.value);if(!Number.isFinite(num)||num<Number(field.min)||num>Number(field.max))throw Error('מיקום או גודל לא תקין');v[field.dataset.layout]=num}
   const shown=Object.fromEntries([...app.querySelectorAll('[data-visible]')].map(x=>[x.dataset.visible,x.checked]));
   if(shown.photo&&(v.photo_x+v.photo_w>1050||v.photo_y+v.photo_h>1130))throw Error('התמונה חורגת מגבולות אזור העיצוב');
   if(v.message_bottom-v.message_top<100)throw Error('יש להשאיר לפחות 100px לברכה');
   if(shown.emoji&&v.emoji_y+v.emoji_size>1350)throw Error('האימוג׳י חורג מגבולות הכרטיס');
   conf.format=app.querySelector('#cardFormat').value;
   conf.layout.visibility=shown;
   conf.layout.photo={...conf.layout.photo,x:v.photo_x,y:v.photo_y,w:v.photo_w,h:v.photo_h,shape:app.querySelector('#photoShape').value};
   conf.layout.title={...conf.layout.title,y:v.title_y};
   conf.layout.name={...conf.layout.name,y:v.name_y};
   conf.layout.message={...conf.layout.message,top:v.message_top,bottom:v.message_bottom,size:v.message_size};
   conf.layout.emoji={...conf.layout.emoji,y:v.emoji_y,size:v.emoji_size};
   conf.layout_variants=conf.layout_variants||{};
   conf.layout_variants.photo={message_top:v.message_top,message_bottom:v.message_bottom};
   conf.layout_variants.photo_long={message_top:v.message_top,message_bottom:Math.max(v.message_bottom,1200)};
  }else if(kind==='pattern')conf.renderer_id=app.querySelector('#rendererPattern').value;
  else{
   conf.renderer_id=app.querySelector('#rendererFont').value;
   if(conf.renderer_id!=='uploaded')delete conf.asset_url;
  }
  return {...item,name,config:conf,active:app.querySelector('#componentActive').checked};
 }
 function examplePhoto(){
  const c=document.createElement('canvas');c.width=600;c.height=460;const x=c.getContext('2d');
  const sky=x.createLinearGradient(0,0,0,460);sky.addColorStop(0,'#c8dce5');sky.addColorStop(1,'#ead5c5');x.fillStyle=sky;x.fillRect(0,0,600,460);
  x.fillStyle='#f5e1b7';x.beginPath();x.arc(460,115,52,0,Math.PI*2);x.fill();
  x.fillStyle='#879c91';x.beginPath();x.moveTo(0,315);x.lineTo(170,145);x.lineTo(345,320);x.fill();
  x.fillStyle='#68857d';x.beginPath();x.moveTo(140,345);x.lineTo(375,130);x.lineTo(600,340);x.fill();
  x.fillStyle='#466b64';x.fillRect(0,335,600,125);
  x.fillStyle='#fff';x.globalAlpha=.85;x.fillRect(105,362,390,65);x.globalAlpha=1;
  x.fillStyle='#24443b';x.font='bold 27px Arial';x.textAlign='center';x.fillText('תמונה לדוגמה',300,404);
  const image=new Image();image.src=c.toDataURL('image/png');return image.decode().then(()=>image);
 }
 async function preview(item){
  const area=app.querySelector('#componentPreview'),rev=++previewSeq;if(!area)return;
  area.innerHTML='<div class="loading">מכין תצוגה…</div>';
  const tempUrls=[];
  try{
   const edited=draft(item);
   const byKind=k=>components.find(c=>c.kind===k&&c.active);
   const layout=(kind==='layout'?edited:byKind('layout'))?.config;
   const palette=(kind==='palette'?edited:byKind('palette'))?.config;
   const pattern=(kind==='pattern'?edited:byKind('pattern'))?.config;
   const font=(kind==='font_set'?edited:byKind('font_set'))?.config;
   if(!layout||!palette||!pattern||!font)throw Error('חסר רכיב לתצוגה');
   const patternId=pattern.renderer_id||'none',fontId=font.renderer_id||'hebrew_clean';
   let patternUrl=pattern.asset_url,fontUrl=font.asset_url;
   if(kind==='pattern'&&app.querySelector('#patternPng')?.files?.[0]){
    const file=app.querySelector('#patternPng').files[0];patternUrl=URL.createObjectURL(file);tempUrls.push(patternUrl);
   }
   if(kind==='font_set'&&app.querySelector('#fontFile')?.files?.[0]){
    const file=app.querySelector('#fontFile').files[0];fontUrl=URL.createObjectURL(file);tempUrls.push(fontUrl);
   }
   if(fontId==='uploaded'&&!fontUrl)throw Error('כדי לראות גופן חדש, בחר קובץ גופן.');
   if(patternId==='uploaded'&&!patternUrl)throw Error('כדי לראות עיטור שהעלית, בחר קובץ PNG.');
   const design={template_id:'preview',palette:'preview',pattern_id:patternId,typography_id:fontId,frame:'thin',crop_strategy:'center',photo_position:'center',crop_x:.5,crop_y:.5};
   const t={id:'preview',active:true,format:layout.format||'4:5',layout:layout.layout,layout_variants:layout.layout_variants,palettes:{preview:palette},
    pattern_options:[patternId],typography_options:[fontId],frame_options:['thin'],crop_strategies:['center'],photo_positions:['center'],
    pattern_asset_urls:patternUrl?{[patternId]:patternUrl}:{},font_definitions:fontUrl?{[fontId]:{asset_url:fontUrl}}:{}};
   const sample=await examplePhoto();
   const pages=await renderCardPages({template:t,design,content:{title:'שמחה גדולה',name:'משפחת ישראלי',
    message:'המון אהבה, שמחה ורגעים טובים. תודה שאתם איתנו ביום המיוחד!',emoji:'❤️',reaction_label:'אוהבים אתכם'},image:sample,previewGuides:true});
   if(rev!==previewSeq)return;area.innerHTML='';
   for(const canvas of pages){canvas.className='card-preview';area.appendChild(canvas)}
   const p=document.createElement('p');p.className='small';p.textContent='קווי המתאר המקווקווים מוצגים רק בתצוגת העריכה ולא בקובץ הכרטיס הסופי.';area.appendChild(p);
  }catch(e){if(rev===previewSeq)area.innerHTML='<div class="msg err">'+escape(e.message)+'</div>'}
  finally{for(const url of tempUrls)URL.revokeObjectURL(url)}
 }
 function edit(source){
  current=source?copy(source):newItem();const readOnly=!!source&&!source.organization_id;
  app.className='wrap';app.innerHTML=editorMarkup(current,readOnly);
  app.querySelector('#backLibrary').onclick=list;
  app.querySelector('#previewComponent').onclick=()=>preview(current);
  app.querySelector('#saveComponent').onclick=()=>save(current,readOnly);
  app.querySelectorAll('[data-color]').forEach(field=>field.addEventListener('input',()=>{
   const label=app.querySelector('[data-color-value="'+field.dataset.color+'"]');if(label)label.textContent=field.value;
   preview(current);
  }));
  app.querySelectorAll('[data-layout], [data-visible], #cardFormat, #photoShape, #rendererPattern, #rendererFont, #patternPng, #fontFile]').forEach(field=>field.addEventListener('change',()=>preview(current)));
  preview(current);
 }
 async function save(item,readOnly){
  const btn=app.querySelector('#saveComponent');btn.disabled=true;
  try{
   const edited=draft(item),existing=!!item.id&&!readOnly;
   const id=existing?item.id:'org_'+kind+'_'+crypto.randomUUID().replace(/-/g,'').slice(0,24);
   const config=edited.config;
   if(kind==='pattern'){
    const file=app.querySelector('#patternPng')?.files?.[0];
    if(file){
     if(file.type!=='image/png'||file.size>2*1024*1024)throw Error('יש לבחור PNG עד 2MB');
     const path=org+'/'+id+'/'+crypto.randomUUID()+'.png';
     const uploaded=await supabase.storage.from('design-assets').upload(path,file,{contentType:'image/png',upsert:false});
     if(uploaded.error)throw Error(uploaded.error.message);
     config.asset_url=supabase.storage.from('design-assets').getPublicUrl(path).data.publicUrl;
    }
    if(config.renderer_id==='uploaded'&&!config.asset_url)throw Error('בחר עיטור PNG להעלאה.');
   }
   if(kind==='font_set'){
    const file=app.querySelector('#fontFile')?.files?.[0];
    if(file&&config.renderer_id==='uploaded'){
     const ext=(file.name.split('.').pop()||'').toLowerCase();
     const mime={woff2:'font/woff2',woff:'font/woff',ttf:'font/ttf',otf:'font/otf'}[ext];
     if(!mime||file.size>2*1024*1024||file.size===0)throw Error('יש לבחור קובץ גופן WOFF2, WOFF, TTF או OTF עד 2MB');
     const path=org+'/'+id+'/'+crypto.randomUUID()+'.'+ext;
     const uploaded=await supabase.storage.from('design-assets').upload(path,file,{contentType:mime,upsert:false});
     if(uploaded.error)throw Error(uploaded.error.message);
     config.asset_url=supabase.storage.from('design-assets').getPublicUrl(path).data.publicUrl;
    }
    if(config.renderer_id==='uploaded'&&!config.asset_url)throw Error('בחר קובץ גופן כדי להוסיף גופן חדש.');
   }
   const payload={name:edited.name,kind,active:edited.active,config,revision:existing?(item.revision||1)+1:1,updated_at:new Date().toISOString()};
   let error;
   if(existing){({error}=await supabase.from('design_components').update(payload).eq('id',item.id).eq('organization_id',org))}
   else({error}=await supabase.from('design_components').insert({...payload,id,organization_id:org}));
   if(error)throw Error(error.message);
   await reload();list();info('הרכיב נשמר בספרייה וניתן לבחור בו באירועים.');
  }catch(e){info(e.message,true)}finally{if(btn.isConnected)btn.disabled=false}
 }
 try{await reload();list()}catch(e){app.className='wrap';app.innerHTML='<div class="msg err">'+escape(e.message)+'</div>'}
}
