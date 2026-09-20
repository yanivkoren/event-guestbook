import {defaultDesign,loadPhoto,renderCardPages,cardFiles,downloadPage} from '/guest-card-renderer.js';

// Public personal-card page. A high-entropy token is a bearer capability; never share its URL.
export async function renderGuestCardPage({token,app,api,go}){
 const endpoint=api+'?token='+encodeURIComponent(token);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const escapeUrl=x=>esc(x);
 const notice=x=>{const node=document.getElementById('personalNotice');if(node)node.textContent=x};
 async function request(action,method='GET',body){
  const response=await fetch(endpoint+'&action='+encodeURIComponent(action),{
   method,...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{}),
   ...(body&&!(body instanceof FormData)?{headers:{'content-type':'application/json'}}:{})
  });
  const data=await response.json().catch(()=>({error:'שגיאה לא צפויה'}));
  if(!response.ok)throw Error(data.error||'אירעה שגיאה');
  return data;
 }
 app.className='wrap';app.innerHTML='<div class="loading">טוען את כרטיס הברכה שלך...</div>';
 let data;
 try{data=await request('state')}catch(e){app.innerHTML='<div class="msg err">'+esc(e.message)+'</div>';return}
 if(data.deleted){app.innerHTML='<div class="msg">הברכה הוסרה מהמערכת.</div>';return}
 let photo=null;
 try{photo=await loadPhoto(data.photo_url)}catch(e){app.innerHTML='<div class="msg err">לא ניתן לפתוח את תמונת המקור. נסו לרענן את העמוד.</div>';return}
 let selected=data.versions.find(x=>x.id===data.selected_version_id);
 let draftContent={...(selected?.content_snapshot||data.original)};
 const available=data.templates||[];
 let template=available.find(t=>t.id===selected?.design_snapshot?.template_id)
  ||available.find(t=>t.id===data.default_template_id)||available[0];
 if(!template){app.innerHTML='<div class="msg err">לא הוגדר עיצוב לכרטיס.</div>';return}
 let design={...defaultDesign(template),...(selected?.design_snapshot||{})};
 let editableBaseVersionId=selected?.id||data.versions[data.versions.length-1]?.id||null;
 let previewPages=[],isBusy=false,revision=0;
 const active=!!data.can_edit;
 const attempts=()=>data.design_attempts_used;
 function selectOptions(items,selectedValue){return items.map(([k,label])=>'<option value="'+esc(k)+'" '+(k===selectedValue?'selected':'')+'>'+esc(label)+'</option>').join('')}
 function options(list,v){return selectOptions(list.map(x=>[x,x]),v)}
 function controlValue(id){return document.getElementById(id)?.value}
 function readForm(){
  if(!active)return;
  draftContent={title:controlValue('cardTitle')||'',name:controlValue('cardName')||'',message:controlValue('cardMessage')||'',emoji:controlValue('cardEmoji')||''};
  design.palette=controlValue('cardPalette');design.frame=controlValue('cardFrame');
  design.pattern_id=controlValue('cardPattern');design.typography_id=controlValue('cardFont');
  design.crop_strategy=controlValue('cardCrop');design.crop_x=Number(controlValue('cardX'));design.crop_y=Number(controlValue('cardY'));
 }
 function drawVersionGallery(){
  const gallery=document.getElementById('cardHistory');if(!gallery)return;
  gallery.innerHTML=data.versions.map(v=>'<article class="event-card"><div class="small">גרסה '+v.version_number+' · '+v.page_urls.length+' עמודים'+(v.id===data.selected_version_id?' · נבחרה':'')+'</div><img class="thumb" alt="עמוד ראשון של הכרטיס" src="'+escapeUrl(v.page_urls[0])+'"><div class="row" style="margin-top:10px"><button class="btn secondary" data-review="'+v.id+'">צפייה</button>'+(active?'<button class="btn" data-select="'+v.id+'" '+(v.id===data.selected_version_id?'disabled':'')+'>בחירת גרסה זו</button>':'')+'</div></article>').join('')||'<p class="small">עדיין לא נוצרו גרסאות.</p>';
  gallery.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>showStored(data.versions.find(v=>v.id===b.dataset.review)));
  gallery.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>selectVersion(b.dataset.select));
 }
 function showStored(v){
  if(!v)return;const area=document.getElementById('cardRendered');if(!area)return;
  area.innerHTML='<div class="small">גרסה '+v.version_number+' · '+v.page_urls.length+' עמודים</div>'+
   v.page_urls.map((url,i)=>'<img class="card-preview" alt="עמוד '+(i+1)+'" src="'+escapeUrl(url)+'">').join('');
  area.querySelectorAll('img').forEach((img,i)=>{img.style.cursor='pointer';img.title='פתח עמוד';img.onclick=()=>window.open(v.page_urls[i],'_blank','noopener')});
  const controls=document.getElementById('storedActions');
  controls.innerHTML='<button class="btn secondary" id="downloadStored">הורדת עמודים</button><button class="btn" id="shareStored">שיתוף כתמונה</button>';
  document.getElementById('downloadStored').onclick=async()=>{
   for(let i=0;i<v.page_urls.length;i++){const res=await fetch(v.page_urls[i]);const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='greeting-'+v.version_number+'-'+(i+1)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),6000)}
  };
  document.getElementById('shareStored').onclick=async()=>{
   try{
    const files=await Promise.all(v.page_urls.map(async(url,i)=>new File([await(await fetch(url)).blob()],'greeting-'+(i+1)+'.png',{type:'image/png'})));
    if(navigator.share&&navigator.canShare?.({files})){await navigator.share({files});return}
    notice('המכשיר לא תומך בשיתוף קובצי תמונה ישיר. הורידו את העמודים ושתפו אותם מהגלריה.');
   }catch(e){if(e.name!=='AbortError')notice('השיתוף לא הושלם. אפשר להוריד ולשתף מהגלריה.')}
  };
 }
 async function drawPreview(){
  if(!active)return;
  const number=++revision;const area=document.getElementById('cardRendered');if(!area)return;
  area.innerHTML='<div class="loading">מכין תצוגה מקדימה...</div>';
  try{
   const pages=await renderCardPages({template,design,content:draftContent,image:photo});
   if(number!==revision)return;previewPages=pages;
   area.innerHTML='';for(const c of pages){c.className='card-preview';area.appendChild(c)}
   notice(pages.length>1?'הברכה תוצג במלואה ב־'+pages.length+' עמודים.':'תצוגה מקדימה — עדיין לא נשמרה כגרסה.');
  }catch(e){if(number!==revision)return;previewPages=[];area.innerHTML='<div class="msg err">'+esc(e.message)+'</div>'}
 }
 async function saveVersion(kind){
  if(isBusy||!active)return;readForm();
  if(kind!=='edit'&&attempts()>=data.max_design_attempts){notice('נוצלה מכסת ניסיונות העיצוב');return}
  if(kind==='edit'&&!data.versions.length){notice('יש ליצור קודם כרטיס ראשון');return}
  isBusy=true;notice('שומר את הגרסה...');try{
   const pages=await renderCardPages({template,design,content:draftContent,image:photo});
   const files=await cardFiles(pages);const form=new FormData();
   form.set('configuration',JSON.stringify({creation_kind:kind,source_version_id:kind==='edit'?editableBaseVersionId:null,content:draftContent,design}));
   files.forEach(f=>form.append('page',f));
   await request('version','POST',form);
   data=await request('state');selected=data.versions.find(x=>x.id===data.selected_version_id);
   notice('הגרסה נשמרה. בחרו אותה כדי לאשר את הכרטיס.');
   const last=data.versions[data.versions.length-1];editableBaseVersionId=last.id;mount();showStored(last);
  }catch(e){notice(e.message)}finally{isBusy=false}
 }
 async function selectVersion(id){
  if(!active||isBusy)return;
  isBusy=true;try{await request('select','POST',{version_id:id});data=await request('state');selected=data.versions.find(v=>v.id===id);draftContent={...selected.content_snapshot};
   template=data.templates.find(t=>t.id===selected.design_snapshot.template_id)||template;design={...selected.design_snapshot};editableBaseVersionId=selected.id;
   mount();showStored(selected);notice('הגרסה אושרה ונבחרה. זה הקישור האישי שלך — שמרו אותו ואל תשתפו אותו.');
  }catch(e){notice(e.message)}finally{isBusy=false}
 }
 function nextDesign(){
  readForm();const index=available.findIndex(t=>t.id===template.id);
  if(available.length>1)template=available[(index+1)%available.length];
  else{const ps=Object.keys(template.palettes);design.palette=ps[(ps.indexOf(design.palette)+1)%ps.length]}
  design={...defaultDesign(template),crop_x:design.crop_x,crop_y:design.crop_y,
   ...(available.length===1?{palette:design.palette}:{})};
  mount();drawPreview();
 }
 function mount(){
  const closed=!active,link=location.href;
  app.innerHTML='<section class="card"><div class="content"><h1>כרטיס הברכה שלי ❤️</h1><p class="small">'+esc(data.event.title)+'</p>'+
   (selected?'<div class="msg ok">בחרת גרסה '+selected.version_number+'. הקישור האישי נשאר זהה גם לאחר שינוי הבחירה.</div>':
   '<div class="msg">הכרטיס עדיין לא אושר על ידך. צרו גרסה ובחרו את זו שאהבתם.</div>')+
   '<div class="msg"><strong>הקישור האישי שלך</strong><p class="small">הקישור מקנה גישה לניהול הברכה; לא שולחים אותו בשיתוף התמונה. שמרו אותו כעת — אין שחזור קישור שאבד.</p><button class="btn secondary" id="copyPersonal">העתקת קישור אישי</button></div>'+
   (closed?'<div class="msg">חלון העריכה של האירוע הסתיים. אפשר לצפות ולשתף את הכרטיס שנבחר, אך לא לערוך או למחוק אותו בעצמך.</div>':'')+
   '<div id="personalNotice" class="small" aria-live="polite"></div>'+
   '<div class="grid"><div><div id="cardRendered"></div><div class="row" id="storedActions"></div></div>'+
   (active?'<section class="card"><div class="content"><h2>עיצוב ותוכן</h2><p class="small">כל מה שנמסר יוצג בכרטיס. שינוי כאן יוצר גרסה חדשה — המקור והגרסאות הישנות נשמרים.</p>'+
   '<div class="field"><label class="label">עיצוב</label><select class="select" id="cardTemplate">'+selectOptions(available.map(t=>[t.id,t.name]),template.id)+'</select></div>'+
   '<div class="field"><label class="label">צבעים</label><select class="select" id="cardPalette">'+selectOptions(Object.entries(template.palettes).map(([k,v])=>[k,v.label||k]),design.palette)+'</select></div>'+
   '<div class="field"><label class="label">Pattern</label><select class="select" id="cardPattern">'+options(template.pattern_options,design.pattern_id)+'</select></div>'+
   '<div class="field"><label class="label">מסגרת</label><select class="select" id="cardFrame">'+options(template.frame_options,design.frame)+'</select></div>'+
   '<div class="field"><label class="label">גופן</label><select class="select" id="cardFont">'+options(template.typography_options,design.typography_id)+'</select></div>'+
   '<div class="field"><label class="label">חיתוך</label><select class="select" id="cardCrop">'+selectOptions(template.crop_strategies.map(x=>[x,({center:"מרכז",top:"למעלה",bottom:"למטה",left:"שמאל",right:"ימין"})[x]||x]),design.crop_strategy)+'</select></div>'+
   (photo?'<div class="field"><label class="label">מיקום אופקי</label><input id="cardX" type="range" min="0" max="1" step=".01" value="'+design.crop_x+'"></div><div class="field"><label class="label">מיקום אנכי</label><input id="cardY" type="range" min="0" max="1" step=".01" value="'+design.crop_y+'"></div>':'<input type="hidden" id="cardX" value=".5"><input type="hidden" id="cardY" value=".5">')+
   '<div class="field"><label class="label">כותרת</label><input id="cardTitle" class="input" maxlength="200" value="'+esc(draftContent.title)+'"></div>'+
   '<div class="field"><label class="label">שם המברך</label><input id="cardName" class="input" maxlength="100" value="'+esc(draftContent.name)+'"></div>'+
   '<div class="field"><label class="label">ברכה</label><textarea class="textarea" id="cardMessage" maxlength="2000">'+esc(draftContent.message)+'</textarea></div>'+
   '<div class="field"><label class="label">Emoji</label><input id="cardEmoji" class="input" maxlength="30" value="'+esc(draftContent.emoji)+'"></div>'+
   '<div class="small">ניסיונות עיצוב: '+attempts()+' מתוך '+data.max_design_attempts+'. תיקוני תוכן/Crop אינם צורכים ניסיון.</div>'+
   '<div class="row" style="margin-top:12px"><button class="btn secondary" id="previewCard">תצוגה מקדימה</button>'+
   '<button class="btn" id="saveCard">'+(data.versions.length?'שמירת תיקון כגרסה חדשה':'יצירת כרטיס ראשון')+'</button>'+
   '<button class="btn secondary" id="differentCard" '+(attempts()>=data.max_design_attempts?'disabled':'')+'>נסה עיצוב אחר</button></div>'+
   '<p class="help">שינוי עיצוב צורך ניסיון נוסף. תיקון מלל או חיתוך בלבד אינו צורך ניסיון. המלצות AI עדיין אינן מחוברות.</p>'+
   '</div></section>':'<div></div>')+'</div>'+
   '<h2>הגרסאות שלי</h2><div id="cardHistory" class="grid"></div>'+
   (active?'<div class="row" style="margin-top:24px"><button class="btn danger" id="deleteOwn">מחיקת הברכה</button></div>':
   '<div class="row" style="margin-top:24px"><button class="btn secondary" id="requestDelete">בקשת מחיקה ממנהל האירוע</button></div>')+
   '</div></section>';
  document.getElementById('copyPersonal').onclick=async()=>{try{await navigator.clipboard.writeText(link);notice('הקישור הועתק. שמרו אותו במקום בטוח.')}catch{prompt('העתיקו ושמרו את הקישור:',link)}};
  if(active){
   document.getElementById('cardTemplate').onchange=e=>{readForm();template=available.find(t=>t.id===e.target.value)||template;design={...defaultDesign(template),crop_x:design.crop_x,crop_y:design.crop_y};mount();drawPreview()};
   document.getElementById('previewCard').onclick=()=>{readForm();drawPreview()};
   document.getElementById('saveCard').onclick=()=>saveVersion(data.versions.length?'edit':'initial');
   document.getElementById('differentCard').onclick=()=>{if(attempts()>=data.max_design_attempts)return;nextDesign();saveVersion('alternative')};
   document.getElementById('deleteOwn').onclick=async()=>{if(!confirm('למחוק את הברכה? הגישה תוסר מיידית.'))return;try{await request('delete','POST',{});app.innerHTML='<div class="msg">הברכה הוסרה. עותקים שכבר שותפו מחוץ למערכת לא ניתנים למחיקה מכאן.</div>'}catch(e){notice(e.message)}};
  }else document.getElementById('requestDelete').onclick=async()=>{try{await request('request-deletion','POST',{});notice('בקשת המחיקה נשלחה למנהל האירוע.')}catch(e){notice(e.message)}};
  drawVersionGallery();
  if(selected)showStored(selected);
  else if(data.versions.length)showStored(data.versions[data.versions.length-1]);
  else if(active)drawPreview();
  else document.getElementById('cardRendered').innerHTML='<div class="msg">לא נבחר כרטיס לפני סיום חלון האירוע.</div>';
 }
 mount();
}
