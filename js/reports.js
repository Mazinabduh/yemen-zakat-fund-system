/* reports.js — محرك التقارير: يومية/شهرية/سنوية، مقارنات، دفتر يومية، ميزانية
   كل تقرير يمر عبر PrintGov للطباعة A4 | مازن عبدالوهاب */
"use strict";
var Reports = (function () {

  function orgInfo() {
    return DB.getSetting("orgName", "صندوق تحصيل الزكاة").then(function (org) {
      return DB.getSetting("orgMinistry", "الجهاز المركزي للزكاة").then(function (min) {
        return { org: org, ministry: min };
      });
    });
  }

  function scopeMeta(f) {
    var u = Auth.session();
    var arr = [["الفترة", U.fmtDate(f.from) + " إلى " + U.fmtDate(f.to)]];
    arr.push(["النطاق", u && u.role === "admin" ? "عام (كل المحافظات)" : u && u.role === "manager" ? "محافظة المستخدم" : "مركز المستخدم"]);
    return arr;
  }

  /* ===== 1) تقرير التحصيل (يومي/شهري/سنوي حسب الفترة) ===== */
  function collectionsReport(f) {
    return Promise.all([DB.queryCollections(f), orgInfo()]).then(function (r) {
      var rows = r[0], org = r[1];
      var t = DB.totals(rows);
      var byType = DB.rollup(rows, "type");
      var body = rows.map(function (x, i) {
        return [
          i + 1,
          U.esc(x.receiptNo),
          U.esc(U.fmtDate(x.date)),
          U.esc(U.typeName(x.type)),
          U.esc(x.payerName || "—"),
          U.esc((Provinces.nameOf(x.provinceId) || "—") + " / " + (Centers.nameOf(x.centerId) || "—")),
          U.money(x.amount)
        ];
      });
      return {
        title: "تقرير تحصيل الزكاة",
        meta: scopeMeta(f).concat([["عدد الإيصالات", t.count]]),
        headers: ["م", "رقم الإيصال", "التاريخ", "نوع الزكاة", "المؤدّي", "المحافظة/المركز", "المبلغ (ريال)"],
        rows: body,
        foot: ["", "", "", "", "", "الإجمالي", U.money(t.amount)],
        sums: [
          { label: "إجمالي المبالغ المحصلة", value: U.money(t.amount) + " ريال" },
          { label: "عدد الإيصالات", value: t.count },
          { label: "أنواع الزكاة", value: byType.length }
        ],
        org: org
      };
    });
  }

  /* ===== 2) تقرير المصروفات والمستحقين ===== */
  function expensesReport(f) {
    return Promise.all([DB.queryExpenses(f), orgInfo()]).then(function (r) {
      var rows = r[0], org = r[1];
      var t = DB.totals(rows);
      var body = rows.map(function (x, i) {
        return [
          i + 1,
          U.esc(U.fmtDate(x.date)),
          U.esc(U.catName(x.category)),
          U.esc(x.beneficiaryName || "—"),
          U.esc((Provinces.nameOf(x.provinceId) || "—") + " / " + (Centers.nameOf(x.centerId) || "—")),
          U.esc(x.details || ""),
          U.money(x.amount)
        ];
      });
      return {
        title: "تقرير المصروفات على الفئات الثماني",
        meta: scopeMeta(f).concat([["عدد العمليات", t.count]]),
        headers: ["م", "التاريخ", "الفئة المستحقة", "المستحق", "المحافظة/المركز", "البيان", "المبلغ (ريال)"],
        rows: body,
        foot: ["", "", "", "", "", "الإجمالي", U.money(t.amount)],
        sums: [{ label: "إجمالي المصروفات", value: U.money(t.amount) + " ريال" }, { label: "عدد العمليات", value: t.count }],
        org: org
      };
    });
  }

  /* ===== 3) مقارنة المحافظات أو المراكز ===== */
  function comparisonReport(f, level) {
    return Promise.all([DB.queryCollections(f), DB.queryExpenses(f), orgInfo()]).then(function (r) {
      var cols = r[0], exps = r[1], org = r[2];
      var byCol = DB.rollup(cols, level), byExp = DB.rollup(exps, level);
      var map = {};
      byCol.forEach(function (x) { map[x.key] = { inc: x.amount, cnt: x.count, exp: 0 }; });
      byExp.forEach(function (x) { if (!map[x.key]) map[x.key] = { inc: 0, cnt: 0, exp: 0 }; map[x.key].exp = x.amount; });
      var nameFn = level === "province" ? Provinces.nameOf : Centers.nameOf;
      var body = Object.keys(map).map(function (k, i) {
        var m = map[k];
        return [i + 1, U.esc(nameFn(k) || k || "غير محدد"), m.cnt, U.money(m.inc), U.money(m.exp), U.money(m.inc - m.exp)];
      });
      var ti = 0, te = 0;
      Object.keys(map).forEach(function (k) { ti += map[k].inc; te += map[k].exp; });
      return {
        title: level === "province" ? "تقرير مقارنة المحافظات" : "تقرير مقارنة المراكز",
        meta: scopeMeta(f),
        headers: ["م", level === "province" ? "المحافظة" : "المركز", "عدد الإيصالات", "إجمالي التحصيل", "إجمالي المصروفات", "الصافي"],
        rows: body,
        foot: ["", "الإجمالي", "", U.money(ti), U.money(te), U.money(ti - te)],
        sums: [{ label: "إجمالي التحصيل", value: U.money(ti) }, { label: "إجمالي المصروفات", value: U.money(te) }, { label: "الصافي", value: U.money(ti - te) }],
        org: org
      };
    });
  }

  /* ===== 4) دفتر اليومية (المصروف + الإيراد زمنياً) ===== */
  function ledgerReport(f) {
    return Promise.all([DB.queryCollections(f), DB.queryExpenses(f), orgInfo()]).then(function (r) {
      var cols = r[0], exps = r[1], org = r[2];
      var items = [];
      cols.forEach(function (c) { items.push({ date: c.date, kind: "إيراد (تحصيل)", desc: "إيصال " + c.receiptNo + " — " + (c.payerName || ""), inc: U.num(c.amount), exp: 0 }); });
      exps.forEach(function (e) { items.push({ date: e.date, kind: "مصروف — " + U.catName(e.category), desc: (e.beneficiaryName || "") + " " + (e.details || ""), inc: 0, exp: U.num(e.amount) }); });
      items.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var bal = 0;
      var body = items.map(function (x, i) {
        bal += x.inc - x.exp;
        return [i + 1, U.esc(U.fmtDate(x.date)), U.esc(x.kind), U.esc(x.desc), x.inc ? U.money(x.inc) : "—", x.exp ? U.money(x.exp) : "—", U.money(bal)];
      });
      var ti = 0, te = 0;
      items.forEach(function (x) { ti += x.inc; te += x.exp; });
      return {
        title: "دفتر اليومية العام",
        meta: scopeMeta(f),
        headers: ["م", "التاريخ", "نوع القيد", "البيان", "مدين (إيراد)", "دائن (مصروف)", "الرصيد"],
        rows: body,
        foot: ["", "", "", "الإجمالي", U.money(ti), U.money(te), U.money(ti - te)],
        sums: [{ label: "إجمالي الإيرادات", value: U.money(ti) }, { label: "إجمالي المصروفات", value: U.money(te) }, { label: "الرصيد النهائي", value: U.money(ti - te) }],
        org: org
      };
    });
  }

  /* ===== 5) الميزانية المالية المبسطة ===== */
  function balanceReport(f) {
    return Promise.all([DB.queryCollections(f), DB.queryExpenses(f), orgInfo()]).then(function (r) {
      var cols = r[0], exps = r[1], org = r[2];
      var ti = DB.totals(cols).amount, te = DB.totals(exps).amount;
      var byCat = DB.rollup(exps, "category");
      var body = byCat.map(function (x, i) {
        return [i + 1, U.esc(U.catName(x.key)), x.count, U.money(x.amount)];
      });
      return {
        title: "الميزانية المالية المبسطة",
        meta: scopeMeta(f),
        headers: ["م", "بند المصروف (الفئة المستحقة)", "عدد العمليات", "المبلغ (ريال)"],
        rows: body,
        foot: ["", "إجمالي المصروفات", "", U.money(te)],
        sums: [
          { label: "إجمالي الإيرادات (الزكاة المحصلة)", value: U.money(ti) },
          { label: "إجمالي المصروفات على المستحقين", value: U.money(te) },
          { label: ti >= te ? "رصيد متبقٍ ب الصندوق" : "عجز (مصروفات فوق الإيرادات)", value: U.money(Math.abs(ti - te)) }
        ],
        extraHTML: '<table class="gov-tbl" style="margin-bottom:10px"><tbody>' +
          '<tr><th>إجمالي الزكاة المحصلة (الإيرادات)</th><td style="font-weight:800">' + U.money(ti) + " ريال</td></tr>" +
          '<tr><th>إجمالي المصروفات</th><td style="font-weight:800">' + U.money(te) + " ريال</td></tr>" +
          '<tr><th>الصافي (رصيد الصندوق)</th><td style="font-weight:800;color:' + (ti >= te ? "#14532d" : "#b3372c") + '">' + U.money(ti - te) + " ريال</td></tr>" +
        "</tbody></table>",
        org: org
      };
    });
  }

  /* ===== 6) تقرير المستحقين حسب الفئة ===== */
  function categoriesReport(f) {
    return Promise.all([DB.queryExpenses(f), orgInfo()]).then(function (r) {
      var rows = r[0], org = r[1];
      var byCat = DB.rollup(rows, "category");
      var total = DB.totals(rows).amount || 1;
      var body = U.CATEGORIES.map(function (c, i) {
        var rec = null;
        byCat.forEach(function (x) { if (x.key === c.id) rec = x; });
        var amt = rec ? rec.amount : 0, cnt = rec ? rec.count : 0;
        var pct = ((amt / total) * 100).toFixed(1);
        return [i + 1, U.esc(c.ar), cnt, U.money(amt), pct + "%"];
      });
      var te = DB.totals(rows).amount;
      return {
        title: "تقرير المصروفات حسب الفئات الثماني المستحقة",
        meta: scopeMeta(f),
        headers: ["م", "الفئة المستحقة (الآية 60 - التوبة)", "عدد العمليات", "المبلغ", "النسبة"],
        rows: body,
        foot: ["", "الإجمالي", rows.length, U.money(te), "100%"],
        sums: [{ label: "إجمالي المصروفات", value: U.money(te) }, { label: "عدد الفئات النشطة", value: byCat.length }],
        org: org
      };
    });
  }

  /* إرسال أي تقرير مُبني {title,meta,headers,rows,foot,sums,org} إلى الطباعة */
  function print(rep) {
    return PrintGov.printReport({
      title: rep.title,
      ministry: rep.org ? rep.org.ministry : undefined,
      org: rep.org ? rep.org.org : undefined,
      meta: rep.meta,
      headers: rep.headers, rows: rep.rows, foot: rep.foot, sums: rep.sums,
      extraHTML: rep.extraHTML
    }).then(function () { return Audit.log("طباعة", "reports", rep.title); });
  }

  /* تصدير Excel */
  function excel(rep, fname) {
    return Backup.exportExcel([
      { name: rep.title, headers: rep.headers, rows: rep.rows.map(function (r) { return r.map(function (c) { return String(c).replace(/<[^>]+>/g, ""); }); }) }
    ], fname || rep.title.replace(/[\\/:*?"<>|]/g, "") + ".xlsx");
  }

  return {
    collectionsReport: collectionsReport, expensesReport: expensesReport,
    comparisonReport: comparisonReport, ledgerReport: ledgerReport,
    balanceReport: balanceReport, categoriesReport: categoriesReport,
    print: print, excel: excel
  };
})();
