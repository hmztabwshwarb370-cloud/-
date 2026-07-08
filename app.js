'use strict';

const APP_VERSION = 'local-mobile-1.0.1-responsive';
const DB_NAME = 'golden_star_local_mobile_db';
const DB_VERSION = 1;
const SESSION_KEY = 'golden_star_local_session';
const stores = ['players','payments','settings','users','logs'];
let db, state = { user:null, page:'dashboard', data:{players:[],payments:[],settings:{},users:[],logs:[]} };

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const today = () => new Date().toISOString().slice(0,10);
const now = () => new Date().toISOString();
const uid = p => `${p}-${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
function num(v){
  if(v === null || v === undefined || v === '') return 0;
  if(typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim();
  const ar='٠١٢٣٤٥٦٧٨٩', fa='۰۱۲۳۴۵۶۷۸۹';
  s = s.replace(/[٠-٩]/g, d => String(ar.indexOf(d))).replace(/[۰-۹]/g, d => String(fa.indexOf(d)));
  s = s.replace(/[,،\s]/g,'').replace(/[^0-9.\-]/g,'');
  const n = Number(s); return Number.isFinite(n) ? n : 0;
}
const money = n => `${num(n).toLocaleString('ar-SY')} ل.س`;
function displayDate(s){ if(!s) return ''; const d = parseDate(s); return Number.isNaN(d.getTime()) ? String(s) : `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`; }
function parseDate(s){ const p=String(s||today()).split('-').map(Number); if(p.length>=3 && p.every(x=>!Number.isNaN(x))) return new Date(p[0],p[1]-1,p[2]); return new Date(s||today()); }
function isoDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function calcExpire(dateStr,type){ const d=parseDate(dateStr); if(String(type).includes('سنوي')) d.setFullYear(d.getFullYear()+1); else d.setMonth(d.getMonth()+1); return isoDate(d); }
function defaultSettings(){ return {academyName:'أكاديمية النجم الذهبي',academyEn:'The Golden Star',description:'أكاديمية رياضية احترافية لتدريب الأبطال',address:'',defaultFee:'150000',busFee:'200000',kitFee:'100000',logo:''}; }
function defaultUsers(){ return [{id:'admin',username:'admin',password:'admin123',name:'المدير العام',role:'admin',permissions:'all',active:'1',createdAt:now()},{id:'finance',username:'finance',password:'finance123',name:'قسم المالية',role:'finance',permissions:'dashboard,finance,paymentsQuery',active:'1',createdAt:now()}]; }
function toast(msg,type='success'){ const host=$('toastHost'); const t=document.createElement('div'); t.className=`toast ${type}`; t.textContent=msg; host.appendChild(t); setTimeout(()=>{t.style.opacity='0'; setTimeout(()=>t.remove(),250)},3200); }

function openDb(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => { const d=e.target.result; stores.forEach(s=>{ if(!d.objectStoreNames.contains(s)) d.createObjectStore(s,{keyPath:'id'}); }); };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(store, mode='readonly'){ return db.transaction(store,mode).objectStore(store); }
function getAll(store){ return new Promise((res,rej)=>{ const r=tx(store).getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); }
function put(store,obj){ return new Promise((res,rej)=>{ const r=tx(store,'readwrite').put(obj); r.onsuccess=()=>res(obj); r.onerror=()=>rej(r.error); }); }
function del(store,id){ return new Promise((res,rej)=>{ const r=tx(store,'readwrite').delete(id); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }
function clearStore(store){ return new Promise((res,rej)=>{ const r=tx(store,'readwrite').clear(); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }
async function log(type,text){ await put('logs',{id:uid('LOG'),type,text,at:now()}); }
async function seedIfNeeded(){
  const settings = await getAll('settings');
  if(!settings.length){ for(const [key,value] of Object.entries(defaultSettings())) await put('settings',{id:key,key,value}); }
  const users = await getAll('users');
  if(!users.length){ for(const u of defaultUsers()) await put('users',u); }
}
async function loadAll(){
  const settingsRows = await getAll('settings');
  const settings = defaultSettings(); settingsRows.forEach(r=>settings[r.key||r.id]=r.value);
  state.data = {settings, players:await getAll('players'), payments:await getAll('payments'), users:await getAll('users'), logs:await getAll('logs')};
  state.data.players.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  state.data.payments.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  state.data.logs.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
}
async function init(){
  db = await openDb(); await seedIfNeeded(); await loadAll();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  const sess = JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
  if(sess){ state.user=sess; renderApp(); } else renderLogin();
  $('importJsonFile').addEventListener('change', importJsonFile);
}

function renderLogin(){
  $('app').innerHTML = `<div class="login"><div class="login-card"><div class="brand-center"><div class="brand-icon">🏆</div><h1>${esc(state.data.settings.academyName)}</h1><p>نسخة محلية سريعة تعمل على الموبايل بدون إنترنت</p></div><div class="field"><label>اسم المستخدم</label><input id="loginUser" value="admin"></div><div class="field"><label>كلمة المرور</label><input id="loginPass" type="password" value="admin123"></div><button class="btn btn-gold" style="width:100%" onclick="login()">دخول</button><div id="loginError" class="error"></div></div></div>`;
  $('loginPass').addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });
}
function login(){
  const u=$('loginUser').value.trim(), p=$('loginPass').value;
  const found = state.data.users.find(x=>String(x.username)===u && String(x.password)===p && String(x.active||'1')!=='0');
  if(!found){ $('loginError').textContent='بيانات الدخول غير صحيحة'; return; }
  state.user = {id:found.id,username:found.username,name:found.name||found.username,role:found.role,permissions:found.permissions||''};
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.user)); renderApp();
}
function logout(){ localStorage.removeItem(SESSION_KEY); state.user=null; renderLogin(); }
const menu = [
  ['dashboard','الرئيسية','📊',['admin','finance']], ['players','شؤون اللاعبين','🏃',['admin']], ['finance','المالية والمحاسبة','💳',['admin','finance']], ['paymentsQuery','الاستعلام عن الدفعات','🔎',['admin','finance']], ['users','المستخدمون','👥',['admin']], ['settings','إعدادات المؤسسة','⚙️',['admin']], ['backup','النسخ والبيانات','💾',['admin']]
];
function allowed(item){ return item[3].includes(state.user.role) || state.user.permissions==='all'; }

function toggleMobileMenu(){
  const sb = $('sidebar');
  const bd = $('drawerBackdrop');
  if(!sb) return;
  const open = !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  if(bd) bd.classList.toggle('show', open);
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeMobileMenu(){
  const sb = $('sidebar');
  const bd = $('drawerBackdrop');
  if(sb) sb.classList.remove('open');
  if(bd) bd.classList.remove('show');
  document.body.style.overflow = '';
}

function renderApp(){
  const nav = menu.filter(allowed).map(m=>`<button class="${state.page===m[0]?'active':''}" onclick="go('${m[0]}')"><span>${m[2]}</span>${m[1]}</button>`).join('');
  $('app').innerHTML = `<div id="drawerBackdrop" class="drawer-backdrop" onclick="closeMobileMenu()"></div><div class="app-shell"><aside id="sidebar" class="sidebar"><div class="side-brand"><div class="logo">🏆</div><div><h2>${esc(state.data.settings.academyName.replace('أكاديمية ',''))}</h2><small>${esc(state.data.settings.academyEn||'')}</small></div></div><nav class="menu">${nav}</nav><div class="side-actions"><button class="side-action" onclick="exportBackup()">💾 نسخ احتياطي</button><button class="side-action" onclick="$('importJsonFile').click()">📥 استيراد نسخة</button><button class="side-action danger" onclick="logout()">⏻ تسجيل الخروج</button></div></aside><main class="main"><div class="topbar"><div><button class="btn btn-dark mobile-toggle" onclick="toggleMobileMenu()">☰</button><h1 id="pageTitle"></h1><p>${esc(state.data.settings.description)}</p></div><div class="user-pill">${esc(state.user.name)}</div></div><div id="content"></div></main></div>`;
  renderPage();
}
function go(page){ closeMobileMenu(); state.page=page; renderApp(); }
function renderPage(){ const item=menu.find(x=>x[0]===state.page); $('pageTitle').textContent=item?item[1]:'النظام'; ({dashboard,players,finance,paymentsQuery,users,settings,backup}[state.page]||dashboard)(); }
function table(head, rows, empty='لا توجد بيانات'){
  return `<div class="table-wrap"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${head.length}" class="empty">${empty}</td></tr>`}</tbody></table></div>`;
}
function totalRevenue(){ return state.data.payments.reduce((s,p)=>s + totalPaid(p),0); }
function getPlayerPayments(id){ return state.data.payments.filter(p=>String(p.playerId)===String(id)); }
function hasBus(p){ return p.busSubscribed==='1' || p.busIncluded==='1' || num(p.busAmount)>0 || p.paymentTarget==='bus'; }
function hasKit(p){ return p.kitSubscribed==='1' || p.kitIncluded==='1' || num(p.kitAmount)>0 || p.paymentTarget==='kit'; }
function mainPaid(p){ return num(p.mainAmount); }
function busPaid(p){ return num(p.busAmount); }
function kitPaid(p){ return num(p.kitAmount); }
function totalPaid(p){ const d=mainPaid(p)+busPaid(p)+kitPaid(p); return d || num(p.amount); }
function playerFinance(player){
  const pays=getPlayerPayments(player.id); const df=num(state.data.settings.defaultFee), bf=num(state.data.settings.busFee), kf=num(state.data.settings.kitFee);
  const busSub=pays.some(hasBus), kitSub=pays.some(hasKit);
  const paidMain=pays.reduce((s,p)=>s+mainPaid(p),0), paidBus=pays.reduce((s,p)=>s+busPaid(p),0), paidKit=pays.reduce((s,p)=>s+kitPaid(p),0);
  const dueMain=df, dueBus=busSub?bf:0, dueKit=kitSub?kf:0;
  const remMain=Math.max(dueMain-paidMain,0), remBus=Math.max(dueBus-paidBus,0), remKit=Math.max(dueKit-paidKit,0);
  return {paidMain,paidBus,paidKit,totalPaid:paidMain+paidBus+paidKit,dueMain,dueBus,dueKit,remMain,remBus,remKit,totalRemaining:remMain+remBus+remKit,busSub,kitSub};
}
function outstandingRows(){ return state.data.players.map(player=>({player, f:playerFinance(player)})).filter(x=>x.f.totalRemaining>0); }
function dashboard(){
  const out = outstandingRows(); const outTotal=out.reduce((s,x)=>s+x.f.totalRemaining,0); const logs=state.data.logs.slice(0,12);
  $('content').innerHTML = `<div class="stats-grid"><div class="stat-card blue"><div><span>إجمالي اللاعبين</span><strong>${state.data.players.length}</strong></div><div class="stat-icon">🏃</div></div><div class="stat-card gold"><div><span>إجمالي الإيرادات</span><strong>${money(totalRevenue())}</strong></div><div class="stat-icon">💳</div></div><div class="stat-card red" onclick="showOutstanding()" style="cursor:pointer"><div><span>المبالغ المتبقية</span><strong>${money(outTotal)}</strong></div><div class="stat-icon">💰</div></div></div><div class="panel"><div class="panel-head"><h3>آخر الحركات</h3><button class="btn btn-gold" onclick="exportExcel()">تصدير Excel</button></div>${table(['النوع','الحركة','الوقت'], logs.map(l=>[esc(l.type),esc(l.text),displayDate(l.at?.slice(0,10))+' '+esc((l.at||'').slice(11,16))]), 'لا توجد حركات بعد')}</div>`;
}
function showOutstanding(){ const rows=outstandingRows(); openModal(`<h3>تفاصيل المبالغ المتبقية</h3>${table(['اللاعب','المدفوع','الإضافات','المتبقي','تذكير'], rows.map(({player,f})=>[esc(player.name),money(f.totalPaid),`${f.busSub?'باص ':''}${f.kitSub?'طقم':''}`||'لا يوجد',`<b>${money(f.totalRemaining)}</b><br><small>اشتراك: ${money(f.remMain)} / باص: ${money(f.remBus)} / طقم: ${money(f.remKit)}</small>`,`<button class="btn btn-sm btn-gold" onclick="sendReminder('${player.id}')">واتساب</button>`]), 'لا توجد مبالغ متبقية')}`); }

function players(){
  $('content').innerHTML = `<div class="panel"><div class="panel-head"><h3>إضافة لاعب</h3><span class="badge gold">حفظ محلي فوري</span></div><form id="playerForm" class="form-grid"><div class="field"><label>اسم اللاعب</label><input id="pName" required></div><div class="field"><label>العمر</label><input id="pAge" type="number"></div><div class="field"><label>الفئة</label><input id="pCategory"></div><div class="field"><label>رقم ولي الأمر</label><input id="pPhone"></div><div class="field"><label>تاريخ التسجيل</label><input id="pDate" type="date" value="${today()}"></div><div class="field"><label>صورة اللاعب</label><input id="pPhoto" type="file" accept="image/*"></div><button class="btn btn-gold span-2">حفظ اللاعب</button></form></div><div class="panel"><div class="panel-head"><h3>سجل اللاعبين</h3><input id="playerSearch" class="mini-input" placeholder="بحث..."></div><div id="playersTable"></div></div>`;
  $('playerForm').onsubmit=savePlayer; $('playerSearch').oninput=renderPlayersTable; renderPlayersTable();
}
async function fileData(file){ return new Promise(res=>{ if(!file) return res(''); const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); }); }
async function savePlayer(e){ e.preventDefault(); const p={id:uid('PLAYER'),name:$('pName').value.trim(),age:$('pAge').value,category:$('pCategory').value,phone:$('pPhone').value.trim(),registerDate:$('pDate').value||today(),photo:await fileData($('pPhoto').files[0]),createdAt:now()}; if(!p.name) return toast('اسم اللاعب مطلوب','error'); await put('players',p); await log('player','تم إضافة اللاعب '+p.name); await loadAll(); toast('تم حفظ اللاعب','success'); players(); }
function renderPlayersTable(){ const q=($('playerSearch')?.value||'').trim(); const list=state.data.players.filter(p=>!q||p.name.includes(q)||String(p.phone).includes(q)||String(p.category).includes(q)); $('playersTable').innerHTML=table(['الصورة','الاسم','العمر','الفئة','ولي الأمر','تاريخ التسجيل','إجراءات'], list.map(p=>[p.photo?`<img class="player-photo" src="${p.photo}">`:'—',esc(p.name),esc(p.age),esc(p.category),esc(p.phone),displayDate(p.registerDate),`<div class="actions"><button class="btn btn-sm btn-gold" onclick="showPlayerCard('${p.id}')">بطاقة</button><button class="btn btn-sm btn-danger" onclick="deletePlayer('${p.id}')">حذف</button></div>`])); }
async function deletePlayer(id){ const p=state.data.players.find(x=>x.id===id); if(!p) return; if(!confirm(`حذف اللاعب ${p.name}؟\nسيتم حذف كل دفعاته نهائياً.`)) return; const pays=getPlayerPayments(id); await del('players',id); for(const pay of pays) await del('payments',pay.id); await log('player',`تم حذف اللاعب ${p.name} مع ${pays.length} دفعة`); await loadAll(); toast('تم حذف اللاعب ودفعاته','success'); renderPage(); }
function showPlayerCard(id){ const p=state.data.players.find(x=>x.id===id); openModal(`<div class="print-area"><div class="card-print"><h3>${esc(state.data.settings.academyName)}</h3>${p.photo?`<img class="photo" src="${p.photo}">`:''}<h2>${esc(p.name)}</h2><p>الفئة: ${esc(p.category||'-')}</p><p>العمر: ${esc(p.age||'-')}</p><p>ID: ${esc(p.id)}</p></div></div><br><button class="btn btn-gold no-print" onclick="window.print()">طباعة</button>`); }

function finance(){
  $('content').innerHTML = `<div class="panel"><div class="panel-head"><h3>تسجيل دفعة مالية</h3><span class="badge gold">اسم اللاعب ← نوع العملية ← تفاصيل الدفعة</span></div><form id="payForm" class="form-grid"><div class="field span-2 payer-search"><label>اسم اللاعب</label><input id="payPlayer" autocomplete="off" placeholder="ابدأ بكتابة اسم اللاعب..."><div id="playerResults" class="search-results"></div></div><input id="payPlayerId" type="hidden"><div class="field"><label>نوع العملية</label><select id="payMode"><option value="new">اشتراك جديد</option><option value="installment">إكمال أقساط</option></select></div><div class="field"><label>نوع الاشتراك</label><select id="payType"><option>شهري</option><option>سنوي</option></select></div><div class="field"><label>تاريخ الدفع</label><input id="payDate" type="date" value="${today()}"></div><div id="targetBox" class="field" style="display:none"><label>القسط المطلوب إكماله</label><select id="payTarget"><option value="main">قسط الاشتراك</option><option value="bus">قسط الباص</option><option value="kit">قسط الطقم</option></select></div><div id="newBox" class="span-2 form-grid"><div class="field"><label>المدفوع من رسم الاشتراك</label><input id="mainAmount" type="number" value="${num(state.data.settings.defaultFee)}"></div><div class="field"><label><input id="busSub" type="checkbox"> مشترك بالباص (${money(state.data.settings.busFee)})</label><input id="busAmount" type="number" value="0" placeholder="المدفوع للباص"></div><div class="field"><label><input id="kitSub" type="checkbox"> طقم رياضي (${money(state.data.settings.kitFee)})</label><input id="kitAmount" type="number" value="0" placeholder="المدفوع للطقم"></div></div><div id="installBox" class="field span-2" style="display:none"><label>قيمة الدفعة</label><input id="installAmount" type="number" value="0"></div><div class="span-2 summary-box" id="paySummary">—</div><button class="btn btn-gold">حفظ الدفعة</button></form></div><div class="panel"><div class="panel-head"><h3>سجل الدفعات</h3></div>${paymentsTable()}</div>`;
  bindPlayerSearch(); ['payMode','payTarget','mainAmount','busAmount','kitAmount','installAmount','busSub','kitSub'].forEach(id=>{ const el=$(id); if(el){el.oninput=updateSummary; el.onchange=updateSummary;} }); $('payForm').onsubmit=savePayment; updateSummary();
}
function bindPlayerSearch(){ const input=$('payPlayer'), box=$('playerResults'); input.oninput=()=>{ const q=input.value.trim(); const list=state.data.players.filter(p=>q && p.name.includes(q)).slice(0,8); box.style.display=list.length?'block':'none'; box.innerHTML=list.map(p=>`<button type="button" onclick="selectPayPlayer('${p.id}')">${esc(p.name)} - ${esc(p.category||'')}</button>`).join(''); }; }
function selectPayPlayer(id){ const p=state.data.players.find(x=>x.id===id); if(!p) return; $('payPlayerId').value=p.id; $('payPlayer').value=p.name; $('playerResults').style.display='none'; updateSummary(); }
function selectedPayPlayer(){ const id=$('payPlayerId')?.value; return state.data.players.find(p=>p.id===id) || state.data.players.find(p=>p.name===$('payPlayer')?.value.trim()); }
function updateSummary(){ const mode=$('payMode')?.value||'new'; $('newBox').style.display=mode==='new'?'contents':'none'; $('targetBox').style.display=mode==='installment'?'block':'none'; $('installBox').style.display=mode==='installment'?'block':'none'; if(mode==='installment'){ const target=$('payTarget').value, amount=num($('installAmount').value); const label=target==='bus'?'قسط الباص':target==='kit'?'قسط الطقم':'قسط الاشتراك'; const due=target==='bus'?num(state.data.settings.busFee):target==='kit'?num(state.data.settings.kitFee):num(state.data.settings.defaultFee); $('paySummary').textContent=`${label}: قيمة البند ${money(due)} | المدفوع الآن ${money(amount)}`; return; } const main=num($('mainAmount').value), bus=$('busSub').checked?num($('busAmount').value):0, kit=$('kitSub').checked?num($('kitAmount').value):0; const due=num(state.data.settings.defaultFee)+($('busSub').checked?num(state.data.settings.busFee):0)+($('kitSub').checked?num(state.data.settings.kitFee):0); $('paySummary').textContent=`الإجمالي المطلوب: ${money(due)} | المدفوع الآن: ${money(main+bus+kit)} | المتبقي المتوقع: ${money(Math.max(due-main-bus-kit,0))}`; }
async function savePayment(e){ e.preventDefault(); const player=selectedPayPlayer(); if(!player) return toast('اختر اللاعب من القائمة','error'); const mode=$('payMode').value, target=$('payTarget').value, type=$('payType').value, date=$('payDate').value||today(); let main=0,bus=0,kit=0,busSub=false,kitSub=false,label='اشتراك جديد'; if(mode==='installment'){ const amount=num($('installAmount').value); if(!amount) return toast('أدخل قيمة الدفعة','error'); if(target==='bus'){ bus=amount; busSub=true; label='إكمال أقساط - قسط الباص'; } else if(target==='kit'){ kit=amount; kitSub=true; label='إكمال أقساط - قسط الطقم'; } else { main=amount; label='إكمال أقساط - قسط الاشتراك'; } } else { main=num($('mainAmount').value); busSub=$('busSub').checked; kitSub=$('kitSub').checked; bus=busSub?num($('busAmount').value):0; kit=kitSub?num($('kitAmount').value):0; } const total=main+bus+kit; if(!total) return toast('أدخل مبلغاً واحداً على الأقل','error'); const pay={id:uid('PAY'),playerId:player.id,playerName:player.name,paymentMode:mode,paymentTarget:mode==='installment'?target:'new',operationLabel:label,type,paymentDate:date,expireDate:calcExpire(date,type),mainAmount:main,busAmount:bus,kitAmount:kit,busSubscribed:busSub?'1':'',kitSubscribed:kitSub?'1':'',amount:total,createdAt:now()}; await put('payments',pay); await log('payment',`تم تسجيل ${money(total)} للاعب ${player.name}`); await loadAll(); toast('تم حفظ الدفعة فوراً','success'); finance(); }
function paymentsTable(){ return table(['اللاعب','نوع العملية','الاشتراك','الباص','الطقم','الإجمالي','التاريخ','إيصال'], state.data.payments.map(p=>[esc(p.playerName),esc(p.operationLabel),money(mainPaid(p)),busPaid(p)?money(busPaid(p)):'-',kitPaid(p)?money(kitPaid(p)):'-',money(totalPaid(p)),displayDate(p.paymentDate),`<button class="btn btn-sm btn-gold" onclick="sendReceipt('${p.id}')">واتساب</button>`]), 'لا توجد دفعات'); }
function buildReceipt(p){ return `إيصال دفع من ${state.data.settings.academyName}\n\nاللاعب: ${p.playerName}\nنوع العملية: ${p.operationLabel}\nالاشتراك المدفوع: ${money(mainPaid(p))}\nالباص: ${busPaid(p)?money(busPaid(p)):'غير مشترك'}\nالطقم: ${kitPaid(p)?money(kitPaid(p)):'غير مشترك'}\nالإجمالي المدفوع: ${money(totalPaid(p))}\nتاريخ الدفع: ${displayDate(p.paymentDate)}\nتاريخ الانتهاء: ${displayDate(p.expireDate)}\n\nشكراً لكم 🌟`; }
function normPhone(phone){ let p=String(phone||'').replace(/\D/g,''); if(p.startsWith('00')) p=p.slice(2); if(p.startsWith('0')) p='963'+p.slice(1); return p; }
function sendReceipt(id){ const p=state.data.payments.find(x=>x.id===id); const player=state.data.players.find(x=>x.id===p.playerId)||{}; const phone=normPhone(player.phone); if(!phone) return toast('رقم ولي الأمر غير موجود','error'); window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildReceipt(p))}`,'_blank'); }
function sendReminder(id){ const player=state.data.players.find(x=>x.id===id); const f=playerFinance(player); const phone=normPhone(player.phone); if(!phone) return toast('رقم ولي الأمر غير موجود','error'); const msg=`السلام عليكم\nنذكركم بوجود مبلغ متبقي على اللاعب: ${player.name}\nالمتبقي الإجمالي: ${money(f.totalRemaining)}\nتفصيل: اشتراك ${money(f.remMain)} / باص ${money(f.remBus)} / طقم ${money(f.remKit)}\n${state.data.settings.academyName}`; window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank'); }

function paymentsQuery(){ const qRows=state.data.players.map(p=>({p,f:playerFinance(p)})); $('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>الاستعلام عن الدفعات</h3><input id="qSearch" class="mini-input" placeholder="بحث باسم اللاعب"></div><div id="queryTable"></div></div>`; $('qSearch').oninput=renderQuery; renderQuery(); }
function renderQuery(){ const q=($('qSearch')?.value||'').trim(); const rows=state.data.players.map(p=>({p,f:playerFinance(p)})).filter(x=>!q||x.p.name.includes(q)); $('queryTable').innerHTML=table(['اللاعب','مدفوع الاشتراك','متبقي الاشتراك','مدفوع الباص','متبقي الباص','مدفوع الطقم','متبقي الطقم','الإجمالي المتبقي'], rows.map(({p,f})=>[esc(p.name),money(f.paidMain),money(f.remMain),f.busSub?money(f.paidBus):'غير مشترك',f.busSub?money(f.remBus):'-',f.kitSub?money(f.paidKit):'غير مشترك',f.kitSub?money(f.remKit):'-',`<b>${money(f.totalRemaining)}</b>`])); }

function users(){ $('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>إضافة مستخدم</h3></div><form id="userForm" class="form-grid"><div class="field"><label>اسم المستخدم</label><input id="uName"></div><div class="field"><label>كلمة المرور</label><input id="uPass"></div><div class="field"><label>الاسم الظاهر</label><input id="uDisplay"></div><div class="field"><label>الدور</label><select id="uRole"><option value="finance">مالية</option><option value="admin">مدير</option></select></div><button class="btn btn-gold span-2">حفظ المستخدم</button></form></div><div class="panel">${table(['المستخدم','الاسم','الدور','حذف'],state.data.users.map(u=>[esc(u.username),esc(u.name),esc(u.role),u.username==='admin'?'—':`<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">حذف</button>`]))}</div>`; $('userForm').onsubmit=saveUser; }
async function saveUser(e){ e.preventDefault(); const u={id:uid('USER'),username:$('uName').value.trim(),password:$('uPass').value,name:$('uDisplay').value||$('uName').value,role:$('uRole').value,permissions:$('uRole').value==='admin'?'all':'dashboard,finance,paymentsQuery',active:'1',createdAt:now()}; if(!u.username||!u.password) return toast('أدخل المستخدم وكلمة المرور','error'); await put('users',u); await log('user','تم إضافة مستخدم '+u.username); await loadAll(); users(); }
async function deleteUser(id){ const u=state.data.users.find(x=>x.id===id); if(!u||u.username==='admin') return; if(!confirm('حذف المستخدم؟')) return; await del('users',id); await loadAll(); users(); }
function settings(){ const s=state.data.settings; $('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>إعدادات المؤسسة</h3></div><form id="settingsForm" class="form-grid"><div class="field"><label>اسم الأكاديمية</label><input id="setAcademyName" value="${esc(s.academyName)}"></div><div class="field"><label>الاسم الإنكليزي</label><input id="setAcademyEn" value="${esc(s.academyEn)}"></div><div class="field span-2"><label>الوصف</label><input id="setDescription" value="${esc(s.description)}"></div><div class="field span-2"><label>العنوان</label><input id="setAddress" value="${esc(s.address)}"></div><div class="field"><label>رسم الاشتراك</label><input id="setDefaultFee" type="number" value="${num(s.defaultFee)}"></div><div class="field"><label>رسم الباص</label><input id="setBusFee" type="number" value="${num(s.busFee)}"></div><div class="field"><label>سعر الطقم</label><input id="setKitFee" type="number" value="${num(s.kitFee)}"></div><div class="field"><label>الشعار</label><input id="setLogo" type="file" accept="image/*"></div>${s.logo?`<img class="logo-preview" src="${s.logo}">`:''}<button class="btn btn-gold span-2">حفظ الإعدادات</button></form></div>`; $('settingsForm').onsubmit=saveSettings; }
async function saveSettings(e){ e.preventDefault(); const logo=await fileData($('setLogo').files[0]); const data={academyName:$('setAcademyName').value,academyEn:$('setAcademyEn').value,description:$('setDescription').value,address:$('setAddress').value,defaultFee:$('setDefaultFee').value,busFee:$('setBusFee').value,kitFee:$('setKitFee').value}; if(logo) data.logo=logo; for(const [key,value] of Object.entries(data)) await put('settings',{id:key,key,value}); await log('settings','تم تحديث إعدادات المؤسسة'); await loadAll(); toast('تم حفظ الإعدادات','success'); renderApp(); }
function backup(){ $('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>النسخ والبيانات</h3></div><div class="grid"><div class="install-help"><b>هذه النسخة محلية:</b><br>كل البيانات محفوظة داخل متصفح الموبايل نفسه. لذلك اعمل نسخة احتياطية يومياً أو بعد كل دوام.</div><div class="toolbar"><button class="btn btn-gold" onclick="exportBackup()">تصدير نسخة احتياطية JSON</button><button class="btn btn-blue" onclick="exportExcel()">تصدير Excel</button><button class="btn btn-light" onclick="$('importJsonFile').click()">استيراد نسخة احتياطية</button></div><div class="panel danger-zone"><h3>تنبيه</h3><p>لا تمسح بيانات المتصفح لهذا الموقع قبل تصدير نسخة احتياطية.</p></div></div></div>`; }
function download(name, content, type){ const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function backupData(){ return {version:APP_VERSION,exportedAt:now(),settings:state.data.settings,players:state.data.players,payments:state.data.payments,users:state.data.users,logs:state.data.logs}; }
function exportBackup(){ download(`golden-star-backup-${today()}.json`, JSON.stringify(backupData(),null,2), 'application/json;charset=utf-8'); }
function sheetHtml(title, headers, rows){ return `<h2>${title}</h2><table border="1"><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map(c=>`<td>${String(c??'').replace(/[<>&]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))}</td>`).join('')}</tr>`).join('')}</table>`; }
function exportExcel(){ const html=`<html dir="rtl"><meta charset="utf-8"><body>${sheetHtml('اللاعبون',['id','الاسم','العمر','الفئة','الهاتف','تاريخ التسجيل'],state.data.players.map(p=>[p.id,p.name,p.age,p.category,p.phone,p.registerDate]))}${sheetHtml('الدفعات',['id','اللاعب','نوع العملية','اشتراك','باص','طقم','الإجمالي','تاريخ الدفع','تاريخ الانتهاء'],state.data.payments.map(p=>[p.id,p.playerName,p.operationLabel,mainPaid(p),busPaid(p),kitPaid(p),totalPaid(p),p.paymentDate,p.expireDate]))}${sheetHtml('الاستعلام',['اللاعب','مدفوع اشتراك','متبقي اشتراك','مدفوع باص','متبقي باص','مدفوع طقم','متبقي طقم','المتبقي الإجمالي'],state.data.players.map(p=>{const f=playerFinance(p);return[p.name,f.paidMain,f.remMain,f.paidBus,f.remBus,f.paidKit,f.remKit,f.totalRemaining]}))}</body></html>`; download(`golden-star-data-${today()}.xls`, html, 'application/vnd.ms-excel;charset=utf-8'); }
async function importJsonFile(e){ const file=e.target.files[0]; if(!file) return; const txt=await file.text(); let data; try{data=JSON.parse(txt)}catch(err){return toast('ملف غير صالح','error')} if(!confirm('سيتم استبدال البيانات الحالية بالنسخة المستوردة. هل أنت متأكد؟')) return; for(const s of stores) await clearStore(s); for(const [key,value] of Object.entries(data.settings||defaultSettings())) await put('settings',{id:key,key,value}); for(const p of data.players||[]) await put('players',p); for(const p of data.payments||[]) await put('payments',p); for(const u of data.users||defaultUsers()) await put('users',u); for(const l of data.logs||[]) await put('logs',l); await loadAll(); toast('تم استيراد النسخة','success'); renderApp(); e.target.value=''; }
function openModal(html){ let m=document.createElement('div'); m.className='modal show'; m.innerHTML=`<div class="modal-box"><button class="modal-close" onclick="this.closest('.modal').remove()">×</button>${html}</div>`; m.addEventListener('click',e=>{ if(e.target===m) m.remove(); }); document.body.appendChild(m); }

init().catch(err=>{ console.error(err); document.body.innerHTML='<pre style="direction:ltr;padding:20px">'+err.message+'</pre>'; });
