/* views/tools.js — لوحة المعلومات، الطابعة الحرارية، النسخ الاحتياطي، التدقيق، الحوالة، حول | مازن عبدالوهاب */
"use strict";
var Views = window.Views || {};

/* ===== لوحة المعلومات ===== */
Views.Dashboard = (function () {
  var ch1 = null, ch2 = null;
  function render(main) {
    var t = U.today(), ms = U.monthStart(t), ys = U.yearStart(t);
    main.innerHTML =
      '<div class="page-head"><h2>🏠 لوحة المعلومات</h2><div class="ph-actions"><span class="chip gold">' + U.esc(U.fmtDate(t)) + "</span></div></div>" +
      '<div class="kpi-grid" id="kpi"></div>' +
      '<div class="card"><h3>📈 التحصيل الشهري (هذه السنة)</h3><div class="chart-box"><canvas id="db-chart1"></canvas></div></div>' +
      '<div class="card"><h3>🥗 أنواع الزكاة المحصلة</h3><div class="chart-box"><canvas id="db-chart2"></canvas></div></div>' +
      '<div class="card"><h3>🏆 أفضل المراكز تحصيلاً (هذه السنة)</h3><div id="db-top"></div></div>' +
      '<div class="card"><h3>🔔 تنبيهات ذكية</h3><div id="db-alerts"></div></div>';

    var sc = DB.scopeFilter(Auth.session());
    Promise.all([
      DB.queryCollections({ from: ys, to: t, provinceId: sc.provinceId, centerId: sc.centerId }),
      DB.queryExpenses({ from: ys, to: t, provinceId: sc.provinceId, centerId: sc.centerId }),
      Centers.refresh()
    ]).then(function (r) {
      var cols = r[0], exps = r[1];
      var monthCols = cols.filter(function (x) { return x.date >= ms; });
      var monthExp = exps.filter(function (x) { return x.date >= ms; });
      var ti = DB.totals(cols).amount, te = DB.totals(exps).amount;
      var mi = DB.totals(monthCols).amount, me = DB.totals(monthExp).amount;
      var kpis = [
        { l: "تحصيل السنة", v: U.money(ti), s: "ريال", c: "var(--green-600)" },
        { l: "مصروفات السنة", v: U.money(te), s: "ريال", c: "var(--red)" },
        { l: "رصيد الصندوق", v: U.money(ti - te), s: "إيراد − مصروف", c: "var(--gold)" },
        { l: "تحصيل هذا الشهر", v: U.money(mi), s: monthCols.length + " إيصال", c: "var(--blue)" }
      ];
      document.getElementById("kpi").innerHTML = kpis.map(function (k) {
        return '<div class="kpi" style="--kc:' + k.c + '"><div class="k-label">' + k.l + '</div><div class="k-value">' + k.v + "</div><div class=\"k-sub\">" + k.s + "</div></div>";
      }).join("");

      /* أفضل المراكز */
      var byCenter = DB.rollup(cols, "center").sort(function (a, b) { return b.amount - a.amount; }).slice(0, 8);
      document.getElementById("db-top").innerHTML = byCenter.length
        ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>المركز</th><th>الإيصالات</th><th>الإجمالي</th></tr></thead><tbody>' +
          byCenter.map(function (x, i) {
            return "<tr><td>" + (i + 1) + "</td><td>" + U.esc(Centers.nameOf(x.key) || "—") + "</td><td>" + x.count + '</td><td class="num">' + U.money(x.amount) + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : '<div class="empty"><div class="e-ico">📭</div>لا توجد بيانات بعد — ابدأ بتسجيل إيصال</div>';

      /* تنبيهات */
      var alerts = [];
      if (te > ti) alerts.push('<b>تنبيه مصروفات:</b> المصروفات تجاوزت الإيرادات بمقدار ' + U.money(te - ti) + " ريال");
      if (ti > 0 && te / ti > 0.8 && te <= ti) alerts.push("المصروفات بلغت " + ((te / ti) * 100).toFixed(0) + "% من الإيرادات — راجع خطة الصرف");
      var backupDate = null;
      document.getElementById("db-alerts").innerHTML = alerts.length
        ? alerts.map(function (a) { return '<div class="alert">⚠️ <span>' + a + "</span></div>"; }).join("")
        : '<div class="alert" style="background:var(--green-50);border-color:var(--green-100);color:var(--green-800)">✅ <span>لا توجد تنبيهات — الوضع المالي متوازن</span></div>';

      /* الرسوم */
      if (typeof Chart === "undefined") return;
      var months = U.monthsBetween(ys, t);
      var inc = months.map(function (m) {
        var s = 0; cols.forEach(function (x) { if (String(x.date).slice(0, 7) === m) s += U.num(x.amount); });
        return s;
      });
      var exp = months.map(function (m) {
        var s = 0; exps.forEach(function (x) { if (String(x.date).slice(0, 7) === m) s += U.num(x.amount); });
        return s;
      });
      try { ch1 && ch1.destroy(); } catch (e) {}
      ch1 = new Chart(document.getElementById("db-chart1"), {
        type: "bar",
        data: {
          labels: months.map(function (m) { return U.arabicMonth(parseInt(m.slice(5), 10) - 1); }),
          datasets: [
            { label: "التحصيل", data: inc, backgroundColor: "rgba(22,101,52,.85)", borderRadius: 6 },
            { label: "المصروفات", data: exp, backgroundColor: "rgba(201,162,39,.9)", borderRadius: 6 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } }
      });
      var byType = DB.rollup(cols, "type");
      try { ch2 && ch2.destroy(); } catch (e) {}
      ch2 = new Chart(document.getElementById("db-chart2"), {
        type: "doughnut",
        data: {
          labels: byType.map(function (x) { return U.typeName(x.key); }),
          datasets: [{ data: byType.map(function (x) { return x.amount; }), backgroundColor: ["#166534", "#c9a227", "#1d5a8a", "#b3372c", "#5b8c3e", "#7a4e94"] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
      });
    });
  }
  return { render: render };
})();

/* ===== الطابعة الحرارية ===== */
Views.Thermal = (function () {
  function render(main) {
    var st = Thermal.status();
    main.innerHTML =
      '<div class="page-head"><h2>🖨️ الطابعة الحرارية (ESC/POS)</h2></div>' +
      '<div class="card"><h3>📡 حالة الاتصال</h3>' +
        '<dl class="dl" id="th-status">' +
          '<dt>الدعم</dt><dd>' + (Thermal.supported() ? "✅ مدعوم" + (Thermal.isAndroid() ? " (جسر أندرويد الأصلي)" : " (Web Bluetooth)") : "❌ غير مدعوم في هذا المتصفح") + "</dd>" +
          '<dt>الحالة</dt><dd>' + (st.connected ? "🟢 متصل: " + U.esc(st.name) : "🔴 غير متصل") + "</dd>" +
        "</dl>" +
        '<div class="actions-row" style="margin-top:12px">' +
          '<button class="btn btn-primary" id="th-connect">🔗 ' + (Thermal.isAndroid() ? "اتصال بالطابعة المقترنة" : "اختيار الطابعة") + "</button>" +
          '<button class="btn btn-ghost" id="th-test">🧪 طباعة اختبار</button>' +
          '<button class="btn btn-danger" id="th-disc" ' + (st.connected ? "" : "disabled") + ">⏭ قطع الاتصال</button>" +
        "</div>" +
        '<p class="logout-note">58 مم و 80 مم مدعومتان — يُرسل الإيصال كصورة نقطية لضمان العربية 100% مع رمز QR.</p>' +
      "</div>" +
      '<div class="card"><h3>⚙️ عرض الورق</h3><label class="field"><span>حجم الطابعة</span><select id="th-width">' +
        '<option value="58">58 مم (مستندات صغيرة)</option><option value="80">80 مم (قياسية)</option></select></label></div>' +
      '<div class="card"><h3>👁️ معاينة الإيصال الحراري</h3><p class="logout-note">هذه معاينة تقريبية — اطبع اختباراً للتحقق.</p>' +
        '<div id="th-preview" style="display:flex;justify-content:center"></div></div>';

    var sel = document.getElementById("th-width");
    DB.getSetting("printerWidth", "80").then(function (w) { sel.value = w; Thermal.setWidth(w); });
    sel.addEventListener("change", function () { DB.setSetting("printerWidth", sel.value); Thermal.setWidth(sel.value); });

    document.getElementById("th-connect").addEventListener("click", function () {
      var b = this; b.disabled = true; b.textContent = "⏳ جارٍ الاتصال…";
      Thermal.connect().then(function (d) {
        toast("🟢 تم الاتصال: " + d.name);
        App.go("thermal");
      })["catch"](function (e) { toast("فشل الاتصال: " + e.message, "err"); App.go("thermal"); });
    });
    document.getElementById("th-test").addEventListener("click", function () {
      toast("جارٍ إرسال الاختبار…", "warn");
      Thermal.printTest().then(function () { toast("✅ أُرسلت صفحة الاختبار"); })
        ["catch"](function (e) { toast("فشل: " + e.message, "err"); });
    });
    document.getElementById("th-disc").addEventListener("click", function () {
      Thermal.disconnect(); toast("تم قطع الاتصال", "warn"); App.go("thermal");
    });

    /* معاينة */
    ThermalDrawPreview().then(function (cv) {
      var el = document.getElementById("th-preview");
      if (el && cv) {
        cv.style.cssText = "max-width:100%;border:1px dashed var(--line);border-radius:8px";
        el.innerHTML = ""; el.appendChild(cv);
      }
    });
  }
  return { render: render };
})();

function ThermalDrawPreview() {
  var L = [
    { v: "صندوق تحصيل الزكاة", t: "title", bold: true, center: true },
    { v: "الجمهورية اليمنية", center: true },
    { t: "sep" },
    { v: "إيصال تحصيل زكاة", big: true, bold: true, center: true },
    { t: "sep" },
    { v: "رقم الإيصال: ZK-" + new Date().getFullYear() + "-000001", bold: true },
    { v: "التاريخ: " + U.fmtDate(U.today()) + "   الوقت: " + U.nowTime() },
    { t: "sep" },
    { v: "نوع الزكاة: زكاة المال" },
    { v: "المؤدّي: نموذج تجريبي" },
    { v: "المبلغ: 250,000 ريال يمني", big: true, bold: true },
    { t: "sep" },
    { v: "المحصل: —", },
    { v: "شكراً لأدائكم الزكاة", center: true },
    { t: "sep" },
    { v: "برمجة وتطوير مازن عبدالوهاب", center: true },
    { v: "إدارة محاسبة صدام نجم الدين", center: true }
  ];
  return Thermal.drawReceipt ? Thermal.drawReceipt({ lines: L, logo: true }) : Promise.resolve(null);
}

/* ===== النسخ الاحتياطي ===== */
Views.BackupView = (function () {
  function render(main) {
    main.innerHTML =
      '<div class="page-head"><h2>💾 النسخ الاحتياطي والاستعادة</h2></div>' +
      '<div class="alert">🔐 النسخة الاحتياطية تحتوي كل البيانات (المحافظات، المراكز، المستخدمون، الإيصالات، المصروفات، المستندات). يُنصح بتشفيرها بكلمة مرور قبل المشاركة.</div>' +
      '<div class="card"><h3>⬇️ تصدير نسخة احتياطية</h3>' +
        '<label class="field"><span>كلمة مرور التشفير (اختياري — يُنصح بها)</span><input id="bk-pass" type="password" placeholder="اتركها فارغة للنسخ غير المشفّر"></label>' +
        '<div class="actions-row"><button class="btn btn-primary" id="bk-export">📦 تصدير النسخة (JSON)</button></div>' +
        (U.isAndroid() ? '<p class="logout-note">على أندرويد تُحفظ النسخة في مجلد التنزيلات تلقائياً.</p>' : "") +
      "</div>" +
      '<div class="card"><h3>⬆️ استعادة نسخة احتياطية</h3>' +
        '<label class="field"><span>كلمة مرور فك التشفير (إن كانت النسخة مشفّرة)</span><input id="bk-pass2" type="password"></label>' +
        '<label class="field"><span>وضع الاستعادة</span><select id="bk-mode"><option value="merge">دمج مع البيانات الحالية</option><option value="replace">استبدال كامل (تحذير: يمسح الحالية)</option></select></label>' +
        '<div class="actions-row"><button class="btn btn-outline" id="bk-import">📂 اختيار ملف النسخة</button></div>' +
      "</div>" +
      '<div class="card"><h3>📊 إحصاءات قاعدة البيانات</h3><div id="bk-stats" class="stat-row"></div></div>';

    document.getElementById("bk-export").addEventListener("click", function () {
      var pass = document.getElementById("bk-pass").value;
      var b = this; b.disabled = true;
      Backup.exportJSON(pass || null).then(function (fname) {
        toast("✅ تم التصدير: " + fname);
      })["catch"](function (e) { toast("خطأ: " + e.message, "err"); })
        .then(function () { b.disabled = false; });
    });
    document.getElementById("bk-import").addEventListener("click", function () {
      var pass = document.getElementById("bk-pass2").value;
      var mode = document.getElementById("bk-mode").value;
      if (mode === "replace" && !confirm("⚠️ الاستبدال الكامل سيمسح جميع البيانات الحالية قبل الاستيراد. متابعة؟")) return;
      Backup.pickFile().then(function (f) {
        return Backup.restore(f.text, pass || null, mode);
      }).then(function () { toast("✅ تمت الاستعادة بنجاح"); })
        ["catch"](function (e) { toast("فشل الاستعادة: " + e.message, "err"); });
    });

    var jobs = DB.STORES.map(function (s) { return DB.count(s).then(function (n) { return [s, n]; }); });
    Promise.all(jobs).then(function (pairs) {
      var names = { provinces: "المحافظات", centers: "المراكز", users: "المستخدمون", collections: "الإيصالات", expenses: "المصروفات", vouchers: "المستندات", audit: "سجلات التدقيق", settings: "الإعدادات" };
      document.getElementById("bk-stats").innerHTML = pairs.map(function (p) {
        return '<div class="mini-stat"><b>' + p[1] + "</b><span>" + (names[p[0]] || p[0]) + "</span></div>";
      }).join("");
    });
  }
  return { render: render };
})();

/* ===== سجل التدقيق ===== */
Views.AuditView = (function () {
  function render(main) {
    main.innerHTML =
      '<div class="page-head"><h2>🛡️ سجل التدقيق الأمني</h2>' +
      '<div class="ph-actions"><button class="btn btn-outline btn-sm" id="au-print">🖨️ طباعة</button>' +
      '<button class="btn btn-danger btn-sm" id="au-clear">🧹 تفريغ السجل</button></div></div>' +
      '<div class="card"><div id="au-list" class="m-cards"></div></div>';
    Audit.list(500).then(function (rows) {
      var el = document.getElementById("au-list");
      if (!rows.length) { el.innerHTML = '<div class="empty">لا توجد سجلات بعد</div>'; return; }
      el.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الدور</th><th>الإجراء</th><th>الكيان</th><th>التفاصيل</th></tr></thead><tbody>' +
        rows.map(function (x) {
          return "<tr><td>" + U.esc(U.fmtDateTime(x.ts)) + "</td><td>" + U.esc(x.username) + "</td><td>" + U.esc(x.role) + "</td><td>" +
            '<span class="chip ' + (x.action === "حذف" ? "red" : x.action === "دخول" || x.action === "خروج" ? "blue" : "green") + '">' + U.esc(x.action) + "</span></td><td>" + U.esc(x.entity) + "</td><td>" + U.esc(x.details) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
      document.getElementById("au-print").addEventListener("click", function () {
        PrintGov.printReport({
          title: "سجل التدقيق الأمني",
          headers: ["الوقت", "المستخدم", "الدور", "الإجراء", "الكيان", "التفاصيل"],
          rows: rows.slice(0, 400).map(function (x) { return [U.fmtDateTime(x.ts), x.username, x.role, x.action, x.entity, x.details]; }),
          meta: [["عدد السجلات", rows.length]]
        });
      });
      document.getElementById("au-clear").addEventListener("click", function () {
        if (!confirm("تفريغ سجل التدقيق بالكامل؟")) return;
        DB.clear("audit").then(function () { toast("تم التفريغ", "warn"); App.go("audit"); });
      });
    });
  }
  return { render: render };
})();

/* ===== أرشيف المستندات ===== */
Views.Vouchers = (function () {
  function render(main) {
    main.innerHTML =
      '<div class="page-head"><h2>🗂️ أرشيف المستندات والحواسيب</h2></div>' +
      '<div class="card"><div id="vo-list" class="m-cards"></div></div>';
    Promise.all([DB.all("vouchers"), Centers.map()]).then(function (r) {
      var vos = r[0].sort(function (a, b) { return b.createdAt - a.createdAt; });
      var el = document.getElementById("vo-list");
      if (!vos.length) { el.innerHTML = '<div class="empty"><div class="e-ico">📭</div>لا توجد مستندات — أضف صوراً عند تسجيل الإيصالات أو الصرفيات</div>'; return; }
      el.innerHTML = '<div class="m-list" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">' + vos.map(function (v) {
        var thumb = v.images && v.images[0] ? '<img src="' + v.images[0] + '" style="width:100%;height:120px;object-fit:cover;border-radius:8px">' : "";
        return '<div class="m-item">' + thumb +
          '<div class="mi-top" style="margin-top:8px"><span class="mi-title">' + (v.refType === "collection" ? "💰 إيصال" : "🤲 صرفية") + '</span><span class="chip blue">' + (v.images || []).length + " صورة</span></div>" +
          '<div class="mi-row"><span>' + U.esc(v.note || "") + "</span></div>" +
          '<div class="mi-row"><span>' + U.esc(U.fmtDateTime(v.createdAt)) + "</span></div>" +
          '<div class="mi-row"><button class="btn btn-sm btn-outline" data-view="' + v.id + '">👁 عرض</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + v.id + '">🗑</button></div></div>';
      }).join("") + "</div>";
      el.onclick = function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.view) {
          var v = vos.filter(function (x) { return x.id === b.dataset.view; })[0];
          openViewer(v);
        } else if (b.dataset.del) {
          if (!confirm("حذف المستند؟")) return;
          DB.del("vouchers", b.dataset.del).then(function () { App.go("vouchers"); });
        }
      };
    });
  }
  function openViewer(v) {
    if (!v) return;
    App.modal("مستند: " + (v.note || ""),
      '<div style="display:grid;gap:10px">' + (v.images || []).map(function (src) {
        return '<img src="' + src + '" style="width:100%;border-radius:10px">';
      }).join("") + "</div>",
      [{ t: "إغلاق", cls: "btn-ghost" }]);
  }
  return { render: render };
})();

/* ===== حول التطبيق ===== */
Views.About = (function () {
  function render(main) {
    main.innerHTML =
      '<div class="page-head"><h2>ℹ️ حول التطبيق</h2></div>' +
      '<div class="card" style="text-align:center">' +
        '<img src="assets/logo.svg" alt="شعار صندوق الزكاة" style="width:110px;height:110px;margin:6px auto 12px">' +
        '<h2 style="color:var(--green-800)">صندوق تحصيل الزكاة</h2>' +
        '<p style="color:var(--gold-dark);font-weight:700">الجمهورية اليمنية</p>' +
        '<p class="logout-note" style="margin-top:8px">نظام متكامل لإدارة وتحصيل الزكاة ومصروفاتها على الفئات الثماني — يعمل دون إنترنت بالكامل (Offline-First)، ويجمع البيانات تلقائياً من المراكز إلى المحافظات فالمقر المركزي.</p>' +
        '<div class="dl" style="text-align:right;margin-top:14px;max-width:420px;margin-left:auto;margin-right:auto">' +
          "<dt>الإصدار</dt><dd>1.0.0</dd>" +
          "<dt>المنصة</dt><dd>" + (U.isAndroid() ? "Android (تطبيق أصلي)" : "متصفح / PWA يعمل من ملف واحد") + "</dd>" +
          "<dt>قاعدة البيانات</dt><dd>IndexedDB محلية مشفّرة الوصول</dd>" +
          "<dt>الطباعة</dt><dd>A4 رسمي + حراري ESC/POS بلوتوث (58/80مم)</dd>" +
        "</div>" +
      "</div>" +
      '<div class="card" style="border-top:4px solid var(--gold)">' +
        "<h3>👨‍💻 فريق التطوير</h3>" +
        '<div style="text-align:center;padding:10px 0">' +
          '<p style="font-size:1.15rem;font-weight:800;color:var(--green-800);margin:12px 0">تطوير وبرمجة</p>' +
          '<p style="font-size:1.35rem;font-weight:900;color:var(--ink)">مازن عبدالوهاب</p>' +
          '<p style="font-size:1.15rem;font-weight:800;color:var(--green-800);margin:22px 0 12px">إدارة محاسبة</p>' +
          '<p style="font-size:1.35rem;font-weight:900;color:var(--ink)">صدام نجم الدين</p>' +
          '<hr style="border:none;border-top:1px dashed var(--line);margin:18px 0">' +
          '<p style="font-size:1rem;font-weight:800;color:var(--gold-dark)">جميع الحقوق محفوظة لشركة yemen coding</p>' +
          '<p class="logout-note">© ' + new Date().getFullYear() + " yemen coding — الصنع في اليمن 🇾🇪</p>" +
        "</div>" +
      "</div>";
  }
  return { render: render };
})();
