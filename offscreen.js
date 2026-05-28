// offscreen.js
// On load: immediately fetch all data and send to background
// On message: re-fetch if background requests it

const SPOT_CODE = 'JO_71';
const BRAND_CODES = {
  '周大福':   'JO_56040',
  '老凤祥':   'JO_42657',
  '菜百珠宝': 'JO_42643',
  '中国黄金': 'JO_348900',
  '周生生':   'JO_56048',
};

async function fetchAll() {
  const allCodes = [SPOT_CODE, ...Object.values(BRAND_CODES)].join(',');
  const url = `https://api.jijinhao.com/quoteCenter/realTime.htm?codes=${allCodes}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    if (!text || text.length < 10) throw new Error('empty body');

    const m = text.match(/var quote_json\s*=\s*(\{.*\})/s);
    if (!m) throw new Error('parse failed');

    const data = JSON.parse(m[1]);
    if (!data.flag) throw new Error('api flag false');

    // Log all returned codes
    const returnedCodes = Object.keys(data).filter(k => k !== 'flag' && k !== 'errorCode');
    const jo71 = data[SPOT_CODE];

    // AU9999 spot price
    const spot = jo71 ? {
      price: parseFloat(jo71.q1),
      change: parseFloat(jo71.q80),
      prevClose: parseFloat(jo71.q2) || null,
    } : null;

    // Brand prices
    const brands = [];
    for (const [name, code] of Object.entries(BRAND_CODES)) {
      const q = data[code];
      if (!q) { brands.push({ name, price: null, change: null }); continue; }
      const price = parseFloat(q.q1);
      const change = parseFloat(q.q80);
      brands.push({ name, price: price > 0 ? price : null, change });
    }

    console.log('[offscreen] spot:', spot?.price, 'brands:', brands.length);
    return { spot, brands, _codes: returnedCodes };
  } catch (e) {
    console.error('[offscreen] fetch error:', e.message);
    return null;
  }
}

// On load → immediately fetch and send to background
fetchAll().then(result => {
  if (result) {
    chrome.runtime.sendMessage({ type: 'DATA_FROM_OFFSCREEN', spot: result.spot, brands: result.brands, _codes: result._codes });
  }
});

// Also respond to refresh requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FETCH_ALL') {
    fetchAll().then(result => {
      if (result) sendResponse({ ok: true, spot: result.spot, brands: result.brands, _codes: result._codes });
      else sendResponse({ ok: false, error: 'fetch failed' });
    });
    return true;
  }
});