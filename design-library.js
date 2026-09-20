import {defaultDesign,renderCardPages} from '/guest-card-renderer.js';

const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories={wedding:'חתונה',celebration:'חגיגה',modern:'מודרני',birthday:'יום הולדת',other:'כללי'};
const frames={rounded_gold:'מסגרת מודגשת',thin:'מסגרת עדינה',none:'ללא'};
const patterns={botanical:'צמחי',modern:'מודרני',confetti:'קונפטי',none:'ללא'};
const fonts={hebrew_clean:'עברית נקייה',hebrew_classic:'עברית קלאסית'};
const fields=[['background','רקע'],['text','טקסט'],['accent','הדגשה'],['accent2','עיטור']];
const copy=x=>JSON.parse(JSON.stringify(x));
const optionLine=(group,id,label,checked)=>'<label class="switchrow"><span>'+escape(label)+'</span><input type="checkbox" data-option="'+group+'" value="'+escape(id)+'" '+(checked?'checked':'')+'></label>';
const getNumber=(root,id,min,max)=>{const n=Number(root.querySelector('#'+id)?.value);if(!Number.isFinite(n)||n<min||n>max)throw Error('ערך לא תקין: '+id);return n};
const cleanId=x=>String(x||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,55);
export async function renderDesignLibrary({app,supabase,ctx,go}){
 if(ctx.member.role!=='super_admin'){go('/manager');return}
 app.className='wrap';app.innerHTML='<div class="loading">טוען ספריית עיצובים…</div>';
 let templates=[],selected=null,mode='list',message='',previewRevision=0;
 async function reload(){
  const {data,error}=await supabase.from('card_templates').select('*').or('organization_id.is.null,organization_id.eq.'+ctx.member.organization_id).order('name');
  if(error)throw Error(error.message);
  templates=data||[];
 }
 function feedback(text,isError=false){message=text;const el=app.querySelector('#designFeedback');if(el){el.textContent=text;el.className=isError?'msg err':'msg ok'}}
 function list(){
  mode='list';app.className='wrap';app.innerHTML='<div class="top"><div><button class="btn secondary" id="designBack">← לאירועים</button><h1>ספריית עיצובים</h1><p class="small">כאן מנהלים טמפלייטים לארגון. עיצובי הבסיס נשמרים כתבניות מקור; אפשר לשכפל ולערוך עותק משלך.</p></div><button class="btn" id="addTemplate">+ טמפלייט חדש</button></div><div id="designFeedback" role="status" aria-live="polite"></div><div class="grid">'+templates.map(t=>'<article class="event-card"><div class="row" style="justify-content:space-between"><h3>'+escape(t.name)+'</h3><span class="badge">'+(t.organization_id?'של הארגון':'עיצוב בסיס')+'</span></div><p class="small">'+escape(t.description||categories[t.category]||t.category)+'</p><div class="small">'+Object.keys(t.palettes).length+' צבעים · '+t.frame_options.length+' מסגרות · '+t.pattern_options.length+' עיטורים</div><div class="row" style="margin-top:16px"><button class="btn secondary" data-open="'+escape(t.id)+'">'+(t.organization_id?'עריכה ותצוגה':'תצוגה ושכפול')+'</button></div></article>').join('')+'</div>';
  app.querySelector('#designBack').onclick=()=>go('/manager');
  app.querySelector('#addTemplate').onclick=()=>openEditor(null);
  app.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>openEditor(templates.find(t=>t.id===button.dataset.open)));
 }
 function starter(){
  const t=templates.find(t=>t.active)||templates[0];
  if(!t)throw Error('לא קיימת תבנית בסיס');
  const result=copy(t);
  result.id='';result.name='';result.description='';result.active=false;
  result.organization_id=ctx.member.organization_id;
  return result;
 }
 function renderPalette(t){
  return Object.entries(t.palettes).map(([id,p])=>'<fieldset class="card-edit-panel" data-palette="'+escape(id)+'"><legend>ערכת צבעים · '+escape(id)+'</legend><div class="field"><label class="label">שם התצוגה</label><input class="input" data-palette-label value="'+escape(p.label||id)+'" maxlength="45"></div><div class="row">'+fields.map(([key,label])=>'<div class="field grow"><label class="label">'+label+'</label><input type="color" data-color="'+key+'" value="'+escape(p[key]||'#ffffff')+'"></div>').join('')+'</div><button class="btn secondary" data-remove-palette="'+escape(id)+'">הסר ערכה</button></fieldset>').join('');
 }
 function inputSection(t){
  const sizes=[['title','כותרת'],['name','שם'],['emoji','תגובה']];
  const pos=t.layout.photo||{};
  return '<h3>מבנה ו־Layouts</h3><p class="small">הכרטיס כולל את כל התוכן שהאורח מסר. לכרטיס ללא תמונה או עם מלל ארוך יש Layout נפרד; ברכה שלא נכנסת ממשיכה לעמוד נוסף.</p>'+
   '<div class="row">'+sizes.map(([id,label])=>'<div class="field grow"><label class="label">'+label+' — גודל גופן</label><input class="input" type="number" id="size_'+id+'" min="20" max="80" value="'+escape(t.layout[id]?.size||40)+'"></div>').join('')+'</div>'+
   '<h4>מיקום התמונה בכרטיס</h4><div class="row">'+[['x',0,850],['y',60,950],['w',160,1000],['h',160,1000]].map(([k,min,max])=>'<div class="field grow"><label class="label">'+({x:'X',y:'Y',w:'רוחב',h:'גובה'}[k])+'</label><input class="input" id="photo_'+k+'" type="number" min="'+min+'" max="'+max+'" value="'+escape(pos[k]||0)+'"></div>').join('')+'</div>'+
   '<div class="field"><label class="label">צורת תמונה</label><select id="photoShape" class="select"><option value="rounded" '+(pos.shape!=='ellipse'?'selected':'')+'>מלבן מעוגל</option><option value="ellipse" '+(pos.shape==='ellipse'?'selected':'')+'>אליפסה</option></select></div>'+
   '<h4>מקום להודעה — לפי סוג התוכן</h4>'+
   ['photo','no_photo','photo_long','no_photo_long'].map(k=>'<div class="row"><strong class="grow">'+escape({photo:'עם תמונה',no_photo:'ללא תמונה',photo_long:'עם תמונה וברכה ארוכה',no_photo_long:'ללא תמונה וברכה ארוכה'}[k])+'</strong><div class="field grow"><label class="label">תחילת טקסט (px)</label><input class="input" type="number" data-variant="'+k+'" data-bound="message_top" min="180" max="1190" value="'+escape(t.layout_variants?.[k]?.message_top??(k.startsWith('no_')?332:t.layout.message.top))+'"></div><div class="field grow"><label class="label">סיום טקסט (px)</label><input class="input" type="number" data-variant="'+k+'" data-bound="message_bottom" min="250" max="1250" value="'+escape(t.layout_variants?.[k]?.message_bottom??(k.includes('long')?1200:t.layout.message.bottom))+'"></div></div>').join('')+
   '<div class="field"><label class="label">קובץ עיטור PNG (אופציונלי, עד 2MB)</label><input id="designAsset" type="file" accept="image/png"><p class="small">עיטור יופיע בפינות הכרטיס בלבד, לא במקום התמונה או המלל של האורח.</p></div>';
 }
 function openEditor(source){
  selected=source?copy(source):starter();mode=source?.organization_id?'edit':'create';
  const t=selected,readOnly=!!source&&!source.organization_id;
  app.className='wrap';app.innerHTML='<div class="top"><div><button class="btn secondary" id="backLibrary">← לספרייה</button><h1>'+escape(readOnly?'צפייה בטמפלייט בסיס':mode==='edit'?'עריכת טמפלייט':'טמפלייט חדש')+'</h1></div></div>'+
   '<div id="designFeedback" role="status" aria-live="polite"></div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr))"><section class="card"><div class="content"><div class="field"><label class="label">שם הטמפלייט</label><input class="input" id="templateName" value="'+escape(t.name)+'" maxlength="120"></div>'+
   '<div class="field"><label class="label">תיאור</label><textarea class="textarea" id="templateDescription" maxlength="400">'+escape(t.description||'')+'</textarea></div>'+
   '<div class="field"><label class="label">סוג</label><select class="select" id="templateCategory">'+Object.entries(categories).map(([id,label])=>'<option value="'+id+'" '+(id===t.category?'selected':'')+'>'+label+'</option>').join('')+'</select></div>'+
   '<h3>ערכות צבעים</h3><div id="paletteEditors">'+renderPalette(t)+'</div><button class="btn secondary" id="addPalette">+ ערכת צבעים</button>'+
   '<h3>אפשרויות בעיצוב</h3>'+Object.entries({frame_options:frames,pattern_options:patterns,typography_options:fonts}).map(([group,labels])=>'<h4>'+({frame_options:'מסגרות',pattern_options:'עיטורים',typography_options:'גופנים'}[group])+'</h4>'+Object.entries(labels).map(([id,label])=>optionLine(group,id,label,t[group].includes(id))).join('')).join('')+
   inputSection(t)+
   '<div class="field"><label><input type="checkbox" id="templateActive" '+(t.active?'checked':'')+'> פעיל לבחירה באירועים</label></div>'+
   '<div class="actions"><button class="btn secondary" id="previewTemplate">תצוגה מקדימה</button><button class="btn" id="saveTemplate">'+(readOnly?'שכפל וערוך':'שמור טמפלייט')+'</button></div></div></section>'+
   '<section class="card"><div class="content"><h2>תצוגה מקדימה</h2><p class="small">ברכה להדגמה ללא תמונה; תצוגת התמונה תישמר בגרסאות האירוע.</p><div id="templatePreview" class="personal-card-image"></div></div></section></div>';
  app.querySelector('#backLibrary').onclick=list;
  app.querySelector('#addPalette').onclick=()=>{const input=prompt('מזהה ערכת צבעים באנגלית (למשל sunrise):');if(!input)return;const id=cleanId(input);if(id.length<2||t.palettes[id]){feedback('מזהה לא תקין או כבר קיים',true);return}t.palettes[id]={label:input,background:'#fff8f1',text:'#302c34',accent:'#956b73',accent2:'#d8b9a0'};app.querySelector('#paletteEditors').innerHTML=renderPalette(t);bindPaletteRemovals()};
  function bindPaletteRemovals(){app.querySelectorAll('[data-remove-palette]').forEach(b=>b.onclick=()=>{if(Object.keys(t.palettes).length<=1){feedback('חייבת להישאר לפחות ערכת צבעים אחת',true);return}delete t.palettes[b.dataset.removePalette];app.querySelector('#paletteEditors').innerHTML=renderPalette(t);bindPaletteRemovals()})}
  bindPaletteRemovals();
  app.querySelector('#previewTemplate').onclick=()=>preview(t);
  app.querySelector('#saveTemplate').onclick=()=>save(t,readOnly);
  preview(t);
 }
 function draft(t){
  const result=copy(t),root=app;
  result.name=root.querySelector('#templateName').value.trim();
  result.description=root.querySelector('#templateDescription').value.trim();
  result.category=root.querySelector('#templateCategory').value;
  result.active=root.querySelector('#templateActive').checked;
  if(result.name.length<2)throw Error('צריך שם לטמפלייט');
  for(const group of ['frame_options','pattern_options','typography_options']){
   result[group]=[...root.querySelectorAll('[data-option="'+group+'"]:checked')].map(x=>x.value);
   if(!result[group].length)throw Error('צריך לבחור אפשרות אחת לפחות בכל קבוצת עיצוב');
  }
  for(const block of root.querySelectorAll('[data-palette]')){
   const id=block.dataset.palette;
   result.palettes[id]={...result.palettes[id],label:block.querySelector('[data-palette-label]').value.trim()};
   for(const input of block.querySelectorAll('[data-color]'))result.palettes[id][input.dataset.color]=input.value;
  }
  if(!Object.keys(result.palettes).length)throw Error('נדרשת לפחות ערכת צבעים אחת');
  result.layout.title.size=getNumber(root,'size_title',20,80);
  result.layout.name.size=getNumber(root,'size_name',20,80);
  result.layout.emoji.size=getNumber(root,'size_emoji',20,80);
  for(const [key,min,max] of [['x',0,850],['y',60,950],['w',160,1000],['h',160,1000]]){
   result.layout.photo[key]=getNumber(root,'photo_'+key,min,max);
  }
  if(result.layout.photo.x+result.layout.photo.w>1050||result.layout.photo.y+result.layout.photo.h>1130)
   throw Error('התמונה חורגת משטח הכרטיס');
  result.layout.photo.shape=root.querySelector('#photoShape').value;
  result.layout_variants={};
  for(const key of ['photo','no_photo','photo_long','no_photo_long']){
   const top=Number(root.querySelector('[data-variant="'+key+'"][data-bound="message_top"]').value);
   const bottom=Number(root.querySelector('[data-variant="'+key+'"][data-bound="message_bottom"]').value);
   if(!Number.isFinite(top)||!Number.isFinite(bottom)||top<180||bottom>1250||bottom-top<100)
    throw Error('יש להשאיר לפחות 100px למלל בכל Layout');
   result.layout_variants[key]={message_top:top,message_bottom:bottom};
  }
  return result;
 }
 async function preview(t){
  const revision=++previewRevision,area=app.querySelector('#templatePreview');
  if(!area)return;area.innerHTML='<div class="loading">מכין תצוגה…</div>';
  try{
   const draftTemplate=draft(t),design=defaultDesign({...draftTemplate,active:true});
   const pages=await renderCardPages({template:{...draftTemplate,active:true},design,content:{title:'שמחה גדולה',name:'משפחת ישראלי',message:'המון אהבה, שמחה, אושר ורגעים יפים. שהיום הזה יישאר בלב לתמיד!',emoji:'❤️',reaction_label:'אוהבים אתכם'},image:null});
   if(revision!==previewRevision)return;
   area.innerHTML='';pages.forEach(canvas=>{canvas.className='card-preview';area.appendChild(canvas)});
  }catch(err){if(revision===previewRevision)area.innerHTML='<div class="msg err">'+escape(err.message)+'</div>'}
 }
 async function save(t,readOnly){
  const btn=app.querySelector('#saveTemplate');btn.disabled=true;
  try{
   let payload=draft(t),existing=!readOnly&&mode==='edit';
   if(!existing){
    const id='org_'+crypto.randomUUID().replace(/-/g,'').slice(0,24);
    payload={...payload,id,organization_id:ctx.member.organization_id,revision:1,active:payload.active};
   }else payload.revision=(t.revision||1)+1;
   const asset=app.querySelector('#designAsset')?.files?.[0];
   if(asset){
    if(asset.type!=='image/png'||asset.size>2*1024*1024)throw Error('קובץ העיטור חייב להיות PNG עד 2MB');
    const path=ctx.member.organization_id+'/'+payload.id+'/'+crypto.randomUUID()+'.png';
    const uploaded=await supabase.storage.from('design-assets').upload(path,asset,{contentType:'image/png',upsert:false});
    if(uploaded.error)throw Error(uploaded.error.message);
    payload.decorative_asset_url=supabase.storage.from('design-assets').getPublicUrl(path).data.publicUrl;
   }
   const columns=['id','organization_id','name','description','category','active','revision','layout','layout_variants','palettes','frame_options','crop_strategies','photo_positions','pattern_options','typography_options','decorative_asset_url'];
   const record=Object.fromEntries(columns.map(k=>[k,payload[k]]));
   if(existing){delete record.id;delete record.organization_id;
    const result=await supabase.from('card_templates').update({...record,updated_at:new Date().toISOString()}).eq('id',t.id).eq('organization_id',ctx.member.organization_id).select('id').single();
    if(result.error)throw Error(result.error.message);
   }else{
    const result=await supabase.from('card_templates').insert(record).select('id').single();
    if(result.error)throw Error(result.error.message);
   }
   await reload();selected=templates.find(x=>x.id===payload.id);
   list();feedback('הטמפלייט נשמר. אפשר כעת לבחור אותו בהגדרות העיצוב של אירוע.');
  }catch(err){feedback(err.message,true)}finally{if(btn.isConnected)btn.disabled=false}
 }
 try{await reload();list()}catch(err){app.innerHTML='<div class="msg err">'+escape(err.message)+'</div>'}
}