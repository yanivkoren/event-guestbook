import {defaultDesign,loadPhoto,renderCardPages,cardFiles} from '/guest-card-renderer.js';

// The guest sees a finished card, not the template editor.
// A personal URL is a private bearer credential and is never part of a shared image.
export async function renderGuestCardPage({token,app,api}){
 const base=api+'?token='+encodeURIComponent(token);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const errorScreen=message=>{app.className='wrap';app.innerHTML='<section class="card"><div class="content"><div class="msg err">'+esc(message)+'</div><button class="btn secondary" id="reloadCard">ניסיון נוסף</button></div></section>';document.getElementById('reloadCard').onclick=()=>location.reload()};
 async function request(action,body){
  const response=await fetch(base+'&action='+encodeURIComponent(action),{
   method:body?'POST':'GET',
   ...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{}),
   ...(body&&!(body instanceof FormData)?{headers:{'content-type':'application/json'}}:{})
  });
  const result=await response.json().catch(()=>({error:'שגיאה לא צפויה'}));
  if(!response.ok)throw Error(result.error||'הפעולה לא הושלמה');
  return result;
 }
 let state,photo=null,viewedId=null,editing=false,busy=false,message='';
 const attempts=()=>state?.design_attempts_used||0;
 const chosen=()=>state?.versions?.find(v=>v.id===state.selected_version_id)||null;
 const visible=()=>state?.versions?.find(v=>v.id===viewedId)||chosen()||state?.versions?.[state.versions.length-1]||null;
 const canEdit=()=>!!state?.can_edit;
 function note(value){message=value;const node=document.getElementById('cardNotice');if(node)node.textContent=value}
 function markBusy(value){busy=value;app.querySelectorAll('[data-action]').forEach(b=>b.disabled=value)}
 function canvasFor(imageUrl){
  return '<img class="card-preview" src="'+esc(imageUrl)+'" alt="כרטיס הברכה שלך">';
 }
 async function refresh(preferredId){
  state=await request('state');
  if(state.deleted){app.className='wrap';app.innerHTML='<section class="card"><div class="content"><h1>הברכה נמחקה</h1><p>הברכה הוסרה מהמערכת ואינה זמינה עוד לצפייה או לשיתוף.</p></div></section>';return false}
  const present=state.versions.some(v=>v.id===preferredId);
  viewedId=present?preferredId:state.selected_version_id||state.versions[state.versions.length-1]?.id||null;
  return true;
 }
 function allowedFor(template,key,all){
  const perEvent=state.card_design_rules?.[template.id]?.[key];
  const options=Array.isArray(perEvent)?perEvent.filter(x=>all.includes(x)):all;
  return options;
 }
 function designFor(template){
  const d=defaultDesign(template);
  d.palette=allowedFor(template,'palettes',Object.keys(template.palettes))[0];
  d.frame=allowedFor(template,'frames',template.frame_options)[0];
  d.pattern_id=allowedFor(template,'patterns',template.pattern_options)[0];
  d.typography_id=allowedFor(template,'typography',template.typography_options)[0];
  if(!d.palette||!d.frame||!d.pattern_id||!d.typography_id)throw Error('לא הוגדרו די אפשרויות עיצוב לאירוע');
  return d;
 }
 function alternativeDesign(){
  const allowed=state.templates||[],current=visible();
  const taken=state.versions.filter(v=>v.creation_kind!=='edit').map(v=>v.design_snapshot);
  if(!allowed.length)return null;
  const start=allowed.findIndex(t=>t.id===current?.design_snapshot?.template_id);
  const ordered=[...allowed.slice(Math.max(0,start+1)),...allowed.slice(0,Math.max(0,start+1))];
  for(const t of ordered){
   for(const palette of allowedFor(t,'palettes',Object.keys(t.palettes))){
    for(const pattern_id of allowedFor(t,'patterns',t.pattern_options)){
     for(const frame of allowedFor(t,'frames',t.frame_options)){
      for(const typography_id of allowedFor(t,'typography',t.typography_options)){
       const candidate={...designFor(t),palette,pattern_id,frame,typography_id,
        crop_x:current?.design_snapshot?.crop_x??.5,crop_y:current?.design_snapshot?.crop_y??.5};
       if(!taken.some(d=>['template_id','palette','pattern_id','frame','typography_id','photo_position'].every(k=>d[k]===candidate[k])))
        return {template:t,design:candidate};
      }
     }
    }
   }
  }
  return null;
 }
 async function generate(kind,content,replacementPhoto=null){
  if(busy||!canEdit())return;
  if(kind!=='edit'&&attempts()>=state.max_design_attempts){note('נוצלו כל ניסיונות העיצוב לאירוע הזה.');return}
  const origin=visible();
  let target;
  if(kind==='initial'){
   const template=state.templates.find(t=>t.id===state.default_template_id)||state.templates[0];
   if(!template){errorScreen('לא הוגדר עיצוב לאירוע.');return}
   target={template,design:designFor(template)};
  }else if(kind==='alternative')target=alternativeDesign();
  else{
   const template=state.templates.find(t=>t.id===origin?.design_snapshot?.template_id);
   if(template)target={template,design:{...origin.design_snapshot}};
  }
  if(!target){note('אין כרגע עיצוב נוסף בספרייה שהוגדרה לאירוע.');return}
  const source=content||origin?.content_snapshot||state.original;
  const reaction=(state.reaction_options||[]).find(o=>o.emoji===source.emoji);
  const text={...source,reaction_label:reaction?.label||source.reaction_label||''};
  markBusy(true);
  if(!state.versions.length)app.innerHTML='<div class="loading">מכינים את כרטיס הברכה שלך…</div>';
  else note(kind==='alternative'?'מכינים לך עיצוב אחר…':'שומרים גרסה חדשה…');
  try{
   let image=photo;
   if(replacementPhoto){
    const objectUrl=URL.createObjectURL(replacementPhoto);
    try{image=await loadPhoto(objectUrl)}finally{URL.revokeObjectURL(objectUrl)}
   }else if(origin?.photo_url)image=await loadPhoto(origin.photo_url);
   else if(origin&&!origin.photo_url)image=null;
   const pages=await renderCardPages({template:target.template,design:target.design,content:text,image});
   const files=await cardFiles(pages),body=new FormData();
   body.set('configuration',JSON.stringify({
    creation_kind:kind,source_version_id:origin?.id||null,
    content:text,design:target.design
   }));
   for(const file of files)body.append('page',file);
   if(replacementPhoto)body.append('replacement_photo',replacementPhoto);
   const saved=await request('version',body);
   if(!await refresh(saved.version_id))return;
   editing=false;
   message=kind==='initial'?'הכרטיס מוכן! אפשר לשתף אותו או לנסות עיצוב אחר.':'הגרסה החדשה מוכנה ואפשר לשתף אותה.';
   mount();
  }catch(err){
   if(!state.versions.length)errorScreen(err.message);
   else note(err.message);
  }finally{markBusy(false)}
 }
 async function chooseVersion(id){
  if(!canEdit()||busy)return;
  markBusy(true);
  try{
   await request('select',{version_id:id});
   if(!await refresh(id))return;
   editing=false;message='הכרטיס נבחר! אפשר לשתף אותו כתמונה ולשמור את הקישור האישי.';
   mount();
  }catch(err){note(err.message)}finally{markBusy(false)}
 }
 async function loadImageFiles(v){
  const files=[];
  const eventFilename=String(state.event?.title||'ברכה').normalize('NFC')
   .replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim().slice(0,80)||'ברכה';
  for(let i=0;i<v.page_urls.length;i++){
   const res=await fetch(v.page_urls[i]);
   if(!res.ok)throw Error('לא ניתן לטעון את התמונה לשיתוף');
   files.push(new File([await res.blob()],eventFilename+(v.page_urls.length>1?'-עמוד-'+(i+1):'')+'.png',{type:'image/png'}));
  }
  return files;
 }
 async function downloadVersion(v){
  const files=await loadImageFiles(v);
  for(const file of files){
   const objectUrl=URL.createObjectURL(file),a=document.createElement('a');
   a.href=objectUrl;a.download=file.name;a.click();
   setTimeout(()=>URL.revokeObjectURL(objectUrl),10000);
  }
 }
 async function shareVersion(v){
  if(!v||v.id!==state.selected_version_id){note('כדי לשתף, בחר קודם את הכרטיס שאהבת.');return}
  try{
   const files=await loadImageFiles(v);
   if(navigator.share&&navigator.canShare?.({files})){await navigator.share({files});return}
   note('שיתוף ישיר אינו נתמך במכשיר הזה. הורד את התמונה ושתף אותה מהגלריה.');
  }catch(err){if(err.name!=='AbortError')note('השיתוף לא הושלם. אפשר להוריד את התמונה ולשתף מהגלריה.')}
 }
 async function copyLink(){
  const feedback=app.querySelector('#personalLinkFeedback');
  const button=app.querySelector('[data-action="copy"]');
  try{
   await navigator.clipboard.writeText(location.href);
   if(feedback){
    feedback.hidden=false;
    feedback.textContent='✓ הקישור הועתק ללוח ההעתקה (Clipboard). חשוב לשמור אותו במקום בטוח: אין לך תיעוד אחר של הקישור, ואין אפשרות לשחזר אותו אם יאבד.';
   }
   if(button)button.textContent='✓ הקישור הועתק';
  }catch{
   if(feedback){
    feedback.hidden=false;
    feedback.textContent='לא הצלחנו להעתיק אוטומטית. יש להעתיק את הקישור בחלון שנפתח ולשמור אותו במקום בטוח — אין אפשרות לשחזר אותו אם יאבד.';
   }
   prompt('העתק ושמור את הקישור כדי לחזור לברכה:',location.href);
  }
 }
 function showEdit(){
  editing=true;mount();
  document.getElementById('editName')?.focus();
 }
 function contentFromEditor(){
  const baseVersion=visible();
  return {
   title:baseVersion?.content_snapshot?.title??state.original.title,
   name:document.getElementById('editName').value,
   message:document.getElementById('editMessage').value,
   emoji:document.getElementById('editEmoji').value,
   reaction_label:(state.reaction_options||[]).find(o=>o.emoji===document.getElementById('editEmoji').value)?.label
    ||(baseVersion?.content_snapshot?.emoji===document.getElementById('editEmoji').value?baseVersion?.content_snapshot?.reaction_label:'')||''
  };
 }
 function mount(){
  const current=visible(),approved=chosen(),open=canEdit();
  const currentSelected=!!current&&current.id===state.selected_version_id;
  const gallery=state.versions.length>1?'<details class="card-older"><summary>גרסאות קודמות ('+state.versions.length+')</summary><div class="card-version-list">'+
   state.versions.map(v=>'<button type="button" class="card-version'+(v.id===current?.id?' current':'')+'" data-view="'+esc(v.id)+'"><img src="'+esc(v.page_urls[0])+'" alt="גרסה '+v.version_number+'"><span>גרסה '+v.version_number+(v.id===state.selected_version_id?' · הכרטיס שבחרת':'')+'</span></button>').join('')+
   '</div></details>':'';
  const currentFiles=current?.page_urls||[];
  app.className='wrap personal-card-page';
  app.innerHTML='<section class="card personal-card-shell"><div class="content"><div class="center"><h1>כרטיס הברכה שלך ❤️</h1><p class="small">'+esc(state.event.title)+'</p></div>'+
   (!open?'<div class="msg">חלון העריכה הסתיים. אפשר להמשיך לצפות ולשתף את הכרטיס שבחרת.</div>':'')+
   '<div id="cardNotice" class="card-notice" role="status" aria-live="polite">'+esc(message)+'</div>'+
   (current?'<div class="personal-card-image">'+currentFiles.map((url,i)=>'<div class="card-page">'+canvasFor(url)+(currentFiles.length>1?'<span class="small">עמוד '+(i+1)+' מתוך '+currentFiles.length+'</span>':'')+'</div>').join('')+'</div>':
   '<div class="loading">מכינים לך כרטיס…</div>')+
   (current?'<div class="personal-actions">'+
      (currentSelected?'<button class="btn" data-action="share">שתף כתמונה ↗</button>':'')+
      (approved&&!currentSelected?'<p class="small">זו גרסה קודמת. אפשר לחזור אליה דרך בחירתה בגלריה.</p>':'')+
      (open&&attempts()<state.max_design_attempts?'<button class="btn secondary" data-action="different">נסה עיצוב אחר</button>':'')+
      (open?'<button class="btn secondary" data-action="edit">עריכת הברכה</button>':'')+
      (currentSelected?'<button class="btn secondary" data-action="download">הורדת התמונה</button>':'')+
    '</div>':'')+
   (open&&current?'<p class="center small">ניסיונות עיצוב: '+attempts()+' מתוך '+state.max_design_attempts+'</p>':'')+
   (editing&&open&&current?'<section class="card-edit-panel"><h2>עריכת הברכה</h2><p class="small">השינוי יישמר בגרסה חדשה. הגרסאות הישנות והשליחה המקורית נשארות כפי שהיו.</p>'+
    '<div class="field"><label class="label" for="editName">שם</label><input class="input" id="editName" maxlength="100" value="'+esc(current.content_snapshot.name)+'"></div>'+
    '<div class="field"><label class="label" for="editMessage">ברכה</label><textarea class="textarea" id="editMessage" maxlength="2000">'+esc(current.content_snapshot.message)+'</textarea></div>'+
    '<div class="field"><label class="label" for="editEmoji">Emoji</label><select class="select" id="editEmoji">'+
      [...new Set([current.content_snapshot.emoji,...(state.reaction_options||[]).map(o=>o.emoji)])].map(emoji=>{
       const choice=(state.reaction_options||[]).find(o=>o.emoji===emoji);
       return '<option value="'+esc(emoji)+'" '+(emoji===current.content_snapshot.emoji?'selected':'')+'>'+esc(choice?(choice.emoji+' '+choice.label):(emoji||'ללא Emoji'))+'</option>';
      }).join('')+'</select></div>'+
    '<div class="field"><label class="label" for="editPhoto">תמונה</label><input class="input" type="file" id="editPhoto" accept="image/jpeg,image/png,image/webp" aria-describedby="editPhotoHelp"><p id="editPhotoHelp" class="small">אפשר להעלות תמונה חדשה במקום הקודמת (עד 15MB). המקור והגרסאות הקודמות יישמרו.</p></div>'+
    '<div class="row"><button class="btn" data-action="saveEdit">שמור שינוי</button><button class="btn secondary" data-action="cancelEdit">ביטול</button></div></section>':'')+
   gallery+
   '<div class="card-private-tools"><p class="small">זהו קישור פרטי לחזרה לברכה, עריכה ומחיקה בזמן האירוע. אין שחזור לקישור שאבד — אל תשלח אותו בשיתוף התמונה.</p>'+
   '<button class="btn secondary" data-action="copy">העתק קישור לחזרה לברכה</button>'+
   '<p id="personalLinkFeedback" class="msg ok" role="status" aria-live="polite" hidden style="flex-basis:100%;margin:6px 0 0;line-height:1.7"></p>'+
   (open?'<button class="btn danger" data-action="delete">מחק את הברכה</button>':
    '<button class="btn secondary" data-action="requestDelete">בקש מחיקה ממנהל האירוע</button>')+
   '</div></div></section>';
  const bind=(name,fn)=>{const node=app.querySelector('[data-action="'+name+'"]');if(node)node.onclick=fn};
  bind('different',()=>generate('alternative'));
  bind('share',()=>shareVersion(current));
  bind('download',async()=>{try{await downloadVersion(current)}catch(err){note(err.message)}});
  bind('edit',showEdit);
  bind('saveEdit',()=>{
   const replacement=document.getElementById('editPhoto')?.files?.[0]||null;
   if(replacement&&(replacement.size>15*1024*1024||!['image/jpeg','image/png','image/webp'].includes(replacement.type))){
    note('יש לבחור תמונת JPG, PNG או WebP עד 15MB.');return;
   }
   generate('edit',contentFromEditor(),replacement);
  });
  bind('cancelEdit',()=>{editing=false;mount()});
  bind('copy',copyLink);
  bind('delete',async()=>{
   if(!confirm('למחוק את הברכה? היא תוסר מהמערכת ולא תהיה זמינה עוד לצפייה או לשיתוף.'))return;
   try{await request('delete',{});await refresh();}catch(err){note(err.message)}
  });
  bind('requestDelete',async()=>{try{await request('request-deletion',{});note('בקשת המחיקה נשלחה למנהל האירוע.')}catch(err){note(err.message)}});
  app.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{
   if(busy)return;
   if(!canEdit()){viewedId=b.dataset.view;editing=false;message='';mount();return}
   await chooseVersion(b.dataset.view);
  });
 }
 app.className='wrap';app.innerHTML='<div class="loading">טוען את הברכה שלך…</div>';
 try{
  if(!await refresh())return;
  photo=await loadPhoto(state.photo_url);
  if(!state.versions.length&&canEdit()){await generate('initial',state.original);return}
  // Restore the submitted reaction label in cards created before labels were rendered.
  const displayed=visible();
  const label=(state.reaction_options||[]).find(o=>o.emoji===displayed?.content_snapshot?.emoji)?.label
   ||(state.original.emoji===displayed?.content_snapshot?.emoji?state.original.reaction_label:'');
  if(canEdit()&&displayed?.content_snapshot?.emoji&&!displayed.content_snapshot.reaction_label&&label){
   await generate('edit',{...displayed.content_snapshot,reaction_label:label});
   return;
  }
  mount();
 }catch(err){errorScreen(err.message)}
}
