/* utils.js — أدوات عامة | مازن عبدالوهاب */
"use strict";
var U = (function () {
  var AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function nowTime() { var d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function fmtDate(iso) {
    if (!iso) return "—";
    var p = String(iso).split("-");
    if (p.length < 3) return iso;
    return parseInt(p[2], 10) + " " + (AR_MONTHS[parseInt(p[1], 10) - 1] || p[1]) + " " + p[0];
  }
  function fmtDateTime(ts) {
    if (!ts) return "—";
    var d = new Date(ts);
    return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function monthStart(iso) { return String(iso || today()).slice(0, 8) + "01"; }
  function yearStart(iso) { return String(iso || today()).slice(0, 5) + "01-01"; }
  function arabicMonth(mIdx) { return AR_MONTHS[mIdx] || ""; }

  /* أرقام وتنسيق مالي */
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function money(v) {
    return num(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  function money2(v) { return num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  var ZAKAT_TYPES = {
    money:    { ar: "زكاة المال",          icon: "💰" },
    trade:    { ar: "زكاة التجارة",        icon: "🏪" },
    fitr:     { ar: "زكاة الفطر",          icon: "🌾" },
    livestock:{ ar: "زكاة الأنعام",        icon: "🐐" },
    crops:    { ar: "زكاة الزروع والثمار", icon: "🌱" },
    charity:  { ar: "سُبل الخير والتبرعات", icon: "🎁" }
  };
  var UNITS = { YER: "ريال يمني", USD: "دولار", SAR: "ريال سعودي", head: "رأس", kg: "كجم", sa: "ساعة" };

  /* الفئات الثمانية المستحقة (الآية 60 - التوبة) */
  var CATEGORIES = [
    { id: "poor",      ar: "الفقراء" },
    { id: "needy",     ar: "المساكين" },
    { id: "workers",   ar: "العاملون عليها" },
    { id: "hearts",    ar: "المؤلفة قلوبهم" },
    { id: "captives",  ar: "في الرقاب" },
    { id: "debtors",   ar: "الغارمون" },
    { id: "cause",     ar: "في سبيل الله" },
    { id: "wayfarer",  ar: "ابن السبيل" }
  ];
  function catName(id) { for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i].ar; return id; }
  function typeName(id) { return (ZAKAT_TYPES[id] || {}).ar || id; }
  function typeIcon(id) { return (ZAKAT_TYPES[id] || {}).icon || "📄"; }
  function unitName(u) { return UNITS[u] || u || "ريال يمني"; }

  /* IDs */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  /* فترة أشهر */
  function monthsBetween(fromISO, toISO) {
    var out = [], f = new Date(fromISO + "T00:00:00"), t = new Date(toISO + "T00:00:00");
    var y = f.getFullYear(), m = f.getMonth();
    while (y < t.getFullYear() || (y === t.getFullYear() && m <= t.getMonth())) {
      out.push(y + "-" + pad(m + 1));
      m++; if (m > 11) { m = 0; y++; }
    }
    return out;
  }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 250); }; }

  /* تنزيل ملف عام */
  function download(filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || "application/octet-stream" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function csvEscape(v) { v = String(v == null ? "" : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(headers, rows) {
    var lines = [headers.map(csvEscape).join(",")];
    rows.forEach(function (r) { lines.push(r.map(csvEscape).join(",")); });
    return "\uFEFF" + lines.join("\r\n");
  }

  /* نسخ للأندرويد: حفظ النسخ الاحتياطية */
  function saveFileMobile(filename, content) {
    if (window.AndroidBridge && typeof window.AndroidBridge.saveBackup === "function") {
      return window.AndroidBridge.saveBackup(filename, content);
    }
    return false;
  }
  function isAndroid() { return !!(window.AndroidBridge); }

  return {
    today: today, nowTime: nowTime, fmtDate: fmtDate, fmtDateTime: fmtDateTime,
    monthStart: monthStart, yearStart: yearStart, arabicMonth: arabicMonth, monthsBetween: monthsBetween,
    num: num, money: money, money2: money2,
    ZAKAT_TYPES: ZAKAT_TYPES, CATEGORIES: CATEGORIES, UNITS: UNITS,
    catName: catName, typeName: typeName, typeIcon: typeIcon, unitName: unitName,
    uid: uid, esc: esc, debounce: debounce, download: download, toCSV: toCSV,
    isAndroid: isAndroid, saveFileMobile: saveFileMobile
  };
})();
