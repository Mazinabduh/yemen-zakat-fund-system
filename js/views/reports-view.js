/* views/reports-view.js — مركز التقارير مع الرسوم البيانية والطباعة | مازن عبدالوهاب */
"use strict";
var Views = window.Views || {};
Views.ReportsView = (function () {

  var chart1 = null, chart2 = null;

  function render(main) {
    var t = U.today();
    var u = Auth.session();
    main.innerHTML =
      '<div class="page-head"><h2>📊 مركز التقارير</h2></div>' +
      '<div class="card"><h3>🔎 اختر التقرير والفترة</h3><div class="form-grid c3">' +
        '<label class="field"><span>نوع التقرير</span><select id="rp-type">' +
          '<option value="collections">💰 تقرير التحصيل</option>' +
          '<option value="expenses">🤲 تقرير المصروفات</option>' +
          '<option value="categories">🧾 تقرير الفئات الثماني</option>' +
          '<option value="cmp_province">🏛️ مقارنة المحافظات</option>' +
          '<option value="cmp_center">🏢 مقارنة المراكز</option>' +
          '<option value="ledger">📒 دفتر اليومية</option>' +
          '<option value="balance">⚖️ الميزانية المبسطة</option>' +
        "</select></label>" +
        '<label class="field"><span>من تاريخ</span><input type="date" id="rp-from" value="' + U.yearStart(t) + '"></label>' +
        '<label class="field"><span>إلى تاريخ</span><input type="date" id="rp-to" value="' + t + '"></label>' +
        '<label class="field"><span>المحافظة</span><select id="rp-province"><option value="">الكل</option></select></label>' +
        '<label class="field"><span>المركز</span><select id="rp-center"><option value="">الكل</option></select></label>' +
        '<div class="actions-row full" style="align-items:end">' +
          '<button class="btn btn-primary" id="rp-run">📈 عرض التقرير</button>' +
          '<button class="btn btn-outline" id="rp-print">🖨️ طباعة A4</button>' +
          '<button class="btn btn-outline" id="rp-excel">📊 Excel</button>' +
          '<button class="btn btn-ghost" data-preset="day">اليوم</button>' +
          '<button class="btn btn-ghost" data-preset="month">هذا الشهر</button>' +
          '<button class="btn btn-ghost" data-preset="year">هذه السنة</button>' +
        "</div>" +
      '</div></div>' +
      '<div id="rp-out"></div>';

    Provinces.fillSelect(document.getElementById("rp-province")).then(function () {
      var u2 = Auth.session();
      if (u2.role === "manager" && u2.provinceId) document.getElementById("rp-province").value = u2.provinceId;
      refreshCenters();
    });
    document.getElementById("rp-province").addEventListener("change", refreshCenters);
    function refreshCenters() {
      Centers.fillSelect(document.getElementById("rp-center"), document.getElementById("rp-province").value);
    }
    document.querySelectorAll("[data-preset]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.dataset.preset;
        document.getElementById("rp-from").value = p === "day" ? t : p === "month" ? U.monthStart(t) : U.yearStart(t);
        document.getElementById("rp-to").value = t;
      });
    });
    document.getElementById("rp-run").addEventListener("click", run);
    document.getElementById("rp-print").addEventListener("click", function () { act("print"); });
    document.getElementById("rp-excel").addEventListener("click", function () { act("excel"); });

    function filters() {
      var sc = DB.scopeFilter(u);
      return {
        from: document.getElementById("rp-from").value || null,
        to: document.getElementById("rp-to").value || null,
        provinceId: document.getElementById("rp-province").value || sc.provinceId || null,
        centerId: document.getElementById("rp-center").value || sc.centerId || null
      };
    }
    function build() {
      var f = filters(), type = document.getElementById("rp-type").value;
      if (type === "collections") return Reports.collectionsReport(f);
      if (type === "expenses") return Reports.expensesReport(f);
      if (type === "categories") return Reports.categoriesReport(f);
      if (type === "cmp_province") return Reports.comparisonReport(f, "province");
      if (type === "cmp_center") return Reports.comparisonReport(f, "center");
      if (type === "ledger") return Reports.ledgerReport(f);
      if (type === "balance") return Reports.balanceReport(f);
      return Reports.collectionsReport(f);
    }
    function act(what) {
      build().then(function (rep) {
        if (what === "print") return Reports.print(rep);
        return Reports.excel(rep, rep.title.replace(/[\\/:*?"<>|]/g, "") + ".xlsx").then(function () { toast("📊 تم التصدير"); });
      })["catch"](function (e) { toast(e.message, "err"); });
    }
    function run() {
      var box = document.getElementById("rp-out");
      box.innerHTML = '<div class="card"><div class="empty">⏳ جارٍ تجهيز التقرير…</div></div>';
      build().then(function (rep) {
        var rowsHtml = rep.rows.slice(0, 200).map(function (r) {
          return "<tr>" + r.map(function (c) { return "<td>" + (c == null ? "" : c) + "</td>"; }).join("") + "</tr>";
        }).join("");
        var sums = (rep.sums || []).map(function (s) { return '<div class="mini-stat"><b>' + s.value + "</b><span>" + U.esc(s.label) + "</span></div>"; }).join("");
        box.innerHTML =
          '<div class="card">' +
            '<h3>' + U.esc(rep.title) + '</h3>' +
            '<div class="stat-row" style="margin-bottom:12px">' + sums + "</div>" +
            '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
              rep.headers.map(function (h) { return "<th>" + U.esc(h) + "</th>"; }).join("") +
            "</tr></thead><tbody>" +
              (rowsHtml || '<tr><td colspan="9" style="text-align:center">لا توجد بيانات</td></tr>') +
            "</tbody></table></div>" +
            (rep.rows.length > 200 ? '<p class="logout-note">يُعرض أول 200 سجل — استخدم الطباعة/Excel لعرض ' + rep.rows.length + " سجلاً كاملاً</p>" : "") +
          "</div>" +
          '<div class="card"><h3>📈 الرسوم البيانية</h3>' +
            '<div class="chart-box"><canvas id="rp-chart1"></canvas></div>' +
            '<div class="chart-box" style="margin-top:14px"><canvas id="rp-chart2"></canvas></div>' +
          "</div>";
        drawCharts(rep, document.getElementById("rp-type").value);
      })["catch"](function (e) { box.innerHTML = '<div class="card"><div class="alert">خطأ: ' + U.esc(e.message) + "</div></div>"; });
    }

    function drawCharts(rep, type) {
      if (typeof Chart === "undefined") return;
      [chart1, chart2].forEach(function (c) { try { c && c.destroy(); } catch (e) {} });
      var numericCols = rep.headers.map(function (h, i) {
        var hasNum = rep.rows.some(function (r) { return /[\d]/.test(String(r[i])) && !/[أ-ي]/.test(String(r[i] || "").slice(2)); });
        return i > 0 && /مبلغ|إجمالي|المبلغ|الرصيد|مدين|دائن|الصافي|النسبة|عدد/.test(h) && hasNum ? i : -1;
      }).filter(function (i) { return i >= 0; });
      var labelIdx = 1;
      var labels = rep.rows.slice(0, 15).map(function (r) { return String(r[labelIdx]).slice(0, 22); });
      var sets = numericCols.slice(0, 2).map(function (ci, k) {
        var colors = ["rgba(22,101,52,.85)", "rgba(201,162,39,.85)"];
        return {
          label: rep.headers[ci], data: rep.rows.slice(0, 15).map(function (r) { return U.num(String(r[ci]).replace(/[^\d.-]/g, "")); }),
          backgroundColor: colors[k], borderRadius: 6
        };
      });
      if (sets.length && document.getElementById("rp-chart1")) {
        chart1 = new Chart(document.getElementById("rp-chart1"), {
          type: "bar",
          data: { labels: labels, datasets: sets },
          options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: rep.title, font: { size: 13 } }, legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } }
        });
      }
      /* دائري: توزيع حسب النوع (تحصيل) أو الفئة (مصروفات) */
      var isExp = type === "expenses" || type === "categories" || type === "balance";
      var srcP = isExp ? DB.queryExpenses(filters()) : DB.queryCollections(filters());
      srcP.then(function (rows) {
        var roll = DB.rollup(rows, isExp ? "category" : "type");
        var nameFn = isExp ? U.catName : U.typeName;
        if (!roll.length || !document.getElementById("rp-chart2")) return;
        if (chart2) try { chart2.destroy(); } catch (e) {}
        chart2 = new Chart(document.getElementById("rp-chart2"), {
          type: "doughnut",
          data: {
            labels: roll.map(function (x) { return nameFn(x.key) || x.key; }),
            datasets: [{ data: roll.map(function (x) { return x.amount; }), backgroundColor: ["#166534", "#c9a227", "#1d5a8a", "#b3372c", "#5b8c3e", "#7a4e94", "#9a6b00", "#2e7d6e"] }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: isExp ? "التوزيع حسب الفئات المستحقة" : "التوزيع حسب أنواع الزكاة", font: { size: 13 } }, legend: { position: "bottom" } } }
        });
      });
    }
  }
  return { render: render };
})();
