const status = document.getElementById('status');
const KEY = 'mapsCollectorV1';
async function send(type) {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab?.url || !/^https:\/\/www\.google\.(com|ca)\/maps/.test(tab.url)) {await refresh(); status.textContent+=' · Open Google Maps to control scraping.';return null;}
  try { return await chrome.tabs.sendMessage(tab.id,{type}); }
  catch { await refresh(); status.textContent+=' · Refresh Google Maps to control scraping.';return null; }
}
async function refresh(){ const data=(await chrome.storage.local.get(KEY))[KEY]; status.textContent=`${data?.active?'Collecting':'Paused'} · ${data?.entries?.length || 0} listings collected`; }
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes[KEY]) refresh();});
document.getElementById('start').onclick=async()=>{await send('start');refresh()};
document.getElementById('stop').onclick=async()=>{await send('stop');refresh()};
document.getElementById('reset').onclick=async()=>{if(!confirm('Discard all currently collected listings and stop scraping?'))return; const result=await send('reset'); if(result?.ok) await refresh(); else if(result) status.textContent='Could not clear listings. Try again.';};
document.getElementById('export').onclick=async()=>{
  const {mapsCollectorV1:data} = await chrome.storage.local.get(KEY);
  if (!data?.entries?.length){status.textContent='No listings collected yet.';return;}
  const fields=['name','phone','website','address','category','rating','reviews','mapsUrl','keyword','collectedAt','visibleText'];
  const csv=[fields.join(','),...data.entries.map(row=>fields.map(field=>{let value=String(row[field]??'');if(/^[\s]*[=+@-]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"';}).join(','))].join('\r\n');
  const blob=new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const filename='maps-listings-'+new Date().toISOString().slice(0,10)+'.csv';
  chrome.downloads.download({url,filename,saveAs:true},()=>setTimeout(()=>URL.revokeObjectURL(url),60000));
};
refresh();setInterval(refresh,1500);
