/* views/admin.js — المحافظات والمراكز والمستخدمون والإعدادات | مازن عبدالوهاب */
"use strict";

/* ===== مساعدات الهيكل (تُستخدم في كل التطبيق) ===== */
var Provinces = (function () {
  var cache = null;
  function refresh() { return DB.all("provinces").then(function (p) { cache = p; return p; }); }
  function nameOf(id) {
    if (!cache) return "(محافظة)";
    for (var i = 0; i < cache.length; i++) if (cache[i].id === id) return cache[i].name;
    return id || "";
  }
  function map() { return refresh().then(function (p) { var m = {}; p.forEach(function (x) { m[x.id] = x.name; }); return m; }); }
  function fillSelect(sel, onlyId) {
    if (!sel) return Promise.resolve();
    return refresh().then(function (p) {
      sel.innerHTML = '<option value="">— اختر المحافظة —</option>';
      p.sort(function (a, b) { return a.name.localeCompare(b.name, "ar"); }).forEach(function (x) {
        if (onlyId && x.id !== onlyId) return;
        sel.insertAdjacentHTML("beforeend", '<option value="' + x.id + '">' + U.esc(x.name) + "</option>");
      });
      if (onlyId) sel.value = onlyId;
    });
  }
  return { refresh: refresh, nameOf: nameOf, map: map, fillSelect: fillSelect };
})();

var Centers = (function () {
  var cache = null;
  function refresh() { return DB.all("centers").then(function (c) { cache = c; return c; }); }
  function nameOf(id) {
    if (!cache) return "(مركز)";
    for (var i = 0; i < cache.length; i++) if (cache[i].id === id) return cache[i].name;
    return id || "";
  }
  function map() { return refresh().then(function (c) { var m = {}; c.forEach(function (x) { m[x.id] = x.name; }); return m; }); }
  function fillSelect(sel, provinceId, onlyProvince) {
    if (!sel) return Promise.resolve();
    return refresh().then(function (c) {
      sel.innerHTML = '<option value="">— اختر المركز —</option>';
      c.sort(function (a, b) { return a.name.localeCompare(b.name, "ar"); }).forEach(function (x) {
        if (provinceId && x.provinceId !== provinceId) return;
        if (onlyProvince && x.provinceId !== onlyProvince) return;
        sel.insertAdjacentHTML("beforeend", '<option value="' + x.id + '">' + U.esc(x.name) + "</option>");
      });
    });
  }
  return { refresh: refresh, nameOf: nameOf, map: map, fillSelect: fillSelect };
})();

var Views = window.Views || {};

/* ===== شاشة المحافظات ===== */
Views.Provinces = (function () {
  function render(main) {
    main.innerHTML =
      '<div class="page-head"><h2>🏛️ المحافظات</h2></div>' +
      '<div class="card"><h3>➕ إضافة محافظة</h3><form id="pv-form" class="form-grid">' +
        '<label class="field"><span>اسم المحافظة *</span><input id="pv-name" required placeholder="مثال: محافظة حضرموت"></label>' +
        '<label class="field"><span>المركز الرئيسي</span><input id="pv-hq" placeholder="مثال: المكلا"></label>' +
        '<div class="actions-row full"><button class="btn btn-primary" type="submit">💾 حفظ</button></div></form></div>' +
      '<div class="card"><h3>📋 قائمة المحافظات</h3><div id="pv-list" class="m-cards"></div></div>';
    document.getElementById("pv-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var rec = { id: U.uid(), name: document.getElementById("pv-name").value.trim(), hq: document.getElementById("pv-hq").value.trim() };
      DB.put("provinces", rec).then(function () { return Audit.log("إضافة", "provinces", rec.name); })
        .then(function () { toast("✅ تمت الإضافة"); load(); });
    });
    load();
  }
  function load() {
    var el = document.getElementById("pv-list");
    Provinces.refresh().then(function (p) {
      if (!p.length) { el.innerHTML = '<div class="empty">لا توجد محافظات</div>'; return; }
      Promise.all([DB.all("centers"), DB.all("collections")]).then(function (r) {
        var body = p.sort(function (a, b) { return a.name.localeCompare(b.name, "ar"); }).map(function (x) {
          var cs = r[0].filter(function (c) { return c.provinceId === x.id; }).length;
          var cnt = r[1].filter(function (c) { return c.provinceId === x.id; }).length;
          var amt = 0; r[1].forEach(function (c) { if (c.provinceId === x.id) amt += U.num(c.amount); });
          return '<div class="m-item"><div class="mi-top"><span class="mi-title">' + U.esc(x.name) + '</span><span class="chip blue">' + cs + " مركز</span></div>" +
            '<div class="mi-row"><span>الإيصالات: <b>' + cnt + '</b></span><span>التحصيل: <b>' + U.money(amt) + "</b></span></div>" +
            '<div class="mi-row"><span>' + U.esc(x.hq || "") + '</span><button class="btn btn-sm btn-danger" data-del="' + x.id + '">🗑 حذف</button></div></div>';
        }).join("");
        el.innerHTML = '<div class="m-list" style="display:grid;gap:9px">' + body + "</div>";
        el.onclick = function (e) {
          var b = e.target.closest("button[data-del]");
          if (!b) return;
          if (!confirm("حذف المحافظة؟ المراكز المرتبطة تبقى ويجب حذفها يدوياً.")) return;
          DB.del("provinces", b.dataset.del).then(function () { toast("تم الحذف", "warn"); load(); });
        };
      });
    });
  }
  return { render: render };
})();

/* ===== شاشة المراكز ===== */
Views.Centers = (function () {
  function render(main) {
    main.innerHTML =
      '<div class="page-head"><h2>🏢 مراكز الزكاة</h2></div>' +
      '<div class="card"><h3>➕ إضافة مركز</h3><form id="ct-form" class="form-grid c3">' +
        '<label class="field"><span>اسم المركز *</span><input id="ct-name" required placeholder="مثال: مركز الزكاة - مدينة ذمار"></label>' +
        '<label class="field"><span>المحافظة *</span><select id="ct-province" required></select></label>' +
        '<label class="field"><span>هاتف</span><input id="ct-phone" type="tel" placeholder="7xxxxxxxx"></label>' +
        '<label class="field full"><span>العنوان</span><input id="ct-addr" placeholder="الشارع/الحي"></label>' +
        '<div class="actions-row full"><button class="btn btn-primary" type="submit">💾 حفظ</button></div></form></div>' +
      '<div class="card"><h3>📋 قائمة المراكز</h3><div id="ct-list" class="m-cards"></div></div>';
    Provinces.fillSelect(document.getElementById("ct-province"));
    document.getElementById("ct-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var rec = {
        id: U.uid(), name: document.getElementById("ct-name").value.trim(),
        provinceId: document.getElementById("ct-province").value,
        phone: document.getElementById("ct-phone").value.trim(),
        address: document.getElementById("ct-addr").value.trim()
      };
      if (!rec.provinceId) { toast("اختر المحافظة", "err"); return; }
      DB.put("centers", rec).then(function () { return Audit.log("إضافة", "centers", rec.name); })
        .then(function () { toast("✅ تمت الإضافة"); load(); });
    });
    load();
  }
  function load() {
    var el = document.getElementById("ct-list");
    Centers.refresh().then(function (c) {
      if (!c.length) { el.innerHTML = '<div class="empty">لا توجد مراكز</div>'; return; }
      Promise.all([Provinces.map(), DB.all("users")]).then(function (r) {
        var body = c.sort(function (a, b) { return a.name.localeCompare(b.name, "ar"); }).map(function (x) {
          var staff = r[1].filter(function (u) { return u.centerId === x.id; }).length;
          return '<div class="m-item"><div class="mi-top"><span class="mi-title">' + U.esc(x.name) + '</span><span class="chip gold">' + U.esc(r[0][x.provinceId] || "—") + "</span></div>" +
            '<div class="mi-row"><span>الموظفون: <b>' + staff + "</b></span><span>" + U.esc(x.phone || x.address || "") + "</span></div>" +
            '<div class="mi-row"><span></span><button class="btn btn-sm btn-danger" data-del="' + x.id + '">🗑 حذف</button></div></div>';
        }).join("");
        el.innerHTML = '<div class="m-list" style="display:grid;gap:9px">' + body + "</div>";
        el.onclick = function (e) {
          var b = e.target.closest("button[data-del]");
          if (!b) return;
          if (!confirm("حذف المركز؟")) return;
          DB.del("centers", b.dataset.del).then(function () { toast("تم الحذف", "warn"); load(); });
        };
      });
    });
  }
  return { render: render };
})();

/* ===== شاشة المستخدمين ===== */
Views.Users = (function () {
  function render(main) {
    main.innerHTML =
      '<div class="page-head"><h2>👥 المستخدمون والصلاحيات</h2></div>' +
      '<div class="card"><h3>➕ إضافة مستخدم</h3><form id="us-form" class="form-grid c3">' +
        '<label class="field"><span>الاسم الكامل *</span><input id="us-name" required placeholder="الاسم"></label>' +
        '<label class="field"><span>اسم المستخدم *</span><input id="us-username" required autocapitalize="off" placeholder="user1"></label>' +
        '<label class="field"><span>كلمة المرور *</span><input id="us-pass" type="password" required minlength="6" placeholder="6 أحرف على الأقل"></label>' +
        '<label class="field"><span>الدور *</span><select id="us-role" required>' +
          '<option value="clerk">🧾 موظف مركز الزكاة</option>' +
          '<option value="manager">🏛️ مدير فرع المحافظة</option>' +
          '<option value="admin">👑 مدير عام</option></select></label>' +
        '<label class="field"><span>المحافظة</span><select id="us-province"></select></label>' +
        '<label class="field"><span>المركز</span><select id="us-center"></select></label>' +
        '<div class="actions-row full"><button class="btn btn-primary" type="submit">💾 حفظ المستخدم</button></div></form></div>' +
      '<div class="card"><h3>📋 المستخدمون الحاليون</h3><div id="us-list" class="m-cards"></div></div>';
    Provinces.fillSelect(document.getElementById("us-province"));
    Centers.fillSelect(document.getElementById("us-center"));
    document.getElementById("us-province").addEventListener("change", function () {
      Centers.fillSelect(document.getElementById("us-center"), this.value);
    });
    document.getElementById("us-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var role = document.getElementById("us-role").value;
      var provinceId = document.getElementById("us-province").value || null;
      var centerId = document.getElementById("us-center").value || null;
      if (role === "manager" && !provinceId) { toast("مدير الفرع يحتاج تحديد محافظة", "err"); return; }
      if (role === "clerk" && (!provinceId || !centerId)) { toast("موظف المركز يحتاج تحديد المحافظة والمركز", "err"); return; }
      var username = document.getElementById("us-username").value.trim();
      var pass = document.getElementById("us-pass").value;
      DB.all("users").then(function (users) {
        for (var i = 0; i < users.length; i++) if (users[i].username === username) throw new Error("اسم المستخدم موجود مسبقاً");
        var salt = "zk:" + Crypto.randomHex(4);
        return Crypto.sha256Hex(pass + ":" + salt).then(function (h) {
          var rec = {
            id: U.uid(), username: username, name: document.getElementById("us-name").value.trim(),
            salt: salt, passHash: h, role: role, provinceId: provinceId, centerId: centerId,
            active: true, createdAt: Date.now()
          };
          return DB.put("users", rec).then(function () { return Audit.log("إضافة", "users", "مستخدم: " + username + " (" + role + ")"); });
        });
      }).then(function () { toast("✅ تم إنشاء المستخدم"); document.getElementById("us-form").reset(); load(); })
        ["catch"](function (e) { toast(e.message, "err"); });
    });
    load();
  }
  function load() {
    var el = document.getElementById("us-list");
    DB.all("users").then(function (users) {
      Promise.all([Provinces.map(), Centers.map()]).then(function (m) {
        var body = users.map(function (x) {
          return '<div class="m-item"><div class="mi-top"><span class="mi-title">' + U.esc(x.name) + ' <span class="chip blue">' + (Auth.ROLES[x.role] || {}).icon + " " + U.esc((Auth.ROLES[x.role] || {}).ar || x.role) + '</span></span>' +
            '<span class="chip ' + (x.active === false ? "red" : "green") + '">' + (x.active === false ? "موقوف" : "نشط") + "</span></div>" +
            '<div class="mi-row"><span>المستخدم: <b>' + U.esc(x.username) + "</b></span><span>" + U.esc((m[0][x.provinceId] || "") + " " + (m[1][x.centerId] || "")) + "</span></div>" +
            '<div class="mi-row"><span></span><span>' +
            '<button class="btn btn-sm btn-outline" data-tgl="' + x.id + '">' + (x.active === false ? "▶ تفعيل" : "⏸ إيقاف") + "</button> " +
            (x.username === "admin" ? "" : '<button class="btn btn-sm btn-danger" data-del="' + x.id + '">🗑</button>') +
            "</span></div></div>";
        }).join("");
        el.innerHTML = '<div class="m-list" style="display:grid;gap:9px">' + body + "</div>";
        el.onclick = function (e) {
          var b = e.target.closest("button");
          if (!b) return;
          if (b.dataset.tgl) {
            DB.get("users", b.dataset.tgl).then(function (u) {
              u.active = u.active === false;
              return DB.put("users", u).then(function () { return Audit.log("تعديل", "users", (u.active ? "تفعيل" : "إيقاف") + ": " + u.username); });
            }).then(load);
          } else if (b.dataset.del) {
            if (!confirm("حذف المستخدم نهائياً؟")) return;
            DB.del("users", b.dataset.del).then(function () { toast("تم الحذف", "warn"); load(); });
          }
        };
      });
    });
  }
  return { render: render };
})();

/* ===== شاشة الإعدادات ===== */
Views.Settings = (function () {
  function render(main) {
    Promise.all([
      DB.getSetting("orgName", ""), DB.getSetting("orgCountry", "الجمهورية اليمنية"),
      DB.getSetting("orgMinistry", ""), DB.getSetting("orgPhone", ""),
      DB.getSetting("orgAddress", ""), DB.getSetting("printerWidth", "80")
    ]).then(function (v) {
      main.innerHTML =
        '<div class="page-head"><h2>⚙️ الإعدادات</h2></div>' +
        '<div class="card"><h3>🏢 بيانات الجهة (تظهر في المطبوعات الرسمية)</h3><form id="st-form" class="form-grid c3">' +
          '<label class="field"><span>اسم الصندوق</span><input id="st-org" value="' + U.esc(v[0]) + '"></label>' +
          '<label class="field"><span>الدولة</span><input id="st-country" value="' + U.esc(v[1]) + '"></label>' +
          '<label class="field"><span>الجهة العليا</span><input id="st-min" value="' + U.esc(v[2]) + '"></label>' +
          '<label class="field"><span>الهاتف</span><input id="st-phone" value="' + U.esc(v[3]) + '"></label>' +
          '<label class="field"><span>العنوان</span><input id="st-addr" value="' + U.esc(v[4]) + '"></label>' +
          '<label class="field"><span>عرض الطابعة الحرارية</span><select id="st-pw"><option value="58">58 مم (32 حرفاً)</option><option value="80">80 مم (48 حرفاً)</option></select></label>' +
          '<div class="actions-row full"><button class="btn btn-primary" type="submit">💾 حفظ الإعدادات</button></div></form></div>' +
        '<div class="card"><h3>🔑 تغيير كلمة المرور</h3><form id="pw-form" class="form-grid">' +
          '<label class="field"><span>كلمة المرور الحالية</span><input id="pw-old" type="password" required></label>' +
          '<label class="field"><span>الجديدة (6+ أحرف)</span><input id="pw-new" type="password" required minlength="6"></label>' +
          '<label class="field"><span>تأكيد الجديدة</span><input id="pw-new2" type="password" required minlength="6"></label>' +
          '<div class="actions-row full"><button class="btn btn-primary" type="submit">تحديث كلمة المرور</button></div></form></div>' +
        '<div class="card"><h3>🧪 البيانات التجريبية</h3><p class="logout-note">بيانات واقعية (تحصيلات ومصروفات لآخر 8 أشهر) لتجربة التقارير والرسوم — تُحذف بضغطة واحدة دون التأثير على بياناتك الحقيقية.</p>' +
          '<div class="actions-row"><button class="btn btn-outline" id="demo-load">⬇️ تحميل البيانات التجريبية</button>' +
          '<button class="btn btn-danger" id="demo-clear">🗑 حذف كل البيانات التجريبية</button></div></div>';

      document.getElementById("st-pw").value = v[5];
      document.getElementById("st-form").addEventListener("submit", function (e) {
        e.preventDefault();
        Promise.all([
          DB.setSetting("orgName", document.getElementById("st-org").value.trim()),
          DB.setSetting("orgCountry", document.getElementById("st-country").value.trim()),
          DB.setSetting("orgMinistry", document.getElementById("st-min").value.trim()),
          DB.setSetting("orgPhone", document.getElementById("st-phone").value.trim()),
          DB.setSetting("orgAddress", document.getElementById("st-addr").value.trim()),
          DB.setSetting("printerWidth", document.getElementById("st-pw").value)
        ]).then(function () { return Audit.log("تعديل", "settings", "تحديث الإعدادات"); })
          .then(function () { toast("✅ تم حفظ الإعدادات"); });
      });
      document.getElementById("pw-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var n1 = document.getElementById("pw-new").value, n2 = document.getElementById("pw-new2").value;
        if (n1 !== n2) { toast("كلمتا المرور غير متطابقتين", "err"); return; }
        Auth.changePassword(Auth.session().id, document.getElementById("pw-old").value, n1)
          .then(function () { toast("✅ تم تغيير كلمة المرور"); e.target.reset(); })
          ["catch"](function (er) { toast(er.message, "err"); });
      });
      /* البيانات التجريبية */
      document.getElementById("demo-load").addEventListener("click", function () {
        var b = this; b.disabled = true; b.textContent = "⏳ جارٍ التحميل…";
        DemoData.load().then(function (ok) {
          toast(ok ? "✅ تم تحميل البيانات التجريبية — جرّب لوحة المعلومات والتقارير" : "البيانات التجريبية محمّلة مسبقاً");
          b.disabled = false; b.textContent = "⬇️ تحميل البيانات التجريبية";
        })["catch"](function (er) { toast("خطأ: " + er.message, "err"); b.disabled = false; b.textContent = "⬇️ تحميل البيانات التجريبية"; });
      });
      document.getElementById("demo-clear").addEventListener("click", function () {
        App.modal("تأكيد الحذف", "<p>سيتم حذف كل الإيصالات والصرفيات التجريبية فقط. هل أنت متأكد؟</p>", [
          { t: "إلغاء", cls: "btn-ghost" },
          { t: "نعم، احذف", cls: "btn-danger", fn: function () {
            DemoData.clear().then(function (n) {
              toast("🗑 حُذف " + n + " سجل تجريبي");
            })["catch"](function (er) { toast("خطأ: " + er.message, "err"); });
          }}
        ]);
      });
    });
  }
  return { render: render };
})();
