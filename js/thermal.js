/* thermal.js — الطباعة الحرارية ESC/POS عبر البلوتوث (متصفح: Web Bluetooth | أندرويد: الجسر الأصلي)
   تدعم 58mm(384px) و80mm(576px) + رمز QR | طباعة نقطية للعربية 100% | مازن عبدالوهاب */
"use strict";
var Thermal = (function () {
  var WIDTHS = { "58": 384, "80": 576 };
  var DPI = 203; /* 8 dots/mm */

  /* ============ حالة الاتصال ============ */
  var state = {
    mode: null,            /* 'webbt' | 'android' */
    device: null,          /* Web Bluetooth device */
    charac: null,
    androidAddr: null,
    connected: false,
    width: "80"
  };

  function isAndroid() { return !!(window.AndroidBridge && window.AndroidBridge.printBytes); }
  function hasWebBT() { return !!(navigator.bluetooth && navigator.bluetooth.requestDevice); }
  function supported() { return isAndroid() || hasWebBT(); }
  function status() {
    return { supported: supported(), connected: state.connected, mode: state.mode,
             name: state.device ? state.device.name : (state.androidAddr || ""), width: state.width };
  }

  /* ============ الاتصال: Web Bluetooth ============ */
  function connectWebBT() {
    if (!hasWebBT()) return Promise.reject(new Error("متصفحك لا يدعم Web Bluetooth — استخدم Chrome/Edge"));
    return navigator.bluetooth.requestDevice({
      filters: [
        { services: ["000018f0-0000-1000-8000-00805f9b34fb"] },
        { services: ["00001101-0000-1000-8000-00805f9b34fb"] },
        { namePrefix: "printer" }, { namePrefix: "Printer" }, { namePrefix: "BT" },
        { namePrefix: "POS" }, { namePrefix: "HM" }, { namePrefix: "MTP" }, { namePrefix: "ZK" }
      ],
      optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb", "00001101-0000-1000-8000-00805f9b34fb", "battery_service", "device_information"]
    }).then(function (device) {
      state.device = device;
      return device.gatt.connect();
    }).then(function (server) {
      /* جرّب خدمة الطباعة الشائعة 18F0 ثم BLE serial 18F0/FFE0/السريال */
      var tries = ["000018f0-0000-1000-8000-00805f9b34fb", "0000ffe0-0000-1000-8000-00805f9b34fb", "00001101-0000-1000-8000-00805f9b34fb"];
      var i = 0;
      function attempt() {
        if (i >= tries.length) throw new Error("لم يتم العثور على خدمة طباعة متوافقة");
        var sid = tries[i++];
        return server.getPrimaryService(sid)["catch"](function () { return attempt(); }).then(function (svc) {
          return svc.getCharacteristics().then(function (chars) {
            /* اختر خاصية قابلة للكتابة */
            var c = null;
            for (var k = 0; k < chars.length; k++) {
              var p = chars[k].properties;
              if (p.write || p.writeWithoutResponse) { c = chars[k]; break; }
            }
            if (!c) throw new Error("no writable");
            state.charac = c; state.mode = "webbt"; state.connected = true;
            state.device.addEventListener("gattserverdisconnected", function () { state.connected = false; });
            return { name: state.device.name || "طابعة البلوتوث" };
          });
        });
      }
      return attempt();
    });
  }

  /* ============ الاتصال: أندرويد (الأجهزة المقترنة) ============ */
  function connectAndroid(preferredAddr) {
    if (!isAndroid()) return Promise.reject(new Error("الجسر الأصلي غير متوفر"));
    /* طلب صلاحية البلوتوث (أندرويد 12+) إن لزم */
    if (window.AndroidBridge.ensureBluetoothPermission && !window.AndroidBridge.ensureBluetoothPermission()) {
      return Promise.reject(new Error("صادق على صلاحية البلوتوث من النافذة المنبثقة ثم أعد المحاولة"));
    }
    var listJSON = window.AndroidBridge.listBondedPrinters();
    var list;
    try { list = JSON.parse(listJSON); } catch (e) { list = []; }
    if (!list.length) return Promise.reject(new Error("لا توجد طابعات مقترنة — قم بإقران الطابعة من إعدادات البلوتوث أولاً"));
    var dev = null;
    if (preferredAddr) {
      for (var i = 0; i < list.length; i++) if (list[i].address === preferredAddr) dev = list[i];
    }
    if (!dev) dev = list[0];
    var ok = window.AndroidBridge.connectPrinter(dev.address);
    if (!ok) return Promise.reject(new Error("فشل الاتصال بالطابعة " + dev.name));
    state.mode = "android"; state.androidAddr = dev.address; state.connected = true;
    return Promise.resolve({ name: dev.name || dev.address });
  }

  function connect() {
    disconnect();
    if (isAndroid()) return connectAndroid();
    return connectWebBT();
  }
  function disconnect() {
    try {
      if (state.mode === "webbt" && state.device && state.device.gatt && state.device.gatt.connected) state.device.gatt.disconnect();
      if (state.mode === "android" && window.AndroidBridge && window.AndroidBridge.disconnectPrinter) window.AndroidBridge.disconnectPrinter();
    } catch (e) {}
    state.connected = false; state.charac = null; state.device = null; state.androidAddr = null;
  }

  /* ============ إرسال بايتات ============ */
  function b64FromBytes(u8) {
    var bin = "";
    for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
  }
  function sendBytes(u8) {
    if (!state.connected) return Promise.reject(new Error("الطابعة غير متصلة"));
    if (state.mode === "android") {
      var ok = window.AndroidBridge.printBytes(b64FromBytes(u8));
      return ok ? Promise.resolve() : Promise.reject(new Error("فشل الإرسال إلى الطابعة"));
    }
    /* Web Bluetooth: تقسيم 512 بايت */
    var chunk = 512, i = 0;
    function step() {
      if (i >= u8.length) return Promise.resolve();
      var part = u8.subarray(i, Math.min(i + chunk, u8.length));
      i += chunk;
      var val = part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength);
      var p = state.charac.properties.writeWithoutResponse
        ? state.charac.writeValueWithoutResponse(val)
        : state.charac.writeValue(val);
      return Promise.resolve(p).then(function () { return new Promise(function (r) { setTimeout(r, 24); }); }).then(step);
    }
    return step();
  }

  /* ============ بناء الأوامر ============ */
  function esc() { return [0x1B, 0x40]; }                 /* init */
  function feed(n) { return [0x1B, 0x64, n || 3]; }
  function cut() { return [0x1D, 0x56, 0x42, 0x00]; }

  /* raster bitmap GS v 0 m xL xH yL yH data */
  function rasterFromCanvas(canvas) {
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    var img = ctx.getImageData(0, 0, w, h).data;
    var stride = Math.ceil(w / 8);
    var bytes = new Uint8Array(stride * h);
    for (var y = 0; y < h; y++) {
      for (var x8 = 0; x8 < stride; x8++) {
        var b = 0;
        for (var bit = 0; bit < 8; bit++) {
          var x = x8 * 8 + bit;
          if (x >= w) break;
          var idx = (y * w + x) * 4;
          var lum = 0.299 * img[idx] + 0.587 * img[idx + 1] + 0.114 * img[idx + 2];
          if (lum < 128) b |= (0x80 >> bit); /* أسود = 1 */
        }
        bytes[y * stride + x8] = b;
      }
    }
    var xL = stride & 0xFF, xH = (stride >> 8) & 0xFF;
    var yL = h & 0xFF, yH = (h >> 8) & 0xFF;
    var head = [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH];
    var out = new Uint8Array(head.length + bytes.length);
    out.set(head, 0); out.set(bytes, head.length);
    return out;
  }

  /* ============ رسم الإيصال على canvas ============ */
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = src;
    });
  }
  function makeQRCanvas(text, size) {
    return new Promise(function (res, rej) {
      var holder = document.createElement("div");
      holder.style.cssText = "position:fixed;left:-2000px;top:-2000px";
      document.body.appendChild(holder);
      try {
        var qr = new QRCode(holder, { text: text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M, colorDark: "#000", colorLight: "#fff" });
        setTimeout(function () {
          var cv = holder.querySelector("canvas"), img = holder.querySelector("img");
          if (cv) { document.body.removeChild(holder); res(cv); return; }
          if (img) {
            loadImg(img.src).then(function (im) {
              var c2 = document.createElement("canvas"); c2.width = size; c2.height = size;
              c2.getContext("2d").drawImage(im, 0, 0, size, size);
              document.body.removeChild(holder); res(c2);
            })["catch"](function () { document.body.removeChild(holder); rej(new Error("QR فشل")); });
            return;
          }
          document.body.removeChild(holder); rej(new Error("QR فشل"));
        }, 60);
      } catch (e) { document.body.removeChild(holder); rej(e); }
    });
  }

  /* lines: [{t:'title'|'kv'|'row'|'sep'|'p'|'big'|'center', ...}]  */
  function drawReceipt(cfg) {
    var W = WIDTHS[cfg.widthMm || state.width] || 576;
    if (cfg.widthMm === "58") W = 384;
    var cv = document.createElement("canvas");
    var ctx = cv.getContext("2d");
    var S = W / 384; /* مقياس */
    cv.width = W;
    var pad = 8 * S;
    var y = 6 * S;
    /* نبدأ بارتفاع تقديري ثم نُعيد القياس */
    var est = 120 + cfg.lines.length * 26;
    cv.height = est * S + 130 * S;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#000";
    ctx.textBaseline = "top";

    function ensure(h) {
      if (y + h > cv.height) {
        var old = ctx.getImageData(0, 0, cv.width, cv.height);
        cv.height += h + 200;
        var nd = ctx;
        nd.putImageData(old, 0, 0);
      }
    }

    var p0 = Promise.resolve();
    /* شعار */
    if (cfg.logo !== false) {
      p0 = loadImg("assets/logo.svg").then(function (im) {
        var lw = 64 * S;
        ctx.drawImage(im, (W - lw) / 2, y, lw, lw);
        y += lw + 6 * S;
      })["catch"](function () {});
    }
    /* QR */
    if (cfg.qr) {
      p0 = p0.then(function () { return makeQRCanvas(cfg.qr, Math.round(72 * S)); }).then(function (qc) {
        ensure(80 * S);
        ctx.drawImage(qc, (W - qc.width) / 2, y);
        y += qc.height + 6 * S;
      })["catch"](function () {});
    }

    return p0.then(function () {
      cfg.lines.forEach(function (L) {
        if (L.t === "sep") {
          ensure(14 * S);
          ctx.setLineDash([3 * S, 3 * S]);
          ctx.beginPath(); ctx.moveTo(pad, y + 4 * S); ctx.lineTo(W - pad, y + 4 * S);
          ctx.strokeStyle = "#000"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
          y += 12 * S;
          return;
        }
        var size = (L.big ? 20 : L.t === "title" ? 16 : 12.5) * S;
        ctx.font = (L.bold ? "bold " : "") + size + 'px "Segoe UI","Noto Naskh Arabic",Tahoma';
        ctx.direction = "rtl";
        ctx.textAlign = L.center ? "center" : "right";
        /* التفاف الأسطر */
        var maxW = W - pad * 2;
        var words = String(L.v == null ? "" : L.v).split(" ");
        var line = "";
        var lines = [];
        words.forEach(function (wd) {
          var test = line ? line + " " + wd : wd;
          if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = wd; }
          else line = test;
        });
        if (line) lines.push(line);
        lines.forEach(function (ln) {
          ensure(size + 6 * S);
          var x = L.center ? W / 2 : W - pad;
          ctx.fillText(ln, x, y);
          y += size + 5 * S;
        });
      });
      y += 26 * S; /* مسافة قبل القص */
      /* قص الارتفاع الفعلي */
      var fin = document.createElement("canvas");
      fin.width = W; fin.height = Math.ceil(y);
      fin.getContext("2d").drawImage(cv, 0, 0);
      return fin;
    });
  }

  /* طباعة إيصال كامل */
  function printReceipt(data) {
    /* data: {org, header2, receiptNo, date, time, type, payer, center, province, amount, unit, details, clerk, qr, footer} */
    var L = [];
    L.push({ v: data.org || "صندوق تحصيل الزكاة", t: "title", bold: true, center: true });
    L.push({ v: data.header2 || "الجمهورية اليمنية", center: true });
    L.push({ t: "sep" });
    L.push({ v: "إيصال تحصيل زكاة", big: true, bold: true, center: true });
    L.push({ t: "sep" });
    L.push({ v: "رقم الإيصال: " + data.receiptNo, bold: true });
    L.push({ v: "التاريخ: " + data.date + "   الوقت: " + data.time });
    L.push({ t: "sep" });
    L.push({ v: "نوع الزكاة: " + data.type });
    L.push({ v: "المؤدّي: " + data.payer });
    if (data.province) L.push({ v: "المحافظة: " + data.province });
    if (data.center) L.push({ v: "المركز: " + data.center });
    L.push({ v: "المبلغ: " + data.amount + " " + (data.unit || "ريال يمني"), big: true, bold: true });
    if (data.details) L.push({ v: "ملاحظات: " + data.details });
    L.push({ t: "sep" });
    L.push({ v: "المحصل: " + data.clerk });
    L.push({ v: data.footer || "شكراً لمصلية أداء الزكاة — «خُذ من أموالهم صدقةً تطهّرهم»", center: true });
    L.push({ t: "sep" });
    L.push({ v: "برمجة وتطوير مازن عبدالوهاب", center: true });
    L.push({ v: "إدارة محاسبة صدام نجم الدين", center: true });

    return drawReceipt({ lines: L, qr: data.qr, widthMm: data.widthMm, logo: true }).then(function (cv) {
      var payload = new Uint8Array(esc().length + 1 + rasterFromCanvas(cv).length);
      payload.set(esc(), 0);
      payload.set([0x0A], esc().length);
      payload.set(rasterFromCanvas(cv), esc().length + 1);
      var tail = feed(3).concat(cut());
      var all = new Uint8Array(payload.length + tail.length);
      all.set(payload, 0); all.set(tail, payload.length);
      return sendBytes(all);
    });
  }

  /* اختبار طابعة */
  function printTest() {
    var L = [
      { v: "اختبار الطباعة", big: true, bold: true, center: true },
      { t: "sep" },
      { v: "صندوق تحصيل الزكاة", center: true },
      { v: "الجمهورية اليمنية", center: true },
      { v: new Date().toLocaleString("ar-YE-u-nu-latn"), center: true },
      { t: "sep" },
      { v: "برمجة وتطوير مازن عبدالوهاب", center: true },
      { v: "إدارة محاسبة صدام نجم الدين", center: true }
    ];
    return drawReceipt({ lines: L, logo: false }).then(function (cv) {
      return sendBytes(rasterFromCanvas(cv));
    });
  }

  function setWidth(w) { if (WIDTHS[w]) state.width = w; }

  return {
    supported: supported, status: status, connect: connect, disconnect: disconnect,
    printReceipt: printReceipt, printTest: printTest, sendBytes: sendBytes,
    isAndroid: isAndroid, hasWebBT: hasWebBT, setWidth: setWidth
  };
})();
