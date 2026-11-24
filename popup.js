const status = document.getElementById('status');
const KEY = 'mapsCollectorV1';
let timer, lastCount = 0, lastActive = false;
function render(note='') { status.textContent = `${lastActive?'Collecting':'Paused'} · ${lastCount} listings collected${note?' · '+note:''}`; }
function handleError(error) { if (!chrome.runtime?.id || /context invalidated/i.test(String(error))) { clearInterval(timer); render('Reopen widget after extension reload'); } else render('Extension unavailable; retry'); }
async function send(type) {
  try {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab?.url || !/^https:\/\/www\.google\.(com|ca)\/maps/.test(tab.url)) {await refresh(); status.textContent+=' · Open Google Maps to control scraping.';return null;}
  return await chrome.tabs.sendMessage(tab.id,{type});
  } catch(error) { handleError(error); return null; }
}
async function refresh(){ try { const data=(await chrome.storage.local.get(KEY))[KEY]; lastCount=data?.entries?.length || 0; lastActive=!!data?.active; render(); } catch(error) { handleError(error); } }
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes[KEY]) refresh();});
document.getElementById('start').onclick=async()=>{await send('start');refresh()};
document.getElementById('stop').onclick=async()=>{await send('stop');refresh()};
document.getElementById('reset').onclick=async()=>{if(!confirm('Discard all currently collected listings and stop scraping?'))return; const result=await send('reset'); if(result?.ok) await refresh(); else if(result) render('Could not clear listings. Try again.');};
document.getElementById('export').onclick=async()=>{ try {
  const {mapsCollectorV1:data} = await chrome.storage.local.get(KEY);
  if (!data?.entries?.length){render('No listings to export');return;}
  const fields=['name','phone','website','address','category','rating','reviews','mapsUrl','keyword','collectedAt','visibleText'];
  const csv=[fields.join(','),...data.entries.map(row=>fields.map(field=>{let value=String(row[field]??'');if(/^[\s]*[=+@-]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"';}).join(','))].join('\r\n');
  const blob=new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const filename='maps-listings-'+new Date().toISOString().slice(0,10)+'.csv';
  try { await chrome.downloads.download({url,filename,saveAs:true}); } finally { setTimeout(()=>URL.revokeObjectURL(url),60000); }
} catch(error) { handleError(error); } };
render(); timer=setInterval(refresh,1500); refresh(); window.addEventListener('pagehide',()=>clearInterval(timer));
