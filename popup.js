const status = document.getElementById('status');
const KEY = 'mapsCollectorV1';
async function send(type) {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab?.url || !/^https:\/\/www\.google\.(com|ca)\/maps/.test(tab.url)) {status.textContent='Open a Google Maps search tab first.';return null;}
  try { return await chrome.tabs.sendMessage(tab.id,{type}); }
  catch { status.textContent='Refresh the Google Maps tab and try again.';return null; }
}
async function refresh(){ const state=await send('status'); if(state)status.textContent=`${state.active?'Collecting':'Paused'} · ${state.count} listings collected`; }
document.getElementById('start').onclick=async()=>{await send('start');refresh()};
document.getElementById('stop').onclick=async()=>{await send('stop');refresh()};
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
