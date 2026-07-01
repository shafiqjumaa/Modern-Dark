// game.js — نقطة الدخول: يربط الواجهة بمنطق اللعبة وطبقة المزامنة
import { COUNTRIES, BUILDING_TYPES, UNIT_TYPES } from './countries-data.js';
import { GameStore } from './store.js';
import { addPlayer, claimCountry, buildBuilding, recruitUnit, attackCountry, areNeighbors, maybeTick, TICK_MS } from './game-logic.js';

const PLAYER_COLORS = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#ecf0f1'];
const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));

const store = new GameStore();
let myPlayerId = null;
let myName = null;
let myColor = PLAYER_COLORS[0];
let selectedCountryId = null;
let recruitQty = {}; // countryId -> {unitKey: qty}

// ============ أدوات مساعدة ============
function slugId(name) {
  return (name || '').trim().replace(/[.$#\[\]\/]/g, '_').slice(0, 30) || ('لاعب' + Math.floor(Math.random() * 1000));
}
function showToast(message, danger = false) {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast' + (danger ? ' danger' : '');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function fmt(n) { return Math.floor(n); }

// ============ شاشة الدخول ============
function buildColorRow() {
  const row = document.getElementById('colorRow');
  PLAYER_COLORS.forEach((c, i) => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (i === 0 ? ' active' : '');
    dot.style.background = c;
    dot.addEventListener('click', () => {
      myColor = c;
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
    row.appendChild(dot);
  });
}
buildColorRow();

document.getElementById('enterBtn').addEventListener('click', async () => {
  const nameVal = document.getElementById('nameInput').value.trim();
  let roomVal = document.getElementById('roomInput').value.trim().toUpperCase();
  if (!nameVal) { showToast('اكتب اسمك أولاً', true); return; }
  if (!roomVal) {
    roomVal = Math.random().toString(36).slice(2, 7).toUpperCase();
    document.getElementById('roomInput').value = roomVal;
  }
  myName = nameVal;
  myPlayerId = slugId(nameVal);

  const statusBox = document.getElementById('statusBox');
  statusBox.textContent = 'جاري الاتصال...';

  try {
    await store.createOrJoinRoom(roomVal);
    await store.runAction((state) => addPlayer(state, myPlayerId, myName, myColor));
    statusBox.textContent = store.online ? 'متصل أونلاين ✅' : 'وضع تجربة محلي (بدون مزامنة حقيقية)';
    statusBox.className = 'lobby-status' + (store.online ? ' online' : '');

    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'flex';
    document.getElementById('roomCodeBadge').textContent = roomVal;
    document.getElementById('modeBadge').textContent = store.online ? 'أونلاين' : 'محلي';
    document.getElementById('modeBadge').className = 'mode-badge ' + (store.online ? 'online' : 'local');

    buildMap();
    store.subscribe(render);
    startTickLoop();
  } catch (err) {
    console.error(err);
    statusBox.textContent = 'حدث خطأ في الاتصال — تحقق من إعدادات Firebase';
  }
});

document.getElementById('leaveBtn').addEventListener('click', () => location.reload());

// ============ بناء الخريطة (مرة واحدة) ============
function buildMap() {
  const countriesLayer = document.getElementById('countriesLayer');
  const labelsLayer = document.getElementById('labelsLayer');
  countriesLayer.innerHTML = '';
  labelsLayer.innerHTML = '';

  COUNTRIES.forEach(c => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', c.d);
    path.setAttribute('class', 'country-path unowned');
    path.setAttribute('data-id', c.id);
    path.addEventListener('click', () => selectCountry(c.id));
    countriesLayer.appendChild(path);

    // دائرة نقر إضافية للدول الصغيرة (تُستخدم أيضاً كمؤشر ملكية مرئي)
    if (c.clickRadius) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', c.cx);
      circle.setAttribute('cy', c.cy);
      circle.setAttribute('r', c.clickRadius);
      circle.setAttribute('class', 'country-path unowned');
      circle.setAttribute('data-id', c.id);
      circle.setAttribute('data-marker', '1');
      circle.addEventListener('click', () => selectCountry(c.id));
      countriesLayer.appendChild(circle);
    }

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', c.cx);
    label.setAttribute('y', c.clickRadius ? c.cy + c.clickRadius + 9 : c.cy);
    label.setAttribute('class', 'country-label');
    label.textContent = c.name_ar;
    labelsLayer.appendChild(label);
  });
}

function selectCountry(id) {
  selectedCountryId = id;
  if (store.state) render(store.state);
}

// ============ حلقة التِك (إنتاج الموارد التلقائي) ============
function startTickLoop() {
  setInterval(() => {
    if (!store.state) return;
    const elapsed = Date.now() - (store.state.lastTick || 0);
    const pct = Math.min(100, (elapsed / TICK_MS) * 100);
    document.getElementById('tickFill').style.width = pct + '%';
    if (elapsed >= TICK_MS) {
      store.runAction(maybeTick);
    }
  }, 500);
}

// ============ الرندر الرئيسي ============
function render(state) {
  if (!state) return;

  // شارة الوضع
  document.getElementById('tickLabel').textContent = `تِك #${state.tick || 0}`;

  // قائمة اللاعبين
  const playersList = document.getElementById('playersList');
  playersList.innerHTML = '';
  const countByOwner = {};
  Object.values(state.countries).forEach(c => { if (c.owner) countByOwner[c.owner] = (countByOwner[c.owner] || 0) + 1; });
  Object.entries(state.players || {}).forEach(([pid, p]) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `<span class="swatch" style="background:${p.color}"></span><span>${p.name}${pid === myPlayerId ? ' (أنت)' : ''}</span><span class="count">${countByOwner[pid] || 0} دولة</span>`;
    playersList.appendChild(row);
  });

  // سجل الأحداث
  const logBox = document.getElementById('logBox');
  logBox.innerHTML = (state.log || []).slice().reverse().map(l => `<div>${l}</div>`).join('');

  // تلوين الخريطة
  document.querySelectorAll('.country-path').forEach(el => {
    const id = el.getAttribute('data-id');
    const cs = state.countries[id];
    const owner = cs?.owner;
    const color = owner ? (state.players[owner]?.color || '#888') : null;
    if (color) { el.style.fill = color; el.classList.remove('unowned'); }
    else { el.style.fill = ''; el.classList.add('unowned'); }
    el.classList.toggle('selected', id === selectedCountryId);
  });

  // HUD: إجمالي موارد اللاعب الحالي
  const hud = document.getElementById('resourceHud');
  const totals = { oil: 0, iron: 0, rare: 0, cash: 0, manpower: 0 };
  Object.values(state.countries).forEach(c => {
    if (c.owner === myPlayerId) {
      totals.oil += c.oil; totals.iron += c.iron; totals.rare += c.rare; totals.cash += c.cash; totals.manpower += c.manpower;
    }
  });
  hud.innerHTML = `
    <span class="r">🛢️ ${fmt(totals.oil)}</span>
    <span class="r">⚙️ ${fmt(totals.iron)}</span>
    <span class="r">💎 ${fmt(totals.rare)}</span>
    <span class="r">💰 ${fmt(totals.cash)}</span>
    <span class="r">👥 ${fmt(totals.manpower)}</span>
  `;

  renderDetailPanel(state);
}

// ============ لوحة تفاصيل الدولة المختارة ============
function renderDetailPanel(state) {
  const panel = document.getElementById('detailPanel');
  if (!selectedCountryId) {
    panel.innerHTML = '<div class="empty-hint">اضغط على أي دولة على الخريطة لعرض تفاصيلها والتحكم بها</div>';
    return;
  }
  const meta = COUNTRY_BY_ID[selectedCountryId];
  const cs = state.countries[selectedCountryId];
  const isMine = cs.owner === myPlayerId;
  const ownerName = cs.owner ? (state.players[cs.owner]?.name || cs.owner) : 'غير مملوكة';

  let html = `<div class="panel-section">
    <h4>${meta.name_ar}</h4>
    <div style="font-size:12px; color:var(--muted); margin-bottom:8px;">المالك: ${ownerName}</div>`;

  if (!cs.owner) {
    html += `<button class="btn small" id="claimBtn">استحوذ على هذه الدولة</button>`;
  }

  html += `<div class="res-grid">
    <div><span>نفط</span><span>${fmt(cs.oil)}</span></div>
    <div><span>حديد</span><span>${fmt(cs.iron)}</span></div>
    <div><span>مادة نادرة</span><span>${fmt(cs.rare)}</span></div>
    <div><span>نقد</span><span>${fmt(cs.cash)}</span></div>
    <div><span>قوة بشرية</span><span>${fmt(cs.manpower)}</span></div>
  </div></div>`;

  if (isMine) {
    // المباني
    html += `<div class="panel-section"><h4>المباني</h4>`;
    Object.entries(BUILDING_TYPES).forEach(([key, def]) => {
      const built = cs.buildings[key] || 0;
      const isOneTime = ["mobilization","tank_base","airport","naval_base"].includes(key);
      const disabled = isOneTime && built >= 1;
      const costTxt = Object.entries(def.cost).map(([k,v]) => `${v} ${resLabel(k)}`).join(' + ');
      html += `<div class="unit-row">
        <span>${def.name_ar}${built ? ` (×${built})` : ''}</span>
        <button class="mini-btn" data-build="${key}" ${disabled ? 'disabled' : ''}>${disabled ? 'مبني' : 'بناء: ' + costTxt}</button>
      </div>`;
    });
    html += `</div>`;

    // الوحدات
    html += `<div class="panel-section"><h4>تجنيد وحدات</h4>`;
    Object.entries(UNIT_TYPES).forEach(([key, def]) => {
      const locked = def.requires && !cs.buildings[def.requires];
      const have = cs.units[key] || 0;
      recruitQty[selectedCountryId] = recruitQty[selectedCountryId] || {};
      const qty = recruitQty[selectedCountryId][key] || 1;
      const costTxt = Object.entries(def.cost).map(([k,v]) => `${v*qty} ${resLabel(k)}`).join(' + ');
      html += `<div class="unit-row">
        <span>${def.name_ar} (${have})</span>
        ${locked ? `<span style="color:var(--muted); font-size:11px;">يتطلب ${BUILDING_TYPES[def.requires].name_ar}</span>` : `
        <div class="qty-controls">
          <button data-qty-down="${key}">−</button>
          <span>${qty}</span>
          <button data-qty-up="${key}">+</button>
          <button class="mini-btn" data-recruit="${key}" style="flex:none;">جنّد (${costTxt})</button>
        </div>`}
      </div>`;
    });
    html += `</div>`;

    // الهجوم
    const power = Object.entries(cs.units).reduce((s,[k,v]) => s + v * (UNIT_TYPES[k]?.power||0), 0);
    html += `<div class="panel-section"><h4>الهجوم (قوة جيشك هنا: ${power})</h4>`;
    const allNeighbors = COUNTRIES.filter(c => areNeighbors(selectedCountryId, c.id));
    if (allNeighbors.length === 0) {
      html += `<div style="font-size:12px; color:var(--muted);">لا توجد دول مجاورة (جزيرة)</div>`;
    } else {
      html += `<div class="attack-target-list">`;
      allNeighbors.forEach(n => {
        const ncs = state.countries[n.id];
        if (ncs.owner === myPlayerId) return;
        const label = ncs.owner ? `${state.players[ncs.owner]?.name || ncs.owner}` : 'غير مملوكة';
        html += `<button data-attack="${n.id}">${n.name_ar} — ${label}</button>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  }

  panel.innerHTML = html;

  // ربط الأحداث بعد إدراج HTML
  const claimBtn = document.getElementById('claimBtn');
  if (claimBtn) claimBtn.addEventListener('click', async () => {
    const r = await store.runAction((s) => claimCountry(s, myPlayerId, selectedCountryId));
    showToast(r.message || (r.ok ? 'تم' : 'فشل'), !r.ok);
  });

  panel.querySelectorAll('[data-build]').forEach(btn => btn.addEventListener('click', async () => {
    const key = btn.getAttribute('data-build');
    const r = await store.runAction((s) => buildBuilding(s, myPlayerId, selectedCountryId, key));
    showToast(r.message, !r.ok);
  }));

  panel.querySelectorAll('[data-qty-up]').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.getAttribute('data-qty-up');
    recruitQty[selectedCountryId][key] = (recruitQty[selectedCountryId][key] || 1) + 1;
    render(store.state);
  }));
  panel.querySelectorAll('[data-qty-down]').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.getAttribute('data-qty-down');
    recruitQty[selectedCountryId][key] = Math.max(1, (recruitQty[selectedCountryId][key] || 1) - 1);
    render(store.state);
  }));
  panel.querySelectorAll('[data-recruit]').forEach(btn => btn.addEventListener('click', async () => {
    const key = btn.getAttribute('data-recruit');
    const qty = recruitQty[selectedCountryId]?.[key] || 1;
    const r = await store.runAction((s) => recruitUnit(s, myPlayerId, selectedCountryId, key, qty));
    showToast(r.message, !r.ok);
  }));
  panel.querySelectorAll('[data-attack]').forEach(btn => btn.addEventListener('click', async () => {
    const targetId = btn.getAttribute('data-attack');
    const r = await store.runAction((s) => attackCountry(s, myPlayerId, selectedCountryId, targetId));
    showToast(r.message, !r.ok);
  }));
}

function resLabel(k) {
  return { oil: 'نفط', iron: 'حديد', rare: 'مادة نادرة', cash: 'نقد', manpower: 'قوة بشرية' }[k] || k;
}
