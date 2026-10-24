/* views/collections.js — شاشة تحصيل الزكاة + الإيصالات | مازن عبدالوهاب */
"use strict";
var Views = window.Views || {};
Views.Collections = (function () {

  var state = { from: "", to: "", type: "", text: "", provinceId: "", centerId: "", rows: [] };

  function fmtFilters() {
    var u = Auth.session();
    var sc = DB.scopeFilter(u);
    return {
      from: state.from || null, to: state.to || null, type: state.type || null,
      text: state.text || null,
      provinceId: state.provinceId || sc.provinceId || null,
      centerId: state.centerId || sc.centerId || null
    };
  }

  function render(main) {
    var u = Auth.session();
    var isAdmin = u.role === "admin", isManager = u.role === "manager", isClerk = u.role === "clerk";
    var t = U.today(), ms = U.monthStart(t), ys = U.yearStart(t);

    main.innerHTML =
      '<div class="page-head"><h2>💰 تحصيل الزكاة</h2><div class="ph-actions">' +
        '<button class="btn btn-gold btn-sm" id="btn-thermal-page">🖨️ الطابعة الحرارية</button>' +
      '</div></div>' +

      '<div class="card"><h3>➕ تسجيل إيصال جديد</h3><form id="col-form" class="form-grid c3">' +
        '<label class="field"><span>نوع الزكاة *</span><select id="cf-type" required></select></label>' +
        '<label class="field"><span>اسم المؤدّي *</span><input id="cf-payer" required placeholder="الاسم الكامل"></label>' +
        '<label class="field"><span>المبلغ *</span><input id="cf-amount" type="number" min="0" step="any" required placeholder="0"></label>' +
        '<label class="field"><span>الوحدة</span><select id="cf-unit">' +
          '<option value="YER">ريال يمني</option><option value="USD">دولار أمريكي</option><option value="SAR">ريال سعودي</option>' +
          '<option value="head">رأس (أنعام)</option><option value="kg">كجم (غلال/ثمار)</option><option value="sa">ساعة</option></select></label>' +
        '<label class="field"><span>التاريخ *</span><input id="cf-date" type="date" value="' + t + '" required></label>' +
        (isClerk
          ? '<input type="hidden" id="cf-province" value="' + U.esc(u.provinceId || "") + '"><input type="hidden" id="cf-center" value="' + U.esc(u.centerId || "") + '">'
          : '<label class="field"><span>المحافظة *</span><select id="cf-province" required></select></label>' +
            '<label class="field"><span>المركز *</span><select id="cf-center" required></select></label>') +
        '<label class="field full"><span>بيانات / ملاحظات</span><textarea id="cf-notes" rows="2" placeholder="تفاصيل إضافية إن وجدت"></textarea></label>' +
        '<label class="field full"><span>📎 صورة/صور المستند (اختياري — تُحفظ مع الإيصال)</span><input id="cf-files" type="file" accept="image/*" multiple></label>' +
        '<div class="actions-row full"><button type="submit" class="btn btn-primary">💾 حفظ الإيصال</button>' +
        '<button type="reset" class="btn btn-ghost">تفريغ</button></div>' +
      '</form></div>' +

      '<div class="card"><h3>📋 سجل الإيصالات <span class="badge-count" id="col-count">0</span></h3>' +
      '<div class="filters">' +
        '<label class="field"><span>من تاريخ</span><input type="date" id="flt-from" value="' + ms + '"></label>' +
        '<label class="field"><span>إلى تاريخ</span><input type="date" id="flt-to" value="' + t + '"></label>' +
        '<label class="field"><span>نوع الزكاة</span><select id="flt-type"><option value="">الكل</option></select></label>' +
        '<label class="field"><span>بحث</span><input type="search" id="flt-text" placeholder="رقم إيصال/اسم/ملاحظة"></label>' +
      '</div>' +
      '<div id="col-list" class="m-cards"></div>' +
      '<div class="actions-row">' +
        '<button class="btn btn-outline btn-sm" id="col-print">🖨️ طباعة التقرير A4</button>' +
        '<button class="btn btn-outline btn-sm" id="col-excel">📊 تصدير Excel</button>' +
        '<button class="btn btn-outline btn-sm" id="col-pdf">📄 PDF (حفظ كـ PDF)</button>' +
      '</div></div>';

    /* تعبئة القوائم */
    var typeSel = document.getElementById("cf-type");
    Object.keys(U.ZAKAT_TYPES).forEach(function (k) {
      typeSel.insertAdjacentHTML("beforeend", '<option value="' + k + '">' + U.ZAKAT_TYPES[k].icon + " " + U.ZAKAT_TYPES[k].ar + "</option>");
    });
    var ftype = document.getElementById("flt-type");
    Object.keys(U.ZAKAT_TYPES).forEach(function (k) {
      ftype.insertAdjacentHTML("beforeend", '<option value="' + k + '">' + U.ZAKAT_TYPES[k].ar + "</option>");
    });

    Provinces.fillSelect(document.getElementById("cf-province"), isManager ? u.provinceId : null).then(function () {
      var pv = document.getElementById("cf-province");
      if (pv) Centers.fillSelect(document.getElementById("cf-center"), pv.value, isManager ? u.provinceId : null);
    });

    /* أحداث */
    var pvSel = document.getElementById("cf-province");
    if (pvSel) pvSel.addEventListener("change", function () {
      Centers.fillSelect(document.getElementById("cf-center"), this.value);
    });
    document.getElementById("col-form").addEventListener("submit", function (e) { e.preventDefault(); submit(); });
    ["flt-from", "flt-to", "flt-type"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", function () {
        state.from = document.getElementById("flt-from").value;
        state.to = document.getElementById("flt-to").value;
        state.type = document.getElementById("flt-type").value;
        load();
      });
    });
    document.getElementById("flt-text").addEventListener("input", U.debounce(function () {
      state.text = this.value; load();
    }, 300));
    document.getElementById("btn-thermal-page").addEventListener("click", function () { App.go("thermal"); });
    document.getElementById("col-print").addEventListener("click", printReport);
    document.getElementById("col-excel").addEventListener("click", exportXlsx);
    document.getElementById("col-pdf").addEventListener("click", function () { toast("اختر «حفظ كـ PDF» في نافذة الطباعة", "warn"); printReport(); });

    state.from = ms; state.to = t;
    load();
  }

  function submit() {
    var u = Auth.session();
    var pv = document.getElementById("cf-province"), ct = document.getElementById("cf-center");
    var provinceId = (pv && pv.value) || u.provinceId || "";
    var centerId = (ct && ct.value) || u.centerId || "";
    var amount = U.num(document.getElementById("cf-amount").value);
    if (!provinceId || !centerId) { toast("اختر المحافظة والمركز", "err"); return; }
    if (amount <= 0) { toast("أدخل مبلغاً صحيحاً", "err"); return; }

    var files = document.getElementById("cf-files").files;
    var readFiles = Promise.resolve([]);
    if (files && files.length) {
      readFiles = Promise.all(Array.prototype.map.call(files, function (f) {
        return Images.compress(f, 900)["catch"](function () { return null; });
      })).then(function (arr) { return arr.filter(Boolean); });
    }

    readFiles.then(function (imgs) {
      return DB.nextReceiptNo().then(function (no) {
        var rec = {
          id: U.uid(), receiptNo: no, date: document.getElementById("cf-date").value || U.today(),
          type: document.getElementById("cf-type").value,
          payerName: document.getElementById("cf-payer").value.trim(),
          amount: amount, unit: document.getElementById("cf-unit").value,
          provinceId: provinceId, centerId: centerId,
          details: document.getElementById("cf-notes").value.trim(),
          createdBy: u.id, createdByName: u.name, createdAt: Date.now()
        };
        return DB.put("collections", rec).then(function () {
          if (imgs.length) {
            return DB.put("vouchers", { id: "v_" + rec.id, refType: "collection", refId: rec.id, images: imgs, note: "إيصال " + no, createdAt: Date.now() });
          }
        }).then(function () {
          return Audit.log("إضافة", "collections", "إيصال " + no + " بمبلغ " + rec.amount);
        }).then(function () {
          toast("✅ تم حفظ الإيصال رقم " + no, "ok");
          document.getElementById("col-form").reset();
          document.getElementById("cf-date").value = U.today();
          printThermal(rec, true);
          load();
        });
      });
    })["catch"](function (e) { toast("خطأ: " + e.message, "err"); });
  }

  /* إيصال حراري */
  function printThermal(rec, auto) {
    if (!Thermal.status().connected) {
      if (auto) toast("الطابعة غير متصلة — استخدم زر 📄 للطباعة A4 أو صِل الطابعة من صفحة الطابعة الحرارية", "warn");
      return Promise.resolve(false);
    }
    return Promise.all([Provinces.map(), Centers.map()]).then(function (m) {
      return Thermal.printReceipt({
        org: "صندوق تحصيل الزكاة", header2: "الجمهورية اليمنية",
        receiptNo: rec.receiptNo, date: U.fmtDate(rec.date), time: U.nowTime(),
        type: U.typeName(rec.type), payer: rec.payerName,
        province: (m[0][rec.provinceId] || ""), center: (m[1][rec.centerId] || ""),
        amount: U.money(rec.amount) + " " + U.unitName(rec.unit),
        details: rec.details, clerk: rec.createdByName || "",
        qr: "ZK|" + rec.receiptNo + "|" + rec.amount + "|" + rec.date
      });
    }).then(function () { toast("🖨️ أُرسل الإيصال إلى الطابعة"); })["catch"](function (e) { toast("فشل الطباعة: " + e.message, "err"); });
  }

  function load() {
    var el = document.getElementById("col-list");
    if (!el) return;
    DB.queryCollections(fmtFilters()).then(function (rows) {
      state.rows = rows;
      var t = DB.totals(rows);
      document.getElementById("col-count").textContent = rows.length + " إيصال · " + U.money(t.amount) + " ريال";
      if (!rows.length) { el.innerHTML = '<div class="empty"><div class="e-ico">📭</div>لا توجد إيصالات في هذه الفترة</div>'; return; }
      var body = rows.map(function (x) {
        return '<tr>' +
          '<td>' + U.esc(x.receiptNo) + '</td>' +
          '<td>' + U.esc(U.fmtDate(x.date)) + '</td>' +
          '<td>' + U.typeIcon(x.type) + " " + U.esc(U.typeName(x.type)) + '</td>' +
          '<td>' + U.esc(x.payerName) + '</td>' +
          '<td class="num">' + U.money(x.amount) + " " + U.esc(U.unitName(x.unit)) + '</td>' +
          '<td>' + U.esc(Centers.nameOf(x.centerId) || "—") + '</td>' +
          '<td class="actions">' +
            '<button class="btn btn-sm btn-outline" data-th="' + x.id + '" title="طباعة حرارية">🖨️</button> ' +
            '<button class="btn btn-sm btn-outline" data-a4="' + x.id + '" title="إيصال A4">📄</button> ' +
            (Auth.session().role !== "clerk" ? '<button class="btn btn-sm btn-danger" data-del="' + x.id + '" title="حذف">🗑</button>' : "") +
          '</td></tr>';
      }).join("");
      el.innerHTML =
        '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
        "<th>الإيصال</th><th>التاريخ</th><th>النوع</th><th>المؤدّي</th><th>المبلغ</th><th>المركز</th><th>إجراءات</th>" +
        "</tr></thead><tbody>" + body + "</tbody></table></div>" +
        '<div class="m-list">' + rows.map(function (x) {
          return '<div class="m-item"><div class="mi-top"><span class="mi-title">' + U.esc(x.payerName) + '</span><span class="mi-amount">' + U.money(x.amount) + " " + U.esc(U.unitName(x.unit)) + "</span></div>" +
            '<div class="mi-row"><span>' + U.esc(x.receiptNo) + " · " + U.esc(U.fmtDate(x.date)) + '</span><span>' + U.typeIcon(x.type) + " " + U.esc(U.typeName(x.type)) + "</span></div>" +
            '<div class="mi-row"><span>' + U.esc(Centers.nameOf(x.centerId) || "—") + '</span><span class="mi-actions">' +
            '<button class="btn btn-sm btn-outline" data-th="' + x.id + '">🖨️ حراري</button> ' +
            '<button class="btn btn-sm btn-outline" data-a4="' + x.id + '">📄 A4</button> ' +
            (Auth.session().role !== "clerk" ? '<button class="btn btn-sm btn-danger" data-del="' + x.id + '">🗑</button>' : "") +
            "</span></div></div>";
        }).join("") + "</div>";

      el.onclick = function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        var rec;
        if (b.dataset.th) { rec = find(b.dataset.th); if (rec) printThermal(rec); }
        else if (b.dataset.a4) { rec = find(b.dataset.a4); if (rec) printA4(rec); }
        else if (b.dataset.del) { del(b.dataset.del); }
      };
    });
  }
  function find(id) { for (var i = 0; i < state.rows.length; i++) if (state.rows[i].id === id) return state.rows[i]; return null; }

  function del(id) {
    if (!confirm("هل أنت متأكد من حذف هذا الإيصال؟ سيُسجَّل ذلك في سجل التدقيق.")) return;
    var rec = find(id);
    DB.del("collections", id).then(function () {
      return DB.del("vouchers", "v_" + id);
    }).then(function () {
      return Audit.log("حذف", "collections", "حذف إيصال " + (rec ? rec.receiptNo : id) + " مبلغ " + (rec ? rec.amount : ""));
    }).then(function () { toast("تم الحذف", "warn"); load(); });
  }

  function printA4(rec) {
    Promise.all([Provinces.map(), Centers.map()]).then(function (m) {
      return PrintGov.printReceiptA4({
        receiptNo: rec.receiptNo, date: U.fmtDate(rec.date), time: U.nowTime(),
        type: U.typeName(rec.type), payer: rec.payerName,
        amount: U.money(rec.amount), unit: U.unitName(rec.unit),
        province: m[0][rec.provinceId] || "—", center: m[1][rec.centerId] || "—",
        details: rec.details || "—", clerk: rec.createdByName || "—",
        qr: "ZK|" + rec.receiptNo + "|" + rec.amount + "|" + rec.date
      });
    }).then(function () { return Audit.log("طباعة", "collections", "إيصال A4 " + rec.receiptNo); });
  }

  function printReport() {
    Reports.collectionsReport(fmtFilters()).then(function (rep) { return Reports.print(rep); });
  }
  function exportXlsx() {
    Reports.collectionsReport(fmtFilters()).then(function (rep) { return Reports.excel(rep, "تقرير-التحصيل.xlsx"); })
      .then(function () { toast("📊 تم تصدير Excel"); });
  }

  return { render: render, printThermal: printThermal };
})();

/* ===== معالجة الصور (ضغط إلى dataURL) ===== */
var Images = (function () {
  function compress(file, maxPx) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\//.test(file.type)) { rej(new Error("ليست صورة")); return; }
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var scale = Math.min(1, (maxPx || 900) / Math.max(im.width, im.height));
          var cv = document.createElement("canvas");
          cv.width = Math.round(im.width * scale); cv.height = Math.round(im.height * scale);
          cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
          res(cv.toDataURL("image/jpeg", 0.72));
        };
        im.onerror = function () { rej(new Error("صورة غير صالحة")); };
        im.src = fr.result;
      };
      fr.onerror = function () { rej(new Error("فشل القراءة")); };
      fr.readAsDataURL(file);
    });
  }
  return { compress: compress };
})();
