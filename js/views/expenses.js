/* views/expenses.js — المصروفات على الفئات الثماني المستحقة | مازن عبدالوهاب */
"use strict";
var Views = window.Views || {};
Views.Expenses = (function () {

  var state = { from: "", to: "", category: "", text: "", rows: [] };

  function fmtFilters() {
    var u = Auth.session(), sc = DB.scopeFilter(u);
    return {
      from: state.from || null, to: state.to || null, category: state.category || null, text: state.text || null,
      provinceId: sc.provinceId, centerId: sc.centerId
    };
  }

  function render(main) {
    var u = Auth.session(), isClerk = u.role === "clerk";
    var t = U.today(), ms = U.monthStart(t);

    var catOpts = U.CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + c.ar + "</option>"; }).join("");

    main.innerHTML =
      '<div class="page-head"><h2>🤲 المصروفات والمستحقون</h2></div>' +
      '<div class="alert">📖 <span>الصرف يكون على <b>الفئات الثماني</b> المذكورة في قوله تعالى: «إِنَّمَا الصَّدَقَاتُ لِلْفُقَرَاءِ وَالْمَسَاكِينِ وَالْعَامِلِينَ عَلَيْهَا وَالْمُؤَلَّفَةِ قُلُوبُهُمْ وَفِي الرِّقَابِ وَالْغَارِمِينَ وَفِي سَبِيلِ اللَّهِ وَابْنِ السَّبِيلِ» (التوبة: 60)</span></div>' +

      '<div class="card"><h3>➕ تسجيل مصروف / صرفية</h3><form id="exp-form" class="form-grid c3">' +
        '<label class="field"><span>الفئة المستحقة *</span><select id="ef-cat" required>' + catOpts + "</select></label>" +
        '<label class="field"><span>اسم المستحق / الجهة *</span><input id="ef-ben" required placeholder="اسم المستفيد أو وصف الجهة"></label>' +
        '<label class="field"><span>المبلغ *</span><input id="ef-amount" type="number" min="0" step="any" required placeholder="0"></label>' +
        '<label class="field"><span>التاريخ *</span><input id="ef-date" type="date" value="' + t + '" required></label>' +
        (isClerk
          ? '<input type="hidden" id="ef-province" value="' + U.esc(u.provinceId || "") + '"><input type="hidden" id="ef-center" value="' + U.esc(u.centerId || "") + '">'
          : '<label class="field"><span>المحافظة *</span><select id="ef-province" required></select></label>' +
            '<label class="field"><span>المركز *</span><select id="ef-center" required></select></label>') +
        '<label class="field full"><span>البيان</span><textarea id="ef-notes" rows="2" placeholder="وصف الصرفية"></textarea></label>' +
        '<label class="field full"><span>📎 مستند الصرفية (اختياري)</span><input id="ef-files" type="file" accept="image/*" multiple></label>' +
        '<div class="actions-row full"><button type="submit" class="btn btn-primary">💾 حفظ الصرفية</button></div>' +
      '</form></div>' +

      '<div class="card"><h3>📋 سجل المصروفات <span class="badge-count" id="exp-count">0</span></h3>' +
      '<div class="filters">' +
        '<label class="field"><span>من تاريخ</span><input type="date" id="efl-from" value="' + ms + '"></label>' +
        '<label class="field"><span>إلى تاريخ</span><input type="date" id="efl-to" value="' + t + '"></label>' +
        '<label class="field"><span>الفئة</span><select id="efl-cat"><option value="">الكل</option>' + catOpts + "</select></label>" +
        '<label class="field"><span>بحث</span><input type="search" id="efl-text" placeholder="اسم/بيان"></label>' +
      '</div>' +
      '<div id="exp-list" class="m-cards"></div>' +
      '<div class="actions-row">' +
        '<button class="btn btn-outline btn-sm" id="exp-print">🖨️ طباعة التقرير A4</button>' +
        '<button class="btn btn-outline btn-sm" id="exp-excel">📊 تصدير Excel</button>' +
        '<button class="btn btn-outline btn-sm" id="exp-cats">📊 تقرير الفئات الثماني</button>' +
      '</div></div>';

    Provinces.fillSelect(document.getElementById("ef-province"), u.role === "manager" ? u.provinceId : null).then(function () {
      var pv = document.getElementById("ef-province");
      if (pv) Centers.fillSelect(document.getElementById("ef-center"), pv.value, u.role === "manager" ? u.provinceId : null);
    });

    var pvSel = document.getElementById("ef-province");
    if (pvSel) pvSel.addEventListener("change", function () { Centers.fillSelect(document.getElementById("ef-center"), this.value); });
    document.getElementById("exp-form").addEventListener("submit", function (e) { e.preventDefault(); submit(); });
    ["efl-from", "efl-to", "efl-cat"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", function () {
        state.from = document.getElementById("efl-from").value;
        state.to = document.getElementById("efl-to").value;
        state.category = document.getElementById("efl-cat").value;
        load();
      });
    });
    document.getElementById("efl-text").addEventListener("input", U.debounce(function () { state.text = this.value; load(); }, 300));
    document.getElementById("exp-print").addEventListener("click", function () {
      Reports.expensesReport(fmtFilters()).then(function (r) { return Reports.print(r); });
    });
    document.getElementById("exp-excel").addEventListener("click", function () {
      Reports.expensesReport(fmtFilters()).then(function (r) { return Reports.excel(r, "تقرير-المصروفات.xlsx"); }).then(function () { toast("📊 تم التصدير"); });
    });
    document.getElementById("exp-cats").addEventListener("click", function () {
      Reports.categoriesReport(fmtFilters()).then(function (r) { return Reports.print(r); });
    });

    state.from = ms; state.to = t;
    load();
  }

  function submit() {
    var u = Auth.session();
    var pv = document.getElementById("ef-province"), ct = document.getElementById("ef-center");
    var provinceId = (pv && pv.value) || u.provinceId || "";
    var centerId = (ct && ct.value) || u.centerId || "";
    var amount = U.num(document.getElementById("ef-amount").value);
    if (!provinceId || !centerId) { toast("اختر المحافظة والمركز", "err"); return; }
    if (amount <= 0) { toast("أدخل مبلغاً صحيحاً", "err"); return; }

    var files = document.getElementById("ef-files").files;
    var readFiles = files && files.length
      ? Promise.all(Array.prototype.map.call(files, function (f) { return Images.compress(f, 900)["catch"](function () { return null; }); })).then(function (a) { return a.filter(Boolean); })
      : Promise.resolve([]);

    readFiles.then(function (imgs) {
      var rec = {
        id: U.uid(), date: document.getElementById("ef-date").value || U.today(),
        category: document.getElementById("ef-cat").value,
        beneficiaryName: document.getElementById("ef-ben").value.trim(),
        amount: amount, provinceId: provinceId, centerId: centerId,
        details: document.getElementById("ef-notes").value.trim(),
        createdBy: u.id, createdByName: u.name, createdAt: Date.now()
      };
      return DB.put("expenses", rec).then(function () {
        if (imgs.length) return DB.put("vouchers", { id: "v_" + rec.id, refType: "expense", refId: rec.id, images: imgs, note: "صرفية " + rec.beneficiaryName, createdAt: Date.now() });
      }).then(function () {
        return Audit.log("إضافة", "expenses", "صرفية لـ " + rec.beneficiaryName + " مبلغ " + rec.amount + " (" + U.catName(rec.category) + ")");
      }).then(function () {
        toast("✅ تم حفظ الصرفية");
        document.getElementById("exp-form").reset();
        document.getElementById("ef-date").value = U.today();
        load();
      });
    })["catch"](function (e) { toast("خطأ: " + e.message, "err"); });
  }

  function load() {
    var el = document.getElementById("exp-list");
    if (!el) return;
    DB.queryExpenses(fmtFilters()).then(function (rows) {
      state.rows = rows;
      var t = DB.totals(rows);
      document.getElementById("exp-count").textContent = rows.length + " عملية · " + U.money(t.amount) + " ريال";
      if (!rows.length) { el.innerHTML = '<div class="empty"><div class="e-ico">📭</div>لا توجد صرفيات في هذه الفترة</div>'; return; }
      var body = rows.map(function (x) {
        return '<tr>' +
          '<td>' + U.esc(U.fmtDate(x.date)) + '</td>' +
          '<td><span class="chip green">' + U.esc(U.catName(x.category)) + "</span></td>" +
          '<td>' + U.esc(x.beneficiaryName) + '</td>' +
          '<td class="num">' + U.money(x.amount) + '</td>' +
          '<td>' + U.esc(Centers.nameOf(x.centerId) || "—") + '</td>' +
          '<td>' + (Auth.session().role !== "clerk" ? '<button class="btn btn-sm btn-danger" data-del="' + x.id + '">🗑</button>' : "—") + '</td></tr>';
      }).join("");
      el.innerHTML =
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>التاريخ</th><th>الفئة</th><th>المستحق</th><th>المبلغ</th><th>المركز</th><th></th></tr></thead><tbody>' +
        body + "</tbody></table></div>" +
        '<div class="m-list">' + rows.map(function (x) {
          return '<div class="m-item"><div class="mi-top"><span class="mi-title">' + U.esc(x.beneficiaryName) + '</span><span class="mi-amount">' + U.money(x.amount) + "</span></div>" +
            '<div class="mi-row"><span class="chip green">' + U.esc(U.catName(x.category)) + "</span><span>" + U.esc(U.fmtDate(x.date)) + "</span></div>" +
            '<div class="mi-row"><span>' + U.esc(Centers.nameOf(x.centerId) || "—") + "</span>" +
            (Auth.session().role !== "clerk" ? '<button class="btn btn-sm btn-danger" data-del="' + x.id + '">🗑</button>' : "") + "</div></div>";
        }).join("") + "</div>";
      el.onclick = function (e) {
        var b = e.target.closest("button");
        if (b && b.dataset.del) del(b.dataset.del);
      };
    });
  }
  function find(id) { for (var i = 0; i < state.rows.length; i++) if (state.rows[i].id === id) return state.rows[i]; return null; }
  function del(id) {
    if (!confirm("تأكيد حذف الصرفية؟")) return;
    var rec = find(id);
    DB.del("expenses", id).then(function () { return DB.del("vouchers", "v_" + id); })
      .then(function () { return Audit.log("حذف", "expenses", "حذف صرفية " + (rec ? rec.beneficiaryName : id)); })
      .then(function () { toast("تم الحذف", "warn"); load(); });
  }

  return { render: render };
})();
