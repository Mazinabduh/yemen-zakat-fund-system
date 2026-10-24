/* demo-data.js — بيانات تجريبية واقعية تعبئ التطبيق من أول تشغيل
   (تحصيلات + مصروفات عبر المحافظات والمراكز لآخر 8 أشهر) — مازن عبدالوهاب
   كل سجل يحمل demo:true ليُحذف بضغطة واحدة من الإعدادات */
"use strict";
var DemoData = (function () {

  var PAYER_FIRST = ["محمد","عبدالله","أحمد","يحيى","علي","فهد","سلطان","ناصر","خالد","عبدالرحمن","صالح","وليد","مبخوت","عبدالكريم","حسن","إبراهيم","طلال","زكريا","نبيل","أنور"];
  var PAYER_LAST = ["الشميري","الحديد","المقطري","الصلوي","العنسي","القاضي","الوجهيه","الإرياني","الزمر","الحوثي","العماد","الوحاشي","الشعيبي","المروني","القدسي","السامعي","الحبيشي","الجرادي","الأهدل","الخامسي"];
  var BENEF_FIRST = ["فاطمة","عائشة","خديجة","مريم","نورة","سلمى","أمل","سميرة","نظيرة","نجاة","سعاد","رباح","فداء","هدى","زينب"];
  var BENEF_LAST = ["القباطي","الشعبي","المعري","الجرموزي","الحيمي","الضبيبي","الأسلمي","الحدادي","الظاهري","الشامي"];
  var PAYERS = [], BENEFICIARIES = [];
  (function buildNames() {
    for (var i = 0; i < 34; i++) {
      PAYERS.push(PAYER_FIRST[i % PAYER_FIRST.length] + " " + PAYER_LAST[(i * 7 + 3) % PAYER_LAST.length]);
      BENEFICIARIES.push(BENEF_FIRST[i % BENEF_FIRST.length] + " " + BENEF_LAST[(i * 5 + 2) % BENEF_LAST.length]);
    }
  })();

  /* [type, min, max, وزن] */
  var TYPE_MIX = [
    ["money", 60000, 1900000, 30],
    ["trade", 120000, 4200000, 16],
    ["fitr", 2500, 38000, 20],
    ["livestock", 35000, 520000, 12],
    ["crops", 18000, 260000, 10],
    ["charity", 12000, 640000, 12]
  ];
  var TOTAL_WEIGHT = TYPE_MIX.reduce(function (s, t) { return s + t[3]; }, 0);
  var DETAILS = ["تحصيل ميداني", "دفع نقدي بالمركز", "تحويل بنكي", "زكاة مال عائلية", "تبرع تطوعي", "بدل زكاة الفطر", "تحصيل جماعي لحارة", "—"];

  function rnd(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function round50(n) { return Math.round(n / 50) * 50; }

  function pickType() {
    var r = Math.random() * TOTAL_WEIGHT;
    for (var i = 0; i < TYPE_MIX.length; i++) { r -= TYPE_MIX[i][3]; if (r <= 0) return TYPE_MIX[i][0]; }
    return "money";
  }
  function typeRange(t) {
    for (var i = 0; i < TYPE_MIX.length; i++) if (TYPE_MIX[i][0] === t) return TYPE_MIX[i];
    return TYPE_MIX[0];
  }
  /* تاريخ عشوائي خلال آخر n شهر (شامل الشهر الحالي حتى اليوم) */
  function randDate(monthsBack) {
    var now = new Date();
    var d = new Date(now);
    var back = rnd(0, monthsBack);
    d.setMonth(d.getMonth() - back);
    if (back === 0) { d.setDate(rnd(1, Math.max(1, now.getDate()))); }
    else { d.setDate(rnd(1, 28)); }
    if (d > now) d = now;
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function load() {
    return DB.all("collections").then(function (cols) {
      return DB.all("expenses").then(function (exps) {
        var hasDemo = cols.some(function (c) { return c.demo; }) || exps.some(function (e) { return e.demo; });
        if (hasDemo) return false; /* محمّلة مسبقاً */

        var centers = [
          { id: "c_sanaa1", provinceId: "p_sanaa", w: 30 },
          { id: "c_sanaa2", provinceId: "p_sanaa", w: 22 },
          { id: "c_taiz1", provinceId: "p_taiz", w: 26 },
          { id: "c_ibb1", provinceId: "p_ibb", w: 20 },
          { id: "c_hud1", provinceId: "p_hud", w: 14 },
          { id: "c_mar1", provinceId: "p_mar", w: 10 }
        ];
        var CW = centers.reduce(function (s, c) { return s + c.w; }, 0);
        function pickCenter() {
          var r = Math.random() * CW;
          for (var i = 0; i < centers.length; i++) { r -= centers[i].w; if (r <= 0) return centers[i]; }
          return centers[0];
        }

        var year = new Date().getFullYear();
        var seq = 1000;
        var collections = [], expenses = [], i, c, t, tr, amount, dt;

        for (i = 0; i < 210; i++) {
          c = pickCenter(); t = pickType(); tr = typeRange(t);
          amount = round50(rnd(tr[1], tr[2]));
          dt = randDate(8);
          collections.push({
            id: "demo_c" + i, receiptNo: "ZK-" + year + "-" + ("00000" + (seq++)).slice(-6),
            date: dt, type: t, payerName: pick(PAYERS), amount: amount, unit: "YER",
            provinceId: c.provinceId, centerId: c.id,
            details: pick(DETAILS), createdBy: "u_admin", createdByName: "المدير العام",
            createdAt: Date.now() - i * 60000, demo: true
          });
        }
        var CATS = ["poor", "needy", "workers", "hearts", "debtors", "cause", "wayfarer", "captives"];
        for (i = 0; i < 68; i++) {
          c = pickCenter();
          amount = round50(rnd(18000, 720000));
          dt = randDate(8);
          var ben = pick(BENEFICIARIES);
          expenses.push({
            id: "demo_x" + i, date: dt, category: CATS[i % CATS.length],
            beneficiaryName: ben, amount: amount,
            provinceId: c.provinceId, centerId: c.id,
            details: "صرف مساعدات — " + pick(["إيجار منزل", "سلة غذائية", "علاج طبي", "سداد دين", "كسوة شتوية", "مخصص شهري", "دعم مشروع ناشئ"]),
            createdBy: "u_admin", createdByName: "المدير العام",
            createdAt: Date.now() - i * 60000, demo: true
          });
        }

        return DB.bulkPut("collections", collections).then(function () {
          return DB.bulkPut("expenses", expenses);
        }).then(function () {
          return DB.setSetting("receiptSeq", seq);
        }).then(function () {
          if (window.Audit) return Audit.log("تهيئة", "collections", "تحميل بيانات تجريبية: " + collections.length + " إيصال و" + expenses.length + " صرفية");
        }).then(function () { return true; });
      });
    });
  }

  function clear() {
    return Promise.all([DB.all("collections"), DB.all("expenses"), DB.all("vouchers")]).then(function (r) {
      var cols = r[0].filter(function (x) { return x.demo; });
      var exps = r[1].filter(function (x) { return x.demo; });
      var vchs = r[2].filter(function (x) { return x.refId && String(x.refId).indexOf("demo_") === 0; });
      var tasks = [];
      cols.forEach(function (x) { tasks.push(DB.del("collections", x.id)); });
      exps.forEach(function (x) { tasks.push(DB.del("expenses", x.id)); });
      vchs.forEach(function (x) { tasks.push(DB.del("vouchers", x.id)); });
      return Promise.all(tasks).then(function () {
        if (window.Audit) return Audit.log("حذف", "collections", "حذف البيانات التجريبية (" + (cols.length + exps.length) + " سجل)");
      }).then(function () { return cols.length + exps.length; });
    });
  }

  function isLoaded() {
    return DB.all("collections").then(function (cols) {
      return cols.some(function (c) { return c.demo; });
    });
  }

  return { load: load, clear: clear, isLoaded: isLoaded };
})();
