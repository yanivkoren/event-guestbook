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
  return '<div class="row">'+colors.map(([key,label])=>'<div class="field grow"><label class="label">'+label+'</label><input type="color" class="input" data-color="'+key+'" value="'+escape(conf[key]||'#ffffff')+'"></div>').join('')+'</div>';
 }
 function layoutInputs(conf){
  const p=conf.layout?.photo||{},m=conf.layout?.message||{};
  const fields=[['photo_x','תמונה X',p.x,0,850],['photo_y','תמונה Y',p.y,60,950],['photo_w','רוחב תמונה',p.w,160,1000],['photo_h','גובה תמונה',p.h,160,1000],['title_y','כותרת Y',conf.layout?.title?.y,60,600],['name_y','שם Y',conf.layout?.name?.y,100,1190],['message_top','תחילת ברכה',m.top,180,1190],['message_bottom','סיום ברכה',m.bottom,250,1250],['message_size','גודל ברכה',m.size,22,36]];
  return '<p class="small">מיקום האזורים בקנבס 1080×1350. הגדרות ברכה ארוכה נשמרות במבנה.</p><div class="row">'+fields.map(([key,label,v,min,max])=>'<div class="field grow"><label class="label">'+label+'</label><input class="input" data-layout="'+key+'" type="number" min="'+min+'" max="'+max+'" value="'+escape(v??0)+'"></div>').join('')+'</div><div class="field"><label class="label">צורת תמונה</label><select id="photoShape" class="select">'+options([['rounded','מלבן מעוגל'],['ellipse','אליפסה']],p.shape)+'</select></div>';
 }
 function patternInputs(conf){
  return '<div class="field"><label class="label">צורת עיטור</label><select class="select" id="rendererPattern">'+options([['botanical','צמחי'],['modern','מודרני'],['confetti','קונפטי'],['none','ללא']],conf.renderer_id||'none')+'</select></div><div class="field"><label class="label">עיטור PNG שקוף (אופציונלי, עד 2MB)</label><input id="patternPng" type="file" accept="image/png"><p class="small">הקובץ משויך לעיטור הזה בלבד ויוצג בפינות כדי לא לכסות תמונה או ברכה.</p></div>'+(conf.asset_url?'<img class="thumb" style="max-height:130px;object-fit:contain" src="'+escape(conf.asset_url)+'" alt="עיטור קיים">':'');
 }
 function editorMarkup(item,readOnly){
  const conf=item.config||{};
  return '<div class="top"><div><button class="btn secondary" id="backLibrary">← לספריות</button><h1>'+escape(readOnly?'צפייה ברכיב בסיס':item.id?'עריכת '+labels[kind]:'רכיב חדש: '+labels[kind])+'</h1></div></div><div id="componentFeedback" role="status"></div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr))"><section class="card"><div class="content"><div class="field"><label class="label">שם הרכיב</label><input class="input" id="componentName" maxlength="120" value="'+escape(item.name)+'"></div>'+
   (kind==='palette'?paletteInputs(conf):kind==='layout'?layoutInputs(conf):kind==='pattern'?patternInputs(conf):
    '<div class="field"><label class="label">משפחת גופנים</label><select class="select" id="rendererFont">'+options([['hebrew_clean','עברית נקייה'],['hebrew_classic','עברית קלאסית']],conf.renderer_id||'hebrew_clean')+'</select><p class="small">אפשר להרחיב בהמשך את מנוע הרינדור לגופנים נוספים בעברית.</p></div>')+
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
   if(v.photo_x+v.photo_w>1050||v.photo_y+v.photo_h>1130)throw Error('התמונה חורגת מגבולות הכרטיס');
   if(v.message_bottom-v.message_top<100)throw Error('יש להשאיר לפחות 100px לברכה');
   conf.layout.photo={...conf.layout.photo,x:v.photo_x,y:v.photo_y,w:v.photo_w,h:v.photo_h,shape:app.querySelector('#photoShape').value};
   conf.layout.title={...conf.layout.title,y:v.title_y};
   conf.layout.name={...conf.layout.name,y:v.name_y};
   conf.layout.message={...conf.layout.message,top:v.message_top,bottom:v.message_bottom,size:v.message_size};
   conf.layout_variants=conf.layout_variants||{};
   conf.layout_variants.photo={message_top:v.message_top,message_bottom:v.message_bottom};
   conf.layout_variants.photo_long={message_top:v.message_top,message_bottom:Math.max(v.message_bottom,1200)};
  }else if(kind==='pattern')conf.renderer_id=app.querySelector('#rendererPattern').value;
  else conf.renderer_id=app.querySelector('#rendererFont').value;
  return {...item,name,config:conf,active:app.querySelector('#componentActive').checked};
 }
 async function preview(item){
  const area=app.querySelector('#componentPreview'),rev=++previewSeq;if(!area)return;
  area.innerHTML='<div class="loading">מכין תצוגה…</div>';
  try{
   const edited=draft(item);
   const byKind=k=>components.find(c=>c.kind===k&&c.active);
   const layout=(kind==='layout'?edited:byKind('layout'))?.config;
   const palette=(kind==='palette'?edited:byKind('palette'))?.config;
   const pattern=(kind==='pattern'?edited:byKind('pattern'))?.config;
   const font=(kind==='font_set'?edited:byKind('font_set'))?.config;
   if(!layout||!palette||!pattern||!font)throw Error('חסר רכיב לתצוגה');
   const patternId=pattern.renderer_id||'none',fontId=font.renderer_id||'hebrew_clean';
   const design={template_id:'preview',palette:'preview',pattern_id:patternId,typography_id:fontId,frame:'thin',crop_strategy:'center',photo_position:'center',crop_x:.5,crop_y:.5};
   const t={id:'preview',active:true,layout:layout.layout,layout_variants:layout.layout_variants,palettes:{preview:palette},pattern_options:[patternId],typography_options:[fontId],frame_options:['thin'],crop_strategies:['center'],photo_positions:['center'],pattern_asset_urls:pattern.asset_url?{[patternId]:pattern.asset_url}:{}};
   const pages=await renderCardPages({template:t,design,content:{title:'שמחה גדולה',name:'משפחת ישראלי',message:'המון אהבה, שמחה ורגעים טובים. תודה שאתם איתנו ביום המיוחד!',emoji:'❤️'},image:null});
   if(rev!==previewSeq)return;area.innerHTML='';for(const canvas of pages){canvas.className='card-preview';area.appendChild(canvas)}
  }catch(e){if(rev===previewSeq)area.innerHTML='<div class="msg err">'+escape(e.message)+'</div>'}
 }
 function edit(source){
  current=source?copy(source):newItem();const readOnly=!!source&&!source.organization_id;
  app.className='wrap';app.innerHTML=editorMarkup(current,readOnly);
  app.querySelector('#backLibrary').onclick=list;
  app.querySelector('#previewComponent').onclick=()=>preview(current);
  app.querySelector('#saveComponent').onclick=()=>save(current,readOnly);
  if(kind!=='pattern'||!current.config?.asset_url)preview(current);
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
