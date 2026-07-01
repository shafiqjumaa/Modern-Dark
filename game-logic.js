// game-logic.js — قواعد اللعبة الصافية. كل دالة تُعدّل state مباشرة وترجع {ok, message}
import { COUNTRIES, BUILDING_TYPES, UNIT_TYPES } from './countries-data.js';

const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map(c => [c.id, c]));
const TICK_MS = 20000; // كل 20 ثانية تتجدد الموارد تلقائياً (بدل نظام أدوار صارم لتسهيل اللعب الحي)
const ONE_TIME_BUILDINGS = ["mobilization", "tank_base", "airport", "naval_base"];
const REPEATABLE_BUILDINGS = ["economic", "bunker"];

export function areNeighbors(aId, bId) {
  const a = COUNTRY_BY_ID[aId], b = COUNTRY_BY_ID[bId];
  if (!a || !b) return false;
  return a.neighbors.includes(bId) || b.neighbors.includes(aId);
}

function canAfford(country, cost) {
  for (const k in cost) if ((country[k] || 0) < cost[k]) return false;
  return true;
}
function pay(country, cost) {
  for (const k in cost) country[k] -= cost[k];
}

export function addPlayer(state, playerId, name, color) {
  if (!state.players[playerId]) {
    state.players[playerId] = { name, color, joinedAt: Date.now() };
    state.log = [...(state.log || []).slice(-19), `${name} انضم إلى اللعبة`];
  } else {
    state.players[playerId].name = name;
    state.players[playerId].color = color;
  }
  return { ok: true };
}

export function claimCountry(state, playerId, countryId) {
  const c = state.countries[countryId];
  if (!c) return { ok: false, message: "دولة غير معروفة" };
  if (c.owner) return { ok: false, message: "هذه الدولة محجوزة بالفعل" };
  c.owner = playerId;
  const pname = state.players[playerId]?.name || playerId;
  const cname = COUNTRY_BY_ID[countryId].name_ar;
  state.log = [...(state.log || []).slice(-19), `${pname} استحوذ على ${cname}`];
  return { ok: true };
}

export function buildBuilding(state, playerId, countryId, buildingKey) {
  const c = state.countries[countryId];
  const def = BUILDING_TYPES[buildingKey];
  if (!c || !def) return { ok: false, message: "بيانات غير صحيحة" };
  if (c.owner !== playerId) return { ok: false, message: "لا تملك هذه الدولة" };
  if (ONE_TIME_BUILDINGS.includes(buildingKey) && c.buildings[buildingKey] >= 1) {
    return { ok: false, message: "هذا المبنى موجود بالفعل هنا" };
  }
  if (!canAfford(c, def.cost)) return { ok: false, message: "لا تملك موارد كافية" };
  pay(c, def.cost);
  c.buildings[buildingKey] = (c.buildings[buildingKey] || 0) + 1;
  return { ok: true, message: `تم بناء ${def.name_ar}` };
}

export function recruitUnit(state, playerId, countryId, unitKey, count) {
  const c = state.countries[countryId];
  const def = UNIT_TYPES[unitKey];
  if (!c || !def || count <= 0) return { ok: false, message: "بيانات غير صحيحة" };
  if (c.owner !== playerId) return { ok: false, message: "لا تملك هذه الدولة" };
  if (def.requires && !c.buildings[def.requires]) {
    return { ok: false, message: `يتطلب بناء: ${BUILDING_TYPES[def.requires].name_ar}` };
  }
  const totalCost = {};
  for (const k in def.cost) totalCost[k] = def.cost[k] * count;
  if (!canAfford(c, totalCost)) return { ok: false, message: "لا تملك موارد كافية لهذا العدد" };
  pay(c, totalCost);
  c.units[unitKey] = (c.units[unitKey] || 0) + count;
  return { ok: true, message: `تم تجنيد ${count} × ${def.name_ar}` };
}

function armyPower(c) {
  let p = 0;
  for (const k in c.units) p += (c.units[k] || 0) * (UNIT_TYPES[k]?.power || 0);
  return p;
}

export function attackCountry(state, playerId, fromId, toId) {
  if (!areNeighbors(fromId, toId)) return { ok: false, message: "الدولتان غير متجاورتين" };
  const from = state.countries[fromId];
  const to = state.countries[toId];
  if (!from || !to) return { ok: false, message: "بيانات غير صحيحة" };
  if (from.owner !== playerId) return { ok: false, message: "لا تملك دولة الانطلاق" };
  if (to.owner === playerId) return { ok: false, message: "هذه الدولة مملوكة لك بالفعل" };

  const attackerPower = armyPower(from);
  if (attackerPower <= 0) return { ok: false, message: "لا يوجد جيش في دولة الانطلاق" };

  const isNeutralEmpty = !to.owner && armyPower(to) === 0;
  const bunkerBonus = 1 + (to.buildings.bunker || 0) * 0.15;
  const defenderPower = isNeutralEmpty ? 6 : armyPower(to) * bunkerBonus;

  const roll = attackerPower * (0.85 + Math.random() * 0.3);
  const fromName = COUNTRY_BY_ID[fromId].name_ar;
  const toName = COUNTRY_BY_ID[toId].name_ar;
  const pname = state.players[playerId]?.name || playerId;

  if (roll > defenderPower) {
    // انتصار المهاجم
    for (const k in from.units) from.units[k] = Math.floor((from.units[k] || 0) * 0.7);
    for (const k in to.units) to.units[k] = 0;
    to.owner = playerId;
    state.log = [...(state.log || []).slice(-19), `⚔️ ${pname} انتصر وضمّ ${toName} إلى ${fromName}`];
    return { ok: true, message: `انتصار! ${toName} أصبحت تحت سيطرتك` };
  } else {
    for (const k in from.units) from.units[k] = Math.floor((from.units[k] || 0) * 0.5);
    if (!isNeutralEmpty) for (const k in to.units) to.units[k] = Math.floor((to.units[k] || 0) * 0.8);
    state.log = [...(state.log || []).slice(-19), `🛡️ هجوم ${pname} على ${toName} فشل وتكبّد خسائر`];
    return { ok: false, message: "فشل الهجوم! تكبّدت خسائر في جيشك" };
  }
}

// يُستدعى بشكل دوري من أي عميل متصل — لن يُطبَّق أكثر من مرة كل TICK_MS بفضل فحص lastTick
export function maybeTick(state) {
  const now = Date.now();
  if (now - (state.lastTick || 0) < TICK_MS) return { ok: false, message: "لم يحن وقت التِك بعد" };
  for (const c of COUNTRIES) {
    const cs = state.countries[c.id];
    if (!cs.owner) continue; // الدول غير المملوكة لا تنتج
    const b = cs.buildings;
    cs.oil += c.base.oil;
    cs.iron += c.base.iron + (b.economic || 0) * 2;
    cs.rare += c.base.rare;
    cs.cash += c.base.cash + (b.economic || 0) * 3;
    cs.manpower += c.base.manpower + (b.mobilization || 0) * 2;
  }
  state.tick = (state.tick || 0) + 1;
  state.lastTick = now;
  return { ok: true };
}

export { TICK_MS };
