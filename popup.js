// popup.js — Spot gold + brand prices + calculator + theme toggle

const CACHE_KEY = 'goldPrices';
const THEME_KEY = 'themePreference';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_ICONS = {
  '周大福': 'brands/zdf.png',
  '老凤祥': 'brands/lfx.jpg',
  '菜百珠宝': 'brands/cb.png',
  '中国黄金': 'brands/zghj.png',
  '周生生': 'brands/zss.png',
};

const UNIT_MAP = { g: 1, qian: 5, liang: 50 };
const UNIT_LABELS = { g: '克', qian: '钱', liang: '两' };

let currentData = null;
let calcBrand = '周大福';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function changeClass(change) {
  if (change == null) return 'flat';
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'flat';
}

function changeText(change) {
  if (change == null) return '—';
  const prefix = change > 0 ? '+' : '';
  return `${prefix}${change.toFixed(2)}%`;
}

// ─── Spot price ───────────────────────────────────────────────────────────────

function renderSpotPrice(spot) {
  const priceEl = document.getElementById('spot-price');
  const changeEl = document.getElementById('spot-change');
  const recoveryEl = document.getElementById('spot-recovery');

  if (!spot || spot.price == null) {
    priceEl.textContent = '—';
    changeEl.textContent = '—';
    changeEl.className = 'metal-change flat';
    recoveryEl.textContent = '—';
    return;
  }

  priceEl.innerHTML = `${spot.price.toFixed(2)} <small>¥/克</small>`;
  changeEl.textContent = changeText(spot.change);
  changeEl.className = `metal-change ${changeClass(spot.change)}`;
  recoveryEl.innerHTML = `≈ ${spot.price.toFixed(2)} <small>¥/克</small>`;
}

// ─── Brand list ───────────────────────────────────────────────────────────────

function renderBrandPrices(brands) {
  const container = document.getElementById('brand-prices');
  const header = container.querySelector('.brand-header');
  container.innerHTML = '';
  if (header) container.appendChild(header);

  if (!brands || brands.length === 0) {
    container.innerHTML += '<div class="brand-row"><span class="brand-name" style="color:#666">暂无数据</span></div>';
    return;
  }

  // Find lowest and highest price brands
  const withPrice = brands.filter(b => b.price != null);
  let minName = null, maxName = null;
  if (withPrice.length >= 2) {
    const minBrand = withPrice.reduce((a, b) => a.price < b.price ? a : b);
    const maxBrand = withPrice.reduce((a, b) => a.price > b.price ? a : b);
    minName = minBrand.name;
    maxName = maxBrand.name;
  }

  for (const brand of brands) {
    const div = document.createElement('div');
    let rowClass = 'brand-row';
    if (brand.name === minName) rowClass += ' highlight-lowest';
    if (brand.name === maxName) rowClass += ' highlight-highest';
    div.className = rowClass;
    div.innerHTML = `
      <span class="brand-name">
        ${BRAND_ICONS[brand.name]
          ? `<img class="brand-logo" src="${chrome.runtime.getURL(BRAND_ICONS[brand.name])}" alt="${brand.name}">`
          : `<span class="brand-logo-fallback">${brand.icon || ''}</span>`
        } ${brand.name}</span>
      ${brand.price != null
        ? `<span class="brand-price">${brand.price.toFixed(2)}<span class="brand-unit"> ¥/克</span></span>`
        : `<span class="brand-price unavailable">暂无</span>`
      }
      ${brand.change != null
        ? `<span class="metal-change ${changeClass(brand.change)}">${changeText(brand.change)}</span>`
        : '<span class="metal-change flat">—</span>'
      }
    `;
    container.appendChild(div);
  }
}

function renderTime(time) {
  document.getElementById('updated-time').textContent = time ? `更新于 ${time}` : '—';
}

function showError(msg) {
  const existing = document.querySelector('.error-notice');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'error-notice';
  el.textContent = msg;
  document.querySelector('.container').insertBefore(el, document.querySelector('footer'));
}

function render(data) {
  if (!data) return;
  currentData = data;
  renderTime(data.updatedTime);
  renderSpotPrice(data.spot);
  renderBrandPrices(data.brands);
  updateCalcBrandButtons();
  recalc();

}

// ─── Calculator ───────────────────────────────────────────────────────────────

function updateCalcBrandButtons() {
  const container = document.getElementById('calc-brand-select');
  container.innerHTML = '';
  if (!currentData?.brands) return;

  for (let brand of currentData.brands) {
    const btn = document.createElement('button');
    let cls = 'calc-brand-btn';

    if (brand.name === calcBrand) {
      cls += ' active';
    }
    if (brand.price === null || brand.price === undefined) {
      cls += ' disabled';
    }

    btn.className = cls;
    btn.textContent = brand.name;
    
    if (brand.price != null) {
      btn.addEventListener('click', () => {
        calcBrand = brand.name;
        container.querySelectorAll('.calc-brand-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        recalc();
      });
    } else {
      btn.disabled = true;
    }
    
    container.appendChild(btn);
  }
}

function recalc() {
  const input = parseFloat(document.getElementById('calc-input').value) || 0;
  const unit = document.getElementById('calc-unit').value;
  const grams = input * UNIT_MAP[unit];
  const unitLabel = UNIT_LABELS[unit];
  const resultEl = document.getElementById('calc-result');

  if (!currentData?.brands) {
    resultEl.innerHTML = '<span class="calc-empty">暂无价格数据</span>';
    return;
  }

  const selectedBrand = currentData.brands.find(b => b.name === calcBrand);
  if (!selectedBrand || selectedBrand.price == null) {
    resultEl.innerHTML = '<span class="calc-empty">该品牌暂无价格</span>';
    return;
  }

  const total = grams * selectedBrand.price;
  const gramText = grams.toFixed(grams >= 1 ? 1 : 2) + (unit === 'g' ? '克' : `克（${input}${unitLabel}）`);

  resultEl.innerHTML = `
    <div class="calc-total">
      <span class="calc-total-label">${gramText} ${calcBrand}足金</span>
      <span class="calc-total-value">¥${total.toFixed(2)}</span>
    </div>
    <div class="calc-sub">
      ¥${selectedBrand.price.toFixed(2)}/克 × ${grams.toFixed(grams >= 1 ? 1 : 2)}克
    </div>
  `;
}

document.getElementById('calc-btn').addEventListener('click', () => {
  const section = document.getElementById('calc-section');
  const btn = document.getElementById('calc-btn');
  if (section.style.display === 'none') {
    section.style.display = '';
    btn.classList.add('active');
  } else {
    section.style.display = 'none';
    btn.classList.remove('active');
  }
});

document.getElementById('calc-input').addEventListener('input', recalc);
document.getElementById('calc-unit').addEventListener('change', () => {
  const input = document.getElementById('calc-input');
  const unit = document.getElementById('calc-unit').value;
  input.placeholder = unit === 'g' ? '输入克数' : unit === 'qian' ? '输入钱数' : '输入两数';
  recalc();
});

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-btn').textContent = theme === 'dark' ? '🌙' : '☀️';
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

chrome.storage.local.get(THEME_KEY, result => {
  applyTheme(result[THEME_KEY] || getSystemTheme());
});

document.getElementById('theme-btn').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  chrome.storage.local.set({ [THEME_KEY]: next });
});

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadCache() {
  return new Promise(resolve => {
    chrome.storage.local.get(CACHE_KEY, result => resolve(result[CACHE_KEY] || null));
  });
}

// ─── Direct fetch from popup (most reliable, DNR adds headers) ────────────────

const SPOT_CODE_POPUP = 'JO_71';
const BRAND_CODES_POPUP = {
  '周大福': 'JO_56040',
  '老凤祥': 'JO_42657',
  '菜百珠宝': 'JO_42643',
  '中国黄金': 'JO_348900',
  '周生生': 'JO_56048',
};

async function fetchDirect() {
  const allCodes = [SPOT_CODE_POPUP, ...Object.values(BRAND_CODES_POPUP)].join(',');
  const url = `https://api.jijinhao.com/quoteCenter/realTime.htm?codes=${allCodes}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const m = text.match(/var quote_json\s*=\s*(\{.*\})/s);
    if (!m) throw new Error('parse failed');
    const data = JSON.parse(m[1]);
    if (!data.flag) throw new Error('api error');

    const sq = data[SPOT_CODE_POPUP];
    const spot = sq ? {
      price: parseFloat(sq.q1),
      change: parseFloat(sq.q80),
    } : null;

    const brands = [];
    for (const [name, code] of Object.entries(BRAND_CODES_POPUP)) {
      const q = data[code];
      if (!q) { brands.push({ name, price: null, change: null }); continue; }
      const price = parseFloat(q.q1);
      const change = parseFloat(q.q80);
      brands.push({ name, price: price > 0 ? price : null, change });
    }

    return { spot, brands };
  } catch (e) {
    console.warn('[popup-fetch] failed:', e.message);
    return null;
  }
}

// ─── Refresh button ───────────────────────────────────────────────────────────

document.getElementById('refresh-btn').addEventListener('click', async () => {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('spinning');
  btn.disabled = true;
  document.getElementById('updated-time').textContent = '刷新中...';

  try {
    const directResult = await fetchDirect();
    if (directResult) {
      const data = {
        updatedAt: Date.now(),
        updatedTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        spot: directResult.spot,
        brands: directResult.brands,
      };
      chrome.storage.local.set({ [CACHE_KEY]: data });
      render(data);
    } else {
      const cached = await loadCache();
      if (cached) render(cached);
      else showError('刷新失败，请稍后重试');
    }
  } catch (e) {
    showError('刷新失败：' + e.message);
  } finally {
    btn.classList.remove('spinning');
    btn.disabled = false;
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  const timeout = setTimeout(() => {
    showError('加载超时，请点击刷新重试');
  }, 15000);

  try {
    // Direct fetch is most reliable (popup context + DNR headers)
    const directResult = await fetchDirect();
    if (directResult) {
      const data = {
        updatedAt: Date.now(),
        updatedTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        spot: directResult.spot,
        brands: directResult.brands,
      };
      // Save to cache for next time
      chrome.storage.local.set({ [CACHE_KEY]: data });
      render(data);
      clearTimeout(timeout);
      return;
    }

    // Fallback: read from cache
    let data = await loadCache();
    if (data) { render(data); clearTimeout(timeout); return; }

    // Last resort: ask background to fetch
    const response = await chrome.runtime.sendMessage({ type: 'REFRESH' });
    if (response?.ok && response?.data) {
      render(response.data);
    } else {
      showError('暂无数据，请点击刷新');
    }
    clearTimeout(timeout);
  } catch (e) {
    clearTimeout(timeout);
    showError('加载失败：' + e.message);
  }
})();