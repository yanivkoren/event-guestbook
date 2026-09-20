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
  if(state.deleted){app.className='wrap';app.innerHTML='<section class="card"><div class="content"><h1>הברכה הוסרה</h1><p>הברכה אינה זמינה עוד דרך הקישור האישי.</p></div></section>';return false}
  const present=state.versions.some(v=>v.id===preferredId);
  viewedId=present?preferredId:state.selected_version_id||state.versions[state.versions.length-1]?.id||null;
  return true;
 }
 function alternativeDesign(){
  const allowed=state.templates||[],current=visible();
  const taken=state.versions.filter(v=>v.creation_kind!=='edit').map(v=>v.design_snapshot);
  if(!allowed.length)return null;
  const start=allowed.findIndex(t=>t.id===current?.design_snapshot?.template_id);
  const ordered=[...allowed.slice(Math.max(0,start+1)),...allowed.slice(0,Math.max(0,start+1))];
  for(const t of ordered){
   for(const palette of Object.keys(t.palettes)){
    for(const pattern_id of t.pattern_options){
     for(const frame of t.frame_options){
      for(const typography_id of t.typography_options){
       const candidate={...defaultDesign(t),palette,pattern_id,frame,typography_id,
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
 async function generate(kind,content){
  if(busy||!canEdit())return;
  if(kind!=='edit'&&attempts()>=state.max_design_attempts){note('נוצלו כל ניסיונות העיצוב לאירוע הזה.');return}
  const origin=visible();
  let target;
  if(kind==='initial'){
   const template=state.templates.find(t=>t.id===state.default_template_id)||state.templates[0];
   if(!template){errorScreen('לא הוגדר עיצוב לאירוע.');return}
   target={template,design:defaultDesign(template)};
  }else if(kind==='alternative')target=alternativeDesign();
  else{
   const template=state.templates.find(t=>t.id===origin?.design_snapshot?.template_id);
   if(template)target={template,design:{...origin.design_snapshot}};
  }
  if(!target){note('אין כרגע עיצוב נוסף בספרייה שהוגדרה לאירוע.');return}
  const text=content||origin?.content_snapshot||state.original;
  markBusy(true);
  if(!state.versions.length)app.innerHTML='<div class="loading">מכינים את כרטיס הברכה שלך…</div>';
  else note(kind==='alternative'?'מכינים לך עיצוב אחר…':'שומרים גרסה חדשה…');
  try{
   const pages=await renderCardPages({template:target.template,design:target.design,content:text,image:photo});
   const files=await cardFiles(pages),body=new FormData();
   body.set('configuration',JSON.stringify({
    creation_kind:kind,source_version_id:kind==='edit'?origin.id:null,
    content:text,design:target.design
   }));
   for(const file of files)body.append('page',file);
   const saved=await request('version',body);
   if(!await refresh(saved.version_id))return;
   editing=false;
   message=kind==='initial'?'הכרטיס מוכן! אהבת אותו? אשר אותו כדי שתוכל לשתף.':'הגרסה החדשה מוכנה. אם היא מוצאת חן בעיניך, בחר בה.';
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
  for(let i=0;i<v.page_urls.length;i++){
   const res=await fetch(v.page_urls[i]);
   if(!res.ok)throw Error('לא ניתן לטעון את התמונה לשיתוף');
   files.push(new File([await res.blob()],'greeting-'+(i+1)+'.png',{type:'image/png'}));
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
  try{await navigator.clipboard.writeText(location.href);note('הקישור האישי הועתק. שמור אותו לעצמך — אל תשתף אותו עם התמונה.')}
  catch{prompt('העתק ושמור את הקישור האישי:',location.href)}
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
   emoji:document.getElementById('editEmoji').value
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
      (open&&!currentSelected?'<button class="btn" data-action="choose">זה הכרטיס שלי ✓</button>':'')+
      (currentSelected?'<button class="btn" data-action="share">שתף כתמונה ↗</button>':'')+
      (approved&&!currentSelected?'<p class="small">כדי לשתף את הגרסה הזאת, בחר בה תחילה.</p>':'')+
      (open&&attempts()<state.max_design_attempts?'<button class="btn secondary" data-action="different">נסה עיצוב אחר</button>':'')+
      (open?'<button class="btn secondary" data-action="edit">עריכת הברכה</button>':'')+
      (currentSelected?'<button class="btn secondary" data-action="download">הורדת התמונה</button>':'')+
    '</div>':'')+
   (open&&current?'<p class="center small">ניסיונות עיצוב: '+attempts()+' מתוך '+state.max_design_attempts+'</p>':'')+
   (editing&&open&&current?'<section class="card-edit-panel"><h2>עריכת הברכה</h2><p class="small">השינוי יישמר בגרסה חדשה. הגרסאות הישנות והשליחה המקורית נשארות כפי שהיו.</p>'+
    '<div class="field"><label class="label" for="editName">שם</label><input class="input" id="editName" maxlength="100" value="'+esc(current.content_snapshot.name)+'"></div>'+
    '<div class="field"><label class="label" for="editMessage">ברכה</label><textarea class="textarea" id="editMessage" maxlength="2000">'+esc(current.content_snapshot.message)+'</textarea></div>'+
    '<div class="field"><label class="label" for="editEmoji">Emoji</label><input class="input" id="editEmoji" maxlength="30" value="'+esc(current.content_snapshot.emoji)+'"></div>'+
    '<div class="row"><button class="btn" data-action="saveEdit">שמור שינוי</button><button class="btn secondary" data-action="cancelEdit">ביטול</button></div></section>':'')+
   gallery+
   '<div class="card-private-tools"><p class="small">'+(approved?'הקישור האישי שלך מאפשר לחזור לכרטיס בכל עת.':'אפשר לשמור את הקישור כדי לחזור לכרטיס ולהשלים את הבחירה.')+' אין שחזור לקישור שאבד — אל תשלח אותו בשיתוף התמונה.</p>'+
   '<button class="btn secondary" data-action="copy">שמור קישור אישי</button>'+
   (open?'<button class="btn danger" data-action="delete">מחק את הברכה</button>':
    '<button class="btn secondary" data-action="requestDelete">בקש מחיקה ממנהל האירוע</button>')+
   '</div></div></section>';
  const bind=(name,fn)=>{const node=app.querySelector('[data-action="'+name+'"]');if(node)node.onclick=fn};
  bind('choose',()=>chooseVersion(current.id));
  bind('different',()=>generate('alternative'));
  bind('share',()=>shareVersion(current));
  bind('download',async()=>{try{await downloadVersion(current)}catch(err){note(err.message)}});
  bind('edit',showEdit);
  bind('saveEdit',()=>generate('edit',contentFromEditor()));
  bind('cancelEdit',()=>{editing=false;mount()});
  bind('copy',copyLink);
  bind('delete',async()=>{
   if(!confirm('למחוק את הברכה? לא תהיה אפשרות לגשת אליה דרך הקישור האישי.'))return;
   try{await request('delete',{});await refresh();}catch(err){note(err.message)}
  });
  bind('requestDelete',async()=>{try{await request('request-deletion',{});note('בקשת המחיקה נשלחה למנהל האירוע.')}catch(err){note(err.message)}});
  app.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{viewedId=b.dataset.view;editing=false;message='';mount()});
 }
 app.className='wrap';app.innerHTML='<div class="loading">טוען את הברכה שלך…</div>';
 try{
  if(!await refresh())return;
  photo=await loadPhoto(state.photo_url);
  if(!state.versions.length&&canEdit()){await generate('initial',state.original);return}
  mount();
 }catch(err){errorScreen(err.message)}
}
