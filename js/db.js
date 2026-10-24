/* db.js — طبقة البيانات IndexedDB (ثلاثية المستويات: مركزي ← محافظات ← مراكز)
   مع تراجع آمن إلى localStorage | مازن عبدالوهاب */
"use strict";
var DB = (function () {
  var NAME = "zakat_fund_db", VER = 1, _db = null;
  var STORES = ["provinces", "centers", "users", "collections", "expenses", "vouchers", "audit", "settings"];

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      var rq = indexedDB.open(NAME, VER);
      rq.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("provinces")) db.createObjectStore("provinces", { keyPath: "id" });
        if (!db.objectStoreNames.contains("centers")) {
          var s = db.createObjectStore("centers", { keyPath: "id" });
          s.createIndex("provinceId", "provinceId");
        }
        if (!db.objectStoreNames.contains("users")) {
          var su = db.createObjectStore("users", { keyPath: "id" });
          su.createIndex("username", "username");
        }
        if (!db.objectStoreNames.contains("collections")) {
          var sc = db.createObjectStore("collections", { keyPath: "id" });
          sc.createIndex("date", "date"); sc.createIndex("provinceId", "provinceId");
          sc.createIndex("centerId", "centerId"); sc.createIndex("receiptNo", "receiptNo");
          sc.createIndex("type", "type");
        }
        if (!db.objectStoreNames.contains("expenses")) {
          var sx = db.createObjectStore("expenses", { keyPath: "id" });
          sx.createIndex("date", "date"); sx.createIndex("provinceId", "provinceId");
          sx.createIndex("centerId", "centerId"); sx.createIndex("category", "category");
        }
        if (!db.objectStoreNames.contains("vouchers")) db.createObjectStore("vouchers", { keyPath: "id" });
        if (!db.objectStoreNames.contains("audit")) {
          var sa = db.createObjectStore("audit", { keyPath: "id" });
          sa.createIndex("ts", "ts");
        }
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
      };
      rq.onsuccess = function () { _db = rq.result; resolve(_db); };
      rq.onerror = function () { reject(rq.error); };
    });
  }

  function tx(store, mode) { return _db.transaction(store, mode).objectStore(store); }
  function req(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  /* CRUD */
  function put(store, obj) { return open().then(function () { return req(tx(store, "readwrite").put(obj)); }); }
  function get(store, id) { return open().then(function () { return req(tx(store, "readonly").get(id)); }); }
  function del(store, id) { return open().then(function () { return req(tx(store, "readwrite")["delete"](id)); }); }
  function all(store) { return open().then(function () { return req(tx(store, "readonly").getAll()); }); }
  function count(store) { return open().then(function () { return req(tx(store, "readonly").count()); }); }
  function clear(store) { return open().then(function () { return req(tx(store, "readwrite").clear()); }); }
  function bulkPut(store, arr) {
    return open().then(function () {
      return new Promise(function (res, rej) {
        var t = _db.transaction(store, "readwrite"), os = t.objectStore(store);
        arr.forEach(function (o) { os.put(o); });
        t.oncomplete = function () { res(true); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }

  /* settings key/value */
  function getSetting(key, def) {
    return get("settings", key).then(function (v) { return v ? v.value : def; });
  }
  function setSetting(key, value) { return put("settings", { key: key, value: value }); }

  /* ============ استعلامات هرمية ============ */
  /* نطاق المستخدم: admin=الكل | manager=محافظته | clerk=مركزه */
  function scopeFilter(user) {
    return {
      provinceId: user.role === "admin" ? null : (user.provinceId || null),
      centerId: user.role === "clerk" ? (user.centerId || null) : null
    };
  }
  function inScope(rec, sc) {
    if (sc.centerId && rec.centerId !== sc.centerId) return false;
    if (sc.provinceId && rec.provinceId !== sc.provinceId) return false;
    return true;
  }

  /* collections مع فلترة: {from,to,provinceId,centerId,type,text,user} */
  function queryCollections(f) {
    return all("collections").then(function (rows) {
      return rows.filter(function (r) {
        if (f.from && r.date < f.from) return false;
        if (f.to && r.date > f.to) return false;
        if (f.provinceId && r.provinceId !== f.provinceId) return false;
        if (f.centerId && r.centerId !== f.centerId) return false;
        if (f.type && r.type !== f.type) return false;
        if (f.createdBy && r.createdBy !== f.createdBy) return false;
        if (f.text) {
          var t = f.text.toLowerCase();
          var hay = (String(r.receiptNo) + " " + (r.payerName || "") + " " + (r.details || "")).toLowerCase();
          if (hay.indexOf(t) === -1) return false;
        }
        return true;
      }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt - a.createdAt); });
    });
  }
  function queryExpenses(f) {
    return all("expenses").then(function (rows) {
      return rows.filter(function (r) {
        if (f.from && r.date < f.from) return false;
        if (f.to && r.date > f.to) return false;
        if (f.provinceId && r.provinceId !== f.provinceId) return false;
        if (f.centerId && r.centerId !== f.centerId) return false;
        if (f.category && r.category !== f.category) return false;
        if (f.text) {
          var t = f.text.toLowerCase();
          var hay = ((r.beneficiaryName || "") + " " + (r.details || "")).toLowerCase();
          if (hay.indexOf(t) === -1) return false;
        }
        return true;
      }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt - a.createdAt); });
    });
  }

  /* التجميع التلقائي (Rollup): مركزي ← محافظة ← مركز */
  function rollup(rows, by) { /* by: 'center'|'province'|'type'|'category'|'month'|'day' */
    var map = {};
    rows.forEach(function (r) {
      var k;
      if (by === "center") k = r.centerId;
      else if (by === "province") k = r.provinceId;
      else if (by === "type") k = r.type;
      else if (by === "category") k = r.category;
      else if (by === "month") k = String(r.date).slice(0, 7);
      else if (by === "day") k = r.date;
      if (!k) k = "—";
      if (!map[k]) map[k] = { key: k, count: 0, amount: 0 };
      map[k].count++;
      map[k].amount += U.num(r.amount);
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function totals(rows) {
    var t = { count: rows.length, amount: 0 };
    rows.forEach(function (r) { t.amount += U.num(r.amount); });
    return t;
  }

  /* ============ التهيئة الأولية ============ */
  function seed() {
    return getSetting("seeded", false).then(function (done) {
      if (done) return;
      /* المحافظات الافتراضية */
      var provs = [
        { id: "p_sanaa", name: "أمانة العاصمة", hq: "صنعاء" },
        { id: "p_taiz", name: "محافظة تعز", hq: "تعز" },
        { id: "p_ibb", name: "محافظة إب", hq: "إب" },
        { id: "p_hud", name: "محافظة الحديدة", hq: "الحديدة" },
        { id: "p_mar", name: "محافظة مأرب", hq: "مأرب" },
        { id: "p_haj", name: "محافظة حجة", hq: "حجة" }
      ];
      var centers = [
        { id: "c_sanaa1", name: "مركز الزكاة - شعوب", provinceId: "p_sanaa", phone: "", address: "شارع شعوب" },
        { id: "c_sanaa2", name: "مركز الزكاة - معين", provinceId: "p_sanaa", phone: "", address: "" },
        { id: "c_taiz1", name: "مركز الزكاة - تعز المدينة", provinceId: "p_taiz", phone: "", address: "" },
        { id: "c_ibb1", name: "مركز الزكاة - إب المدينة", provinceId: "p_ibb", phone: "", address: "" },
        { id: "c_hud1", name: "مركز الزكاة - الحديدة المدينة", provinceId: "p_hud", phone: "", address: "" },
        { id: "c_mar1", name: "مركز الزكاة - مأرب المدينة", provinceId: "p_mar", phone: "", address: "" }
      ];
      var settings = [
        { key: "seeded", value: true },
        { key: "orgName", value: "صندوق تحصيل الزكاة" },
        { key: "orgCountry", value: "الجمهورية اليمنية" },
        { key: "orgMinistry", value: "الجهاز المركزي للزكاة" },
        { key: "currency", value: "ريال يمني" },
        { key: "receiptSeq", value: 1 },
        { key: "printerWidth", value: "80" },
        { key: "orgPhone", value: "" },
        { key: "orgAddress", value: "صنعاء - الجمهورية اليمنية" }
      ];
      return Promise.all([
        bulkPut("provinces", provs),
        bulkPut("centers", centers),
        bulkPut("settings", settings)
      ]);
    });
  }

  /* رقم إيصال تسلسلي: ZK-2025-000123 */
  function nextReceiptNo() {
    return open().then(function () {
      return new Promise(function (res, rej) {
        var t = _db.transaction("settings", "readwrite");
        var os = t.objectStore("settings");
        var rq = os.get("receiptSeq");
        rq.onsuccess = function () {
          var n = (rq.result && rq.result.value) || 1;
          var year = new Date().getFullYear();
          var no = "ZK-" + year + "-" + ("000000" + n).slice(-6);
          os.put({ key: "receiptSeq", value: n + 1 });
          t.oncomplete = function () { res(no); };
          t.onerror = function () { rej(t.error); };
        };
        rq.onerror = function () { rej(rq.error); };
      });
    });
  }

  return {
    open: open, put: put, get: get, del: del, all: all, count: count, clear: clear, bulkPut: bulkPut,
    getSetting: getSetting, setSetting: setSetting,
    scopeFilter: scopeFilter, inScope: inScope,
    queryCollections: queryCollections, queryExpenses: queryExpenses,
    rollup: rollup, totals: totals,
    seed: seed, nextReceiptNo: nextReceiptNo,
    STORES: STORES, NAME: NAME
  };
})();
