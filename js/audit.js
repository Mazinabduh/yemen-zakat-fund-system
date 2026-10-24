/* audit.js — سجل التدقيق الأمني | مازن عبدالوهاب */
"use strict";
var Audit = (function () {
  function log(action, entity, details) {
    var u = (window.Auth && Auth.session()) || {};
    var rec = {
      id: U.uid(),
      ts: Date.now(),
      userId: u.id || "—",
      username: u.name || u.username || "غير معروف",
      role: u.role || "—",
      action: action,
      entity: entity || "",
      details: details || "",
      device: U.isAndroid() ? "Android" : (navigator.userAgent || "").slice(0, 60)
    };
    return DB.put("audit", rec)["catch"](function () {});
  }
  function list(limit) {
    return DB.all("audit").then(function (rows) {
      rows.sort(function (a, b) { return b.ts - a.ts; });
      return limit ? rows.slice(0, limit) : rows;
    });
  }
  return { log: log, list: list };
})();
