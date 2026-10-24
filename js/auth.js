/* auth.js — المصادقة والصلاحيات (RBAC) | مازن عبدالوهاب
   الأدوار: admin مدير عام | manager مدير فرع محافظة | clerk موظف مركز */
"use strict";
var Auth = (function () {
  var SESSION_KEY = "zakat_session";
  var _user = null;

  var ROLES = {
    admin:   { ar: "مدير عام",           icon: "👑", scope: "الجمهورية كاملة" },
    manager: { ar: "مدير فرع المحافظة",  icon: "🏛️", scope: "المحافظة" },
    clerk:   { ar: "موظف مركز الزكاة",   icon: "🧾", scope: "المركز" }
  };
  /* صلاحيات الواجهات */
  var PERMS = {
    dashboard:      ["admin", "manager", "clerk"],
    collections:    ["admin", "manager", "clerk"],
    expenses:       ["admin", "manager", "clerk"],
    centers:        ["admin", "manager"],
    provinces:      ["admin"],
    users:          ["admin"],
    reports:        ["admin", "manager", "clerk"],
    ledger:         ["admin", "manager"],
    vouchers:       ["admin", "manager", "clerk"],
    thermal:        ["admin", "manager", "clerk"],
    backup:         ["admin", "manager"],
    audit:          ["admin"],
    settings:       ["admin"],
    about:          ["admin", "manager", "clerk"]
  };
  function can(view, user) {
    var u = user || _user;
    if (!u) return false;
    var list = PERMS[view];
    return !list || list.indexOf(u.role) !== -1;
  }

  function seedAdmin() {
    return DB.count("users").then(function (n) {
      if (n > 0) return;
      return Crypto.sha256Hex("admin123" + ":zk:salt-v1").then(function (h) {
        var admin = {
          id: "u_admin", username: "admin", name: "المدير العام",
          salt: "zk:salt-v1", passHash: h, role: "admin",
          provinceId: null, centerId: null, active: true, createdAt: Date.now()
        };
        return DB.put("users", admin);
      });
    });
  }

  function login(username, password) {
    return DB.open().then(function () {
      return new Promise(function (res, rej) {
        var rq = DB.open().then(function (db) {
          var idx = db.transaction("users", "readonly").objectStore("users").index("username");
          var g = idx.get(username);
          g.onsuccess = function () { res(g.result); };
          g.onerror = function () { rej(g.error); };
        });
      });
    }).then(function (u) {
      if (!u) throw new Error("اسم المستخدم غير موجود");
      if (u.active === false) throw new Error("الحساب موقوف — راجع المدير العام");
      return Crypto.sha256Hex(password + ":" + (u.salt || "zk:salt-v1")).then(function (h) {
        if (h !== u.passHash) throw new Error("كلمة المرور غير صحيحة");
        _user = u;
        var s = { id: u.id, ts: Date.now() };
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
        return Audit.log("دخول", "auth", "تسجيل دخول ناجح");
      }).then(function () { return _user; });
    });
  }

  function restore() {
    var raw = null;
    try { raw = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
    if (!raw) return Promise.resolve(null);
    try {
      var s = JSON.parse(raw);
      if (!s || !s.id) return Promise.resolve(null);
      return DB.get("users", s.id).then(function (u) {
        if (u && u.active !== false) { _user = u; return u; }
        return null;
      });
    } catch (e) { return Promise.resolve(null); }
  }

  function logout() {
    return Audit.log("خروج", "auth", "تسجيل خروج").then(function () {
      _user = null;
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    });
  }

  function session() { return _user; }
  function roleAr() { return _user ? (ROLES[_user.role] || {}).ar || _user.role : ""; }
  function scopeText(u) {
    u = u || _user;
    if (!u) return "";
    if (u.role === "admin") return "النطاق: جميع المحافظات";
    if (u.role === "manager") return "النطاق: المحافظة";
    return "النطاق: المركز";
  }
  function changePassword(userId, oldPass, newPass) {
    return DB.get("users", userId).then(function (u) {
      if (!u) throw new Error("المستخدم غير موجود");
      return Crypto.sha256Hex(oldPass + ":" + (u.salt || "zk:salt-v1")).then(function (h) {
        if (h !== u.passHash) throw new Error("كلمة المرور الحالية غير صحيحة");
        return Crypto.sha256Hex(newPass + ":" + u.salt).then(function (h2) {
          u.passHash = h2;
          return DB.put("users", u).then(function () {
            return Audit.log("تعديل", "users", "تغيير كلمة المرور: " + u.username);
          });
        });
      });
    });
  }

  return { ROLES: ROLES, PERMS: PERMS, can: can, seedAdmin: seedAdmin, login: login,
           restore: restore, logout: logout, session: session, roleAr: roleAr,
           scopeText: scopeText, changePassword: changePassword };
})();
