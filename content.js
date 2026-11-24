(() => {
  if (window.__mapsCollectorLoaded) return;
  window.__mapsCollectorLoaded = true;
  const KEY = 'mapsCollectorV1';
  let active = false, entries = new Map(), observer, interval;
  const getQuery = () => new URL(location.href).searchParams.get('q') || document.querySelector('input#searchboxinput')?.value || '';
  const normalize = (url) => { try { const u = new URL(url, location.origin); return u.origin + u.pathname; } catch { return url; } };
  const shutdown = () => { active = false; observer?.disconnect(); clearInterval(interval); clearTimeout(window.__mapsCollectorDebounce); };
  const persist = async () => {
    try {
      if (!chrome.runtime?.id) { shutdown(); return; }
      await chrome.storage.local.set({[KEY]: {active, query: getQuery(), entries: [...entries.values()], updated: new Date().toISOString()}});
    } catch (error) {
      if (!chrome.runtime?.id || /context invalidated/i.test(String(error))) shutdown();
      else console.warn('Maps collector storage error', error);
    }
  };
  const collect = () => {
    if (!active) return;
    if (!chrome.runtime?.id) { shutdown(); return; }
    document.querySelectorAll('a[href*="/maps/place/"]').forEach(a => {
      const card = a.closest('[role="article"]') || a.closest('.Nv2PK');
      if (!card) return;
      const url = normalize(a.href);
      const name = card.querySelector('.qBF1Pd')?.textContent?.trim() || a.getAttribute('aria-label')?.trim() || '';
      if (!name || !url) return;
      const raw = card.innerText || '';
      const rating = raw.match(/\b([1-5]\.\d)\b/)?.[1] || '';
      const reviews = raw.match(/\(([\d,.Kk]+)\)/)?.[1] || '';
      const lines = raw.split('\n').map(x=>x.trim()).filter(Boolean);
      const website = card.querySelector('a[data-value="Website"],a[aria-label*="Website"]')?.href || '';
      const phone = raw.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] || '';
      const old = entries.get(url) || {};
      entries.set(url, {name, phone: phone || old.phone || '', website: website || old.website || '', address: old.address || '', category: old.category || '', rating: rating || old.rating || '', reviews: reviews || old.reviews || '', mapsUrl: url, visibleText: lines.join(' | '), keyword: getQuery(), collectedAt: old.collectedAt || new Date().toISOString()});
    });
    persist();
  };
  chrome.storage.local.get(KEY, result => {
    const saved = result[KEY];
    if (saved) { entries = new Map((saved.entries || []).map(e=>[e.mapsUrl,e])); active = !!saved.active; }
    if (active) collect();
  });
  observer = new MutationObserver(() => { if (active) { clearTimeout(window.__mapsCollectorDebounce); window.__mapsCollectorDebounce = setTimeout(collect, 350); } });
  observer.observe(document.documentElement, {childList:true,subtree:true});
  interval = setInterval(collect, 2500);
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === 'start') { active = true; collect(); respond({ok:true,count:entries.size}); }
    else if (message.type === 'stop') { active = false; persist(); respond({ok:true,count:entries.size}); }
    else if (message.type === 'status') respond({ok:true,active,count:entries.size,query:getQuery()});
    else if (message.type === 'reset') { active = false; clearTimeout(window.__mapsCollectorDebounce); entries.clear(); chrome.storage.local.set({[KEY]: {active:false, query:getQuery(), entries:[], updated:new Date().toISOString()}}, () => respond({ok:!chrome.runtime.lastError,count:0})); return true; }
    return false;
  });
})();
