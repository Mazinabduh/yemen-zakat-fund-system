/* app.js — التطبيق الرئيسي: التشغيل، التوجيه، القائمة، النوافذ | مازن عبدالوهاب */
"use strict";

var App = (function () {
  var ROUTES = [
    { id: "dashboard", ar: "لوحة المعلومات", icon: "🏠", view: "Dashboard", group: "الرئيسية" },
    { id: "collections", ar: "تحصيل الزكاة", icon: "💰", view: "Collections", group: "العمليات" },
    { id: "expenses", ar: "المصروفات والمستحقون", icon: "🤲", view: "Expenses", group: "العمليات" },
    { id: "vouchers", ar: "أرشيف المستندات", icon: "🗂️", view: "Vouchers", group: "العمليات" },
    { id: "reports", ar: "مركز التقارير", icon: "📊", view: "ReportsView", group: "التقارير" },
    { id: "thermal", ar: "الطابعة الحرارية", icon: "🖨️", view: "Thermal", group: "التقارير" },
    { id: "provinces", ar: "المحافظات", icon: "🏛️", view: "Provinces", group: "الإدارة" },
    { id: "centers", ar: "مراكز الزكاة", icon: "🏢", view: "Centers", group: "الإدارة" },
    { id: "users", ar: "المستخدمون والصلاحيات", icon: "👥", view: "Users", group: "الإدارة" },
    { id: "backup", ar: "النسخ الاحتياطي", icon: "💾", view: "BackupView", group: "النظام" },
    { id: "audit", ar: "سجل التدقيق", icon: "🛡️", view: "AuditView", group: "النظام" },
    { id: "settings", ar: "الإعدادات", icon: "⚙️", view: "Settings", group: "النظام" },
    { id: "about", ar: "حول التطبيق", icon: "ℹ️", view: "About", group: "النظام" }
  ];
  var current = "dashboard";

  /* ============ Toast & Modal ============ */
  function toast(msg, kind) {
    var root = document.getElementById("toast-root");
    var el = document.createElement("div");
    el.className = "toast" + (kind === "err" ? " err" : kind === "warn" ? " warn" : "");
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .4s"; el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 400);
    }, 3400);
  }
  function modal(title, bodyHTML, buttons) {
    var root = document.getElementById("modal-root");
    root.classList.remove("hidden");
    var btns = (buttons || [{ t: "إغلاق", cls: "btn-ghost" }]).map(function (b, i) {
      return '<button class="btn ' + (b.cls || "btn-primary") + '" data-mi="' + i + '">' + b.t + "</button>";
    }).join("");
    root.innerHTML = '<div class="modal"><div class="modal-head"><h3>' + U.esc(title) +
      '</h3><button class="icon-btn" data-mclose style="background:#eee;color:#333">✕</button></div>' +
      '<div class="modal-body">' + bodyHTML + '</div><div class="modal-foot">' + btns + "</div></div>";
    root.onclick = function (e) {
      if (e.target === root || e.target.closest("[data-mclose]")) { closeModal(); return; }
      var b = e.target.closest("[data-mi]");
      if (b) {
        var def = (buttons || [])[parseInt(b.dataset.mi, 10)];
        closeModal();
        if (def && def.fn) def.fn();
      }
    };
  }
  function closeModal() {
    var root = document.getElementById("modal-root");
    root.classList.add("hidden");
    root.innerHTML = "";
  }

  /* ============ التنقل ============ */
  function buildNav() {
    var u = Auth.session();
    var nav = document.getElementById("nav");
    var html = "", lastGroup = "";
    ROUTES.forEach(function (r) {
      if (!Auth.can(r.id, u)) return;
      if (r.group !== lastGroup) { html += '<div class="nav-group">' + r.group + "</div>"; lastGroup = r.group; }
      html += '<a href="#/' + r.id + '" data-route="' + r.id + '"><span class="ni">' + r.icon + "</span>" + r.ar + "</a>";
    });
    nav.innerHTML = html;
  }

  function go(id) {
    var u = Auth.session();
    var route = null;
    for (var i = 0; i < ROUTES.length; i++) if (ROUTES[i].id === id) route = ROUTES[i];
    if (!route || !Auth.can(id, u)) { toast("لا تملك صلاحية الوصول لهذه الشاشة", "err"); return; }
    current = id;
    var main = document.getElementById("main");
    main.innerHTML = "";
    var viewFn = window.Views && Views[route.view];
    if (viewFn && viewFn.render) {
      viewFn.render(main);
    } else {
      main.innerHTML = '<div class="card"><div class="empty">الشاشة غير متوفرة</div></div>';
    }
    /* تفعيل الرابط */
    document.querySelectorAll("#nav a").forEach(function (a) {
      a.classList.toggle("active", a.dataset.route === id);
    });
    document.title = route.ar + " — صندوق تحصيل الزكاة";
    closeSidebar();
    try { location.hash = "#/" + id; } catch (e) {}
  }

  function fromHash() {
    var h = (location.hash || "").replace(/^#\//, "");
    return h || "dashboard";
  }

  /* ============ الشريط الجانبي (موبايل) ============ */
  function openSidebar() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("scrim").classList.add("show");
  }
  function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("scrim").classList.remove("show");
  }

  /* ============ بدء التشغيل ============ */
  function boot() {
    /* الشعار عبر img (use لا يعمل تحت file://) */
    loadLogoAsImg();
    /* تغيير التوجيه عبر الهاش — مرة واحدة فقط */
    window.addEventListener("hashchange", function () {
      if (Auth.session()) go(fromHash());
    });

    /* 1) شاشة البداية */
    setTimeout(function () {
      var sp = document.getElementById("splash");
      sp.classList.add("splash-exit");
      setTimeout(function () {
        sp.remove();
        showLogin();
      }, 480);
    }, 3600);
  }

  function loadLogoAsImg() {
    fetchlessLogo("splash-logo"); fetchlessLogo("login-logo"); fetchlessLogo("topbar-logo");
  }
  function fetchlessLogo(cls) {
    var els = document.querySelectorAll("." + cls);
    els.forEach(function (el) {
      if (!el) return;
      var img = document.createElement("img");
      img.src = "assets/logo.svg";
      img.alt = "شعار الزكاة";
      img.style.cssText = "width:100%;height:100%;display:block";
      el.innerHTML = "";
      el.appendChild(img);
    });
  }

  function showLogin() {
    Auth.restore().then(function (u) {
      if (u) { enterApp(u); return; }
      document.getElementById("login-screen").classList.remove("hidden");
      document.getElementById("login-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = document.getElementById("login-btn");
        btn.disabled = true; btn.textContent = "⏳ جارٍ التحقق…";
        Auth.login(
          document.getElementById("login-username").value.trim(),
          document.getElementById("login-password").value
        ).then(function (u2) {
          document.getElementById("login-screen").classList.add("hidden");
          enterApp(u2);
        })["catch"](function (err) {
          var el = document.getElementById("login-error");
          el.textContent = "⚠️ " + err.message;
          el.classList.remove("hidden");
        }).then(function () {
          btn.disabled = false; btn.textContent = "تسجيل الدخول";
        });
      });
      /* عين كلمة المرور */
      document.querySelectorAll(".pass-eye").forEach(function (b) {
        b.addEventListener("click", function () {
          var inp = document.getElementById(b.dataset.eye);
          inp.type = inp.type === "password" ? "text" : "password";
        });
      });
      document.getElementById("login-username").focus();
    });
  }

  function enterApp(u) {
    document.getElementById("app-shell").classList.remove("hidden");
    document.getElementById("tb-user").textContent = u.name + " · " + Auth.roleAr();
    document.getElementById("tb-subtitle").textContent = Auth.scopeText(u);
    buildNav();
    /* أحداث الهيكل */
    document.getElementById("btn-menu").onclick = openSidebar;
    document.getElementById("scrim").onclick = closeSidebar;
    document.getElementById("btn-lock").onclick = function () {
      Auth.logout().then(function () {
        document.getElementById("app-shell").classList.add("hidden");
        var ls = document.getElementById("login-screen");
        ls.classList.remove("hidden");
        document.getElementById("login-password").value = "";
        toast("تم قفل التطبيق — أعد تسجيل الدخول", "warn");
        /* إعادة ربط نموذج الدخول */
        var nf = document.getElementById("login-form");
        var fresh = nf.cloneNode(true);
        nf.parentNode.replaceChild(fresh, nf);
        showLogin();
      });
    };
    /* العودة لأول شاشة مسموحة */
    var start = fromHash();
    if (!Auth.can(start, u)) start = "dashboard";
    go(start);

    /* ترحيب */
    var hour = new Date().getHours();
    var greet = hour < 12 ? "صباح الخير" : hour < 17 ? "طاب يومك" : "مساء الخير";
    toast(greet + "، " + u.name + " 👋");
  }

  return { boot: boot, go: go, toast: toast, modal: modal, closeModal: closeModal, ROUTES: ROUTES };
})();

window.toast = App.toast;

/* ============ إقلاع فعلي ============ */
document.addEventListener("DOMContentLoaded", function () {
  DB.open()
    .then(function () { return DB.seed(); })
    .then(function () { return Auth.seedAdmin(); })
    .then(function () { return Provinces.refresh(); })
    .then(function () { return Centers.refresh(); })
    .then(function () { App.boot(); })
    ["catch"](function (e) {
      /* fallback بسيط إن فشل IndexedDB */
      document.getElementById("splash").innerHTML =
        '<div class="splash-inner"><h1 class="splash-title">صندوق تحصيل الزكاة</h1>' +
        '<p class="splash-sub">تعذر فتح قاعدة البيانات المحلية: ' + (e && e.message ? e.message : e) + "</p></div>";
    });
});
