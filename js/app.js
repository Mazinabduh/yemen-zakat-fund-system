/* app.js — التطبيق الرئيسي: التشغيل، التوجيه، القائمة، الشريط السفلي، النوافذ
   إصدار 2: واجهة عصرية بأسلوب الخبجي + سبلاش سينمائي | مازن عبدالوهاب */
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

  /* أيقونات SVG للشريط السفلي */
  var TAB_ICONS = {
    dashboard: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></svg>',
    collections: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M14.8 8.8c-.6-.9-1.6-1.3-2.8-1.3-1.7 0-3 .9-3 2.2 0 2.9 6 1.6 6 4.5 0 1.4-1.3 2.3-3 2.3-1.3 0-2.4-.5-3-1.5"/></svg>',
    expenses: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.3-9.2C1.5 8.4 3.7 5 7 5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.3 0 5.5 3.4 4.3 6.8C19.5 16.4 12 21 12 21Z"/></svg>',
    reports: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>'
  };
  var BOTTOM_TABS = [
    { id: "dashboard", ar: "الرئيسية" },
    { id: "collections", ar: "التحصيل" },
    { id: "expenses", ar: "المصروفات" },
    { id: "reports", ar: "التقارير" }
  ];

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
      '</h3><button class="icon-btn" data-mclose style="background:rgba(255,255,255,.08);color:#fff">✕</button></div>' +
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
    buildBottomBar(u);
  }

  function buildBottomBar(u) {
    var bar = document.getElementById("bottom-bar");
    if (!bar) return;
    var old = bar.querySelector(".bottom-bar-bg");
    var html = "";
    BOTTOM_TABS.forEach(function (t) {
      if (!Auth.can(t.id, u)) return;
      html += '<button class="bottom-tab" data-tab="' + t.id + '">' + TAB_ICONS[t.id] + "<span>" + t.ar + "</span></button>";
    });
    html += '<button class="bottom-tab" data-tab="__more">' + TAB_ICONS.more + "<span>المزيد</span></button>";
    bar.innerHTML = "";
    if (old) bar.appendChild(old);
    bar.insertAdjacentHTML("beforeend", html);
    bar.onclick = function (e) {
      var b = e.target.closest("[data-tab]");
      if (!b) return;
      if (b.dataset.tab === "__more") { openSidebar(); return; }
      go(b.dataset.tab);
    };
    syncBottomBar();
  }

  function syncBottomBar() {
    document.querySelectorAll("#bottom-bar .bottom-tab").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === current);
    });
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
    /* تفعيل الروابط */
    document.querySelectorAll("#nav a").forEach(function (a) {
      a.classList.toggle("active", a.dataset.route === id);
    });
    syncBottomBar();
    document.title = route.ar + " — صندوق تحصيل الزكاة";
    closeSidebar();
    try { location.hash = "#/" + id; } catch (e) {}
    window.scrollTo(0, 0);
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

  /* ============ السبلاش السينمائي ============ */
  function buildStars() {
    var box = document.getElementById("sp-stars");
    if (!box) return;
    var html = "";
    for (var i = 0; i < 70; i++) {
      var big = Math.random() > 0.85;
      html += '<i class="' + (big ? "big" : "") + '" style="left:' + (Math.random() * 100).toFixed(2) +
        "%;top:" + (Math.random() * 62).toFixed(2) + "%;width:" + (big ? 3 : 1.6) +
        "px;height:" + (big ? 3 : 1.6) + "px;animation-delay:" + (Math.random() * 2.6).toFixed(2) + 's"></i>';
    }
    box.innerHTML = html;
  }
  function splashStatus() {
    var el = document.getElementById("sp-status");
    var msgs = ["جاري تجهيز النظام…", "تهيئة قاعدة البيانات المحلية…", "تحميل المحافظات والمراكز…", "تجهيز التقارير والرسوم…", "مرحباً بك في صندوق الزكاة 🌙"];
    var i = 0;
    var t = setInterval(function () {
      if (!el || !document.getElementById("sp-status")) { clearInterval(t); return; }
      el.textContent = msgs[Math.min(i, msgs.length - 1)];
      i++;
      if (i >= msgs.length) clearInterval(t);
    }, 720);
  }

  /* ============ بدء التشغيل ============ */
  function boot() {
    buildStars();
    splashStatus();
    PrintGov.initToolbar();
    window.addEventListener("hashchange", function () {
      if (Auth.session()) go(fromHash());
    });
    setTimeout(function () {
      var sp = document.getElementById("splash");
      if (!sp) { showLogin(); return; }
      sp.classList.add("splash-exit");
      setTimeout(function () {
        sp.remove();
        showLogin();
      }, 500);
    }, 3900);
  }

  function loadLogoAsImg() {
    var el = document.querySelector(".topbar-logo");
    if (el) {
      var img = document.createElement("img");
      img.src = "assets/logo.svg";
      img.alt = "شعار الزكاة";
      img.style.cssText = "width:100%;height:100%;display:block";
      el.innerHTML = "";
      el.appendChild(img);
    }
  }

  function showLogin() {
    startLoginCanvas();
    Auth.restore().then(function (u) {
      if (u) { enterApp(u); return; }
      document.getElementById("login-screen").classList.remove("hidden");
      document.getElementById("login-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = document.getElementById("login-btn");
        btn.disabled = true; btn.dataset.txt = btn.innerHTML;
        btn.innerHTML = '<span>⏳ جارٍ التحقق…</span>';
        Auth.login(
          document.getElementById("login-username").value.trim(),
          document.getElementById("login-password").value
        ).then(function (u2) {
          document.getElementById("login-screen").classList.add("hidden");
          stopLoginCanvas();
          enterApp(u2);
        })["catch"](function (err) {
          var el = document.getElementById("login-error");
          el.textContent = "⚠️ " + err.message;
          el.classList.remove("hidden");
        }).then(function () {
          btn.disabled = false;
          btn.innerHTML = btn.dataset.txt || "تسجيل الدخول";
        });
      });
      document.querySelectorAll(".pass-eye").forEach(function (b) {
        b.addEventListener("click", function () {
          var inp = document.getElementById(b.dataset.eye);
          inp.type = inp.type === "password" ? "text" : "password";
        });
      });
      document.getElementById("login-username").focus();
    });
  }

  /* خلفية جزيئات متحركة لشاشة الدخول */
  var _lgRaf = null;
  function startLoginCanvas() {
    if (_lgRaf) return; /* الحلقة تعمل بالفعل */
    var cv = document.getElementById("lg-canvas");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var dots = [];
    function size() {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
      dots = [];
      var n = Math.min(64, Math.floor(window.innerWidth / 9));
      for (var i = 0; i < n; i++) {
        dots.push({
          x: Math.random() * cv.width, y: Math.random() * cv.height,
          r: 1 + Math.random() * 2.4, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
          gold: Math.random() > .55
        });
      }
    }
    function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      dots.forEach(function (d) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > cv.width) d.vx *= -1;
        if (d.y < 0 || d.y > cv.height) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, 6.283);
        ctx.fillStyle = d.gold ? "rgba(212,175,55,.55)" : "rgba(74,222,128,.45)";
        ctx.fill();
      });
      /* خطوط خفيفة بين الجزيئات القريبة */
      for (var i = 0; i < dots.length; i++) {
        for (var j = i + 1; j < dots.length; j++) {
          var dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y;
          var dist = dx * dx + dy * dy;
          if (dist < 12000) {
            ctx.strokeStyle = "rgba(74,222,128," + (0.09 * (1 - dist / 12000)).toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y); ctx.stroke();
          }
        }
      }
      _lgRaf = requestAnimationFrame(tick);
    }
    size();
    window.addEventListener("resize", size);
    tick();
  }
  function stopLoginCanvas() {
    if (_lgRaf) { cancelAnimationFrame(_lgRaf); _lgRaf = null; }
  }

  function enterApp(u) {
    document.getElementById("app-shell").classList.remove("hidden");
    document.getElementById("tb-user").textContent = u.name + " · " + Auth.roleAr();
    document.getElementById("tb-subtitle").textContent = Auth.scopeText(u);
    loadLogoAsImg();
    buildNav();
    document.getElementById("btn-menu").onclick = openSidebar;
    document.getElementById("scrim").onclick = closeSidebar;
    document.getElementById("btn-lock").onclick = function () {
      Auth.logout().then(function () {
        document.getElementById("app-shell").classList.add("hidden");
        var ls = document.getElementById("login-screen");
        ls.classList.remove("hidden");
        document.getElementById("login-password").value = "";
        toast("تم قفل التطبيق — أعد تسجيل الدخول", "warn");
        var nf = document.getElementById("login-form");
        var fresh = nf.cloneNode(true);
        nf.parentNode.replaceChild(fresh, nf);
        showLogin();
      });
    };
    var start = fromHash();
    if (!Auth.can(start, u)) start = "dashboard";
    go(start);

    var hour = new Date().getHours();
    var greet = hour < 12 ? "صباح الخير" : hour < 17 ? "طاب يومك" : "مساء الخير";
    toast(greet + "، " + u.name + " 👋");
  }

  return { boot: boot, go: go, toast: toast, modal: modal, closeModal: closeModal, ROUTES: ROUTES };
})();

window.toast = App.toast;

/* ============ إقلاع فعلي ============ */
document.addEventListener("DOMContentLoaded", function () {
  /* ألوان الرسوم البيانية تناسب الثيم الداكن */
  if (typeof Chart !== "undefined") {
    Chart.defaults.color = "#a8c5b4";
    Chart.defaults.borderColor = "rgba(255,255,255,.08)";
    Chart.defaults.font.family = "'Cairo','Segoe UI',Tahoma,sans-serif";
  }
  DB.open()
    .then(function () { return DB.seed(); })
    .then(function () { return Auth.seedAdmin(); })
    .then(function () { return DemoData.load(); })  /* بيانات تجريبية تلقائياً عند أول تشغيل */
    .then(function () { return Provinces.refresh(); })
    .then(function () { return Centers.refresh(); })
    .then(function () { App.boot(); })
    ["catch"](function (e) {
      var sp = document.getElementById("splash");
      if (sp) sp.innerHTML =
        '<div class="sp-stage"><h1 class="sp-title">صندوق تحصيل الزكاة</h1>' +
        '<p class="sp-status" style="color:#ff9d90">تعذر فتح قاعدة البيانات المحلية: ' + (e && e.message ? e.message : e) + "</p></div>";
    });
});
