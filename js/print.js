/* print.js — محرك الطباعة الرسمي A4 (نمط حكومي) لكل التقارير والإيصالات
   يحوّل أي تقرير إلى صفحة طباعة ثم window.print() | مازن عبدالوهاب */
"use strict";
var PrintGov = (function () {

  function logoImg() { return '<img src="assets/logo.svg" alt="شعار الزكاة">'; }

  /* رأس رسمي */
  function head(opts) {
    opts = opts || {};
    return '<div class="gov-head">' +
      logoImg() +
      '<div class="gov-head-t">' +
        '<div class="g1">' + U.esc(opts.country || "الجمهورية اليمنية") + '</div>' +
        '<div class="g2">' + U.esc(opts.ministry || "الجهاز المركزي للزكاة") + '</div>' +
        '<div class="g3">' + U.esc(opts.org || "صندوق تحصيل الزكاة") + '</div>' +
      '</div>' + logoImg() +
    '</div>';
  }

  function meta(cfg) {
    var parts = [];
    (cfg.meta || []).forEach(function (m) { parts.push("<span><b>" + U.esc(m[0]) + ":</b> " + U.esc(m[1]) + "</span>"); });
    return '<div class="gov-meta">' + parts.join("") + '</div>';
  }

  /* جدول بيانات: headers[], rows[][], foot[] */
  function table(headers, rows, foot) {
    var h = '<table class="gov-tbl"><thead><tr>';
    headers.forEach(function (x) { h += "<th>" + U.esc(x) + "</th>"; });
    h += "</tr></thead><tbody>";
    if (!rows.length) h += '<tr><td colspan="' + headers.length + '" style="text-align:center">لا توجد بيانات</td></tr>';
    rows.forEach(function (r) {
      h += "<tr>";
      r.forEach(function (c) { h += "<td>" + (c == null ? "" : c) + "</td>"; });
      h += "</tr>";
    });
    h += "</tbody>";
    if (foot && foot.length) {
      h += "<tfoot><tr>";
      foot.forEach(function (c) { h += "<td>" + (c == null ? "" : c) + "</td>"; });
      h += "</tr></tfoot>";
    }
    h += "</table>";
    return h;
  }

  function sumBoxes(items) {
    var s = '<div class="gov-sum">';
    items.forEach(function (it) { s += '<div class="gs">' + U.esc(it.label) + "<b>" + U.esc(it.value) + "</b></div>"; });
    s += "</div>";
    return s;
  }

  function foot(cfg) {
    var u = Auth.session() || {};
    return '<div class="gov-foot">' +
      '<span>أُصدر بتاريخ: ' + U.esc(U.today()) + " — " + U.esc(U.nowTime()) + '</span>' +
      '<span>بواسطة: ' + U.esc(u.name || "—") + " (" + U.esc(Auth.roleAr()) + ')</span>' +
      '<span>التطبيق: صندوق تحصيل الزكاة v1.0.0</span>' +
    '</div>' +
    '<div class="gov-signs">' +
      '<div class="sig"><div>المحاسب</div><div class="line">الاسم والتوقيع</div></div>' +
      '<div class="sig"><div class="gov-stamp">خاتم<br>صندوق تحصيل الزكاة</div></div>' +
      '<div class="sig"><div>مدير الصندوق / الفرع</div><div class="line">الاسم والتوقيع والخاتم</div></div>' +
    '</div>' +
    '<div class="gov-credits">تطوير وبرمجة مازن عبدالوهاب — إدارة محاسبة صدام نجم الدين — جميع الحقوق محفوظة لشركة yemen coding</div>';
  }

  /* تكوين تقرير كامل ثم طباعة */
  function printReport(cfg) {
    /* cfg: {title, meta:[[k,v]], headers, rows, foot, sums, extraHTML} */
    var html = '<div class="gov-page">' +
      head(cfg) +
      '<div class="gov-title"><h2>' + U.esc(cfg.title) + "</h2></div>" +
      (cfg.meta ? meta(cfg) : "") +
      (cfg.extraHTML || "") +
      table(cfg.headers, cfg.rows, cfg.foot) +
      (cfg.sums ? sumBoxes(cfg.sums) : "") +
      foot(cfg) +
    "</div>";
    return run(html);
  }

  /* إيصال A4 نسختين (المؤدي + الصندوق) */
  function printReceiptA4(d) {
    var kv = function (k, v) { return "<tr><th style='width:32%'>" + U.esc(k) + "</th><td>" + U.esc(v == null ? "—" : v) + "</td></tr>"; };
    var one = function (copy) {
      return '<div style="page-break-after:' + (copy === 1 ? "always" : "auto") + '">' +
        head(d) +
        '<div class="gov-title"><h2>إيصال تحصيل زكاة رسمي (' + (copy === 1 ? "نسخة المؤدّي" : "نسخة الصندوق") + ")</h2></div>" +
        '<div class="gov-meta"><span><b>رقم الإيصال:</b> ' + U.esc(d.receiptNo) + "</span><span><b>التاريخ:</b> " + U.esc(d.date) + "</span><span><b>الوقت:</b> " + U.esc(d.time) + "</span></div>" +
        '<table class="gov-tbl"><tbody>' +
          kv("نوع الزكاة", d.type) +
          kv("اسم المؤدّي", d.payer) +
          kv("المبلغ", d.amount + " " + (d.unit || "ريال يمني")) +
          kv("المحافظة", d.province) +
          kv("المركز", d.center) +
          kv("بيانات / ملاحظات", d.details) +
          kv("المحصل (الموظف)", d.clerk) +
        "</tbody></table>" +
        '<div style="margin-top:10px;display:flex;align-items:center;gap:10px"><span style="font-size:11px">رمز التحقق QR:</span><span id="gov-qr-' + copy + '"></span></div>' +
        foot(d) + "</div>";
    };
    var html = '<div class="gov-page">' + one(1) + one(2) + "</div>";
    return run(html, function () {
      try {
        if (typeof QRCode !== "undefined") {
          [1, 2].forEach(function (i) {
            var el = document.getElementById("gov-qr-" + i);
            if (el) new QRCode(el, { text: d.qr || d.receiptNo, width: 62, height: 62, correctLevel: QRCode.CorrectLevel.M });
          });
        }
      } catch (e) {}
    });
  }

  function run(html, beforePrint) {
    var root = document.getElementById("print-root");
    root.innerHTML = html;
    if (beforePrint) beforePrint();
    setTimeout(function () {
      try {
        /* في WebView أندرويد: عبر مدير الطباعة الأصلي (يحتوي «حفظ كـ PDF» أيضاً) */
        if (window.AndroidBridge && window.AndroidBridge.printPage) {
          window.AndroidBridge.printPage();
        } else {
          window.print();
        }
      } finally { setTimeout(function () { root.innerHTML = ""; }, 600); }
    }, 250);
    return Promise.resolve();
  }

  return { printReport: printReport, printReceiptA4: printReceiptA4, head: head, table: table };
})();
