/* backup.js — النسخ الاحتياطي والاستعادة (JSON مشفّر اختيارياً) + تصدير Excel/CSV
   | مازن عبدالوهاب */
"use strict";
var Backup = (function () {

  var EXPORT_VERSION = 1;

  function snapshot() {
    var jobs = DB.STORES.map(function (s) { return DB.all(s).then(function (rows) { return [s, rows]; }); });
    return Promise.all(jobs).then(function (pairs) {
      var data = { app: "yemen-zakat-fund", version: EXPORT_VERSION, exportedAt: new Date().toISOString() };
      pairs.forEach(function (p) { data[p[0]] = p[1]; });
      return data;
    });
  }

  /* تصدير JSON (اختياري مشفّر بكلمة مرور) */
  function exportJSON(password) {
    return snapshot().then(function (data) {
      var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      var fname = "zakat-backup-" + stamp + ".json";
      var payload = JSON.stringify(data);
      var p = password ? Crypto.encryptText(payload, password) : Promise.resolve(payload);
      return p.then(function (txt) {
        var out = password ? { app: "yemen-zakat-fund", encrypted: true, payload: txt } : data;
        var content = JSON.stringify(out, null, 1);
        var savedMobile = U.saveFileMobile(fname, content);
        if (!savedMobile) U.download(fname, content, "application/json");
        return fname;
      });
    }).then(function (fname) {
      return Audit.log("نسخ احتياطي", "backup", "تصدير: " + fname).then(function () { return fname; });
    });
  }

  function parseImport(text, password) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return Promise.reject(new Error("الملف ليس نسخة احتياطية صالحة")); }
    var work = Promise.resolve(data);
    if (data && data.encrypted && data.payload) {
      if (!password) return Promise.reject(new Error("النسخة مشفّرة — أدخل كلمة مرور الاستعادة"));
      work = Crypto.decryptText(data.payload, password).then(function (t) { return JSON.parse(t); });
    }
    return work.then(function (d) {
      if (!d || d.app !== "yemen-zakat-fund") throw new Error("الملف ليس نسخة احتياطية لهذا التطبيق");
      return d;
    });
  }

  /* استعادة: استبدال كامل أو دمج */
  function restore(text, password, mode) {
    return parseImport(text, password).then(function (d) {
      var chain = Promise.resolve();
      DB.STORES.forEach(function (store) {
        chain = chain.then(function () {
          if (mode === "replace") return DB.clear(store);
          return Promise.resolve();
        }).then(function () {
          var rows = d[store] || [];
          return rows.length ? DB.bulkPut(store, rows) : Promise.resolve();
        });
      });
      return chain;
    }).then(function () {
      return Audit.log("استعادة", "backup", "استعادة نسخة احتياطية — الوضع: " + (mode === "replace" ? "استبدال" : "دمج"));
    });
  }

  /* استيراد ملف من القرص / أندرويد SAF */
  function pickFile() {
    if (window.AndroidBridge && window.AndroidBridge.pickBackupFile) {
      return new Promise(function (res, rej) {
        window.__onFilePicked = function (b64, name) {
          if (!b64) { rej(new Error("لم يتم اختيار ملف")); return; }
          try {
            var bin = atob(b64), u8 = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            var blob = new Blob([u8], { type: "application/json" });
            var fr = new FileReader();
            fr.onload = function () { res({ text: fr.result, name: name }); };
            fr.onerror = function () { rej(new Error("فشل قراءة الملف")); };
            fr.readAsText(blob, "utf-8");
          } catch (e) { rej(e); }
        };
        var ok = window.AndroidBridge.pickBackupFile();
        if (!ok) rej(new Error("تعذر فتح منتقي الملفات"));
      });
    }
    return new Promise(function (res, rej) {
      var inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".json,application/json";
      inp.onchange = function () {
        var f = inp.files[0];
        if (!f) { rej(new Error("لم يتم اختيار ملف")); return; }
        var fr = new FileReader();
        fr.onload = function () { res({ text: fr.result, name: f.name }); };
        fr.onerror = function () { rej(new Error("فشل قراءة الملف")); };
        fr.readAsText(f, "utf-8");
      };
      inp.click();
    });
  }

  /* تصدير Excel عبر SheetJS (متعدد الأوراق ومنسّق) */
  function exportExcel(sheets, filename) {
    if (typeof XLSX === "undefined") {
      /* تراجع: CSV */
      var csv = sheets.map(function (s) { return U.toCSV(s.headers, s.rows); }).join("\n\n");
      U.download(filename.replace(/\.xlsx$/, ".csv"), csv, "text/csv;charset=utf-8");
      return Promise.resolve(false);
    }
    var wb = XLSX.utils.book_new();
    sheets.forEach(function (s) {
      var ws = XLSX.utils.aoa_to_sheet([s.headers].concat(s.rows));
      /* عرض الأعمدة */
      ws["!cols"] = s.headers.map(function (h, i) {
        var mx = String(h).length;
        s.rows.forEach(function (r) { if (r[i] != null) mx = Math.max(mx, String(r[i]).length); });
        return { wch: Math.min(Math.max(mx + 3, 10), 44) };
      });
      if (s.rows.length) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: s.rows.length, c: s.headers.length - 1 } }) };
      XLSX.utils.book_append_sheet(wb, ws, (s.name || "ورقة").slice(0, 30));
    });
    var out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    var blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var savedMobile = U.saveFileMobile(filename, null) && false; /* أندرويد: نص فقط، لذا نستخدم التنزيل العادي */
    U.download(filename, blob);
    return Promise.resolve(true);
  }

  return { exportJSON: exportJSON, restore: restore, pickFile: pickFile, exportExcel: exportExcel, snapshot: snapshot, parseImport: parseImport };
})();
