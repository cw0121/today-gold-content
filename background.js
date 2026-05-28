// background.js — Receives gold data from offscreen (both proactive + request-based)

const CACHE_KEY = 'goldPrices';

let _creating = null;

async function ensureOffscreen() {
  // Always close existing document to ensure latest code runs
  try {
    if (await chrome.offscreen.hasDocument()) {
      await chrome.offscreen.closeDocument();
    }
  } catch (_) {}

  const doc = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Fetch gold prices from jijinhao API',
  });
  await doc;

  // Wait for offscreen.js to load and register listeners
  await new Promise(r => setTimeout(r, 2000));
}

function saveData(spot, brands, _codes) {
  const data = {
    updatedAt: Date.now(),
    updatedTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    spot: spot || null,
    brands: brands || [],
    _codes: _codes || [],
  };
  chrome.storage.local.set({ [CACHE_KEY]: data });
  console.log('[金价] saved | spot:', data.spot?.price ?? 'null', '| brands:', data.brands.length, '| codes:', data._codes.join(','));
  return data;
}

async function updateAll() {
  try { await ensureOffscreen(); } catch (e) {
    console.warn('[offscreen] create failed:', e.message);
    return null;
  }

  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'FETCH_ALL' }, resp => {
      if (chrome.runtime.lastError || !resp?.ok) {
        console.warn('[offscreen] fetch failed:', chrome.runtime.lastError?.message || resp?.error);
        resolve(null);
        return;
      }
      const data = saveData(resp.spot, resp.brands, resp._codes);
      resolve(data);
    });
  });
}

// ─── Listen for proactive data from offscreen ────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Offscreen proactively sends data on load
  if (msg.type === 'DATA_FROM_OFFSCREEN') {
    saveData(msg.spot, msg.brands, msg._codes);
    return false;
  }

  // Popup requests refresh
  if (msg.type === 'REFRESH') {
    updateAll()
      .then(data => sendResponse({ ok: true, data }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('refresh', { periodInMinutes: 30 });
  ensureOffscreen(); // offscreen will proactively send data
});

chrome.runtime.onStartup.addListener(() => {
  ensureOffscreen();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'refresh') updateAll();
});