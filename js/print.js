/* print.js — محرك الطباعة الرسمي A4 (نمط حكومي) لكل التقارير والإيصالات
   إصدار 2: معاينة ورقية قبل الطباعة + إصلاح الصفحة البيضاء نهائياً
   (كان المحتوى يُمسح بعد 600ms بينما مهمة طباعة أندرويد لا تزال تجمع المستند)
   مازن عبدالوهاب */
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
      '<span>التطبيق: صندوق تحصيل الزكاة v1.1.0</span>' +
    '</div>' +
    '<div class="gov-signs">' +
      '<div class="sig"><div>المحاسب</div><div class="line">الاسم والتوقيع</div></div>' +
      '<div class="sig"><div class="gov-stamp">خاتم<br>صندوق تحصيل الزكاة</div></div>' +
      '<div class="sig"><div>مدير الصندوق / الفرع</div><div class="line">الاسم والتوقيع والخاتم</div></div>' +
    '</div>' +
    '<div class="gov-credits">تطوير وبرمجة مازن عبدالوهاب — إدارة محاسبة صدام نجم الدين — جميع الحقوق محفوظة لشركة yemen coding</div>';
  }

  /* ============ التشغيل: معاينة ثم طباعة (بدون مسح المحتوى) ============ */
  var _pendingTitle = "مستند";

  function openPreview(html, title, beforePrint) {
    var root = document.getElementById("print-root");
    root.innerHTML = html;
    document.getElementById("pt-doc").textContent = title || "مستند";
    document.body.classList.add("print-open");
    if (beforePrint) beforePrint();
    /* ترحيل لأعلى المعاينة */
    var stage = document.querySelector(".print-stage");
    if (stage) stage.scrollTop = 0;
    return Promise.resolve();
  }

  /* زر الطباعة داخل المعاينة — المحتوى يبقى حتى يغلق المستخدم المعاينة */
  function doPrint() {
    try {
      if (window.AndroidBridge && window.AndroidBridge.printPage) {
        /* أندرويد: مدير الطباعة الأصلي (يشمل حفظ PDF) — لا نمسح المحتوى أبداً قبل انتهاء المهمة */
        window.AndroidBridge.printPage();
      } else {
        window.print();
      }
    } catch (e) {
      try { window.print(); } catch (e2) {}
    }
  }

  function closePreview() {
    document.body.classList.remove("print-open");
    document.getElementById("print-root").innerHTML = "";
  }

  /* تكوين تقرير كامل ثم فتح المعاينة (تُطبع تلقائياً بعد ثوانٍ) */
  function printReport(cfg) {
    /* cfg: {title, meta:[[k,v]], headers, rows, foot, sums, extraHTML, autoPrint} */
    var html = '<div class="gov-page">' +
      head(cfg) +
      '<div class="gov-title"><h2>' + U.esc(cfg.title) + "</h2></div>" +
      (cfg.meta ? meta(cfg) : "") +
      (cfg.extraHTML || "") +
      table(cfg.headers, cfg.rows, cfg.foot) +
      (cfg.sums ? sumBoxes(cfg.sums) : "") +
      foot(cfg) +
    "</div>";
    return openPreview(html, cfg.title, null).then(function () {
      /* طباعة تلقائية مريحة بعد عرض المعاينة — تعمل على الويب وأندرويد */
      if (cfg.autoPrint !== false) {
        setTimeout(function () { if (document.body.classList.contains("print-open")) doPrint(); }, 900);
      }
    });
  }

  /* إيصال A4 نسختين (المؤدي + الصندوق) */
  function printReceiptA4(d) {
    var kv = function (k, v) { return "<tr><th style='width:32%'>" + U.esc(k) + "</th><td>" + U.esc(v == null ? "—" : v) + "</td></tr>"; };
    var one = function (copy) {
      return '<div class="pb" style="page-break-after:' + (copy === 1 ? "always" : "auto") + '">' +
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
    return openPreview(html, "إيصال " + d.receiptNo, function () {
      try {
        if (typeof QRCode !== "undefined") {
          [1, 2].forEach(function (i) {
            var el = document.getElementById("gov-qr-" + i);
            if (el) new QRCode(el, { text: d.qr || d.receiptNo, width: 62, height: 62, correctLevel: QRCode.CorrectLevel.M });
          });
        }
      } catch (e) {}
    }).then(function () {
      setTimeout(function () { if (document.body.classList.contains("print-open")) doPrint(); }, 900);
    });
  }

  function initToolbar() {
    var p = document.getElementById("pt-print");
    var c = document.getElementById("pt-close");
    if (p) p.onclick = doPrint;
    if (c) c.onclick = closePreview;
    /* ESC يغلق المعاينة */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("print-open")) closePreview();
    });
    /* بعد انتهاء حوار الطباعة على الويب: أبقِ المعاينة مفتوحة (المستخدم يغلقها بنفسه) */
  }

  return {
    printReport: printReport, printReceiptA4: printReceiptA4,
    head: head, table: table, doPrint: doPrint, closePreview: closePreview,
    initToolbar: initToolbar
  };
})();
