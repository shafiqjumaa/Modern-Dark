// store.js — طبقة المزامنة: تستخدم Firestore إذا كان مهيّأ، وإلا تعمل بوضع محلي (لاعب واحد للتجربة)
import { firebaseConfig, IS_CONFIGURED } from './firebase-config.js';
import { COUNTRIES } from './countries-data.js';

const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
const FIREBASE_FS_URL = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function freshCountriesState() {
  const obj = {};
  for (const c of COUNTRIES) {
    obj[c.id] = {
      owner: null,
      oil: c.base.oil * 4,
      iron: c.base.iron * 4,
      rare: c.base.rare * 4,
      cash: c.base.cash * 4,
      manpower: c.base.manpower * 4,
      buildings: { mobilization: 0, tank_base: 0, airport: 0, naval_base: 0, economic: 0, bunker: 0 },
      units: { infantry: 0, tank: 0, artillery: 0, jet: 0, navy: 0, special: 0 },
    };
  }
  return obj;
}

function freshRoomState() {
  return {
    tick: 0,
    lastTick: Date.now(),
    players: {},
    countries: freshCountriesState(),
    log: [],
  };
}

export class GameStore {
  constructor() {
    this.online = false;
    this.roomCode = null;
    this.state = null;
    this.listeners = [];
    this._fb = null; // { db, doc, setDoc, getDoc, onSnapshot, runTransaction }
    this._unsub = null;
  }

  async _ensureFirebase() {
    if (this._fb || !IS_CONFIGURED) return;
    const appMod = await import(FIREBASE_APP_URL);
    const fsMod = await import(FIREBASE_FS_URL);
    const app = appMod.initializeApp(firebaseConfig);
    const db = fsMod.getFirestore(app);
    this._fb = { db, ...fsMod };
    this.online = true;
  }

  notify() {
    for (const cb of this.listeners) cb(this.state);
  }

  subscribe(cb) {
    this.listeners.push(cb);
    if (this.state) cb(this.state);
    return () => { this.listeners = this.listeners.filter(x => x !== cb); };
  }

  async createOrJoinRoom(roomCode) {
    this.roomCode = roomCode;
    await this._ensureFirebase();

    if (!this.online) {
      // وضع محلي: نخزن الحالة في الذاكرة فقط (تُفقد عند إعادة تحميل الصفحة)
      if (!this.state) this.state = freshRoomState();
      this.notify();
      return;
    }

    const { db, doc, getDoc, setDoc, onSnapshot } = this._fb;
    const ref = doc(db, "rooms", roomCode);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, freshRoomState());
    }
    if (this._unsub) this._unsub();
    this._unsub = onSnapshot(ref, (s) => {
      this.state = s.data();
      this.notify();
    });
  }

  // mutatorFn(state) يجب أن يُعدّل الحالة مباشرة (mutation) ويرجع {ok, message}
  async runAction(mutatorFn) {
    if (!this.online) {
      const result = mutatorFn(this.state);
      this.notify();
      return result;
    }
    const { db, doc, runTransaction } = this._fb;
    const ref = doc(db, "rooms", this.roomCode);
    let result = { ok: false, message: "خطأ غير متوقع" };
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const state = snap.data();
      result = mutatorFn(state);
      tx.set(ref, state);
    });
    return result;
  }
}
