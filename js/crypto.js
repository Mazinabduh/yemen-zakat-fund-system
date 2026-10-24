/* crypto.js — تشفير محلي (SHA-256 + AES-GCM) عبر WebCrypto
   يعمل تحت file:// لأنه سياق آمن | مازن عبدالوهاب */
"use strict";
var Crypto = (function () {
  var enc = new TextEncoder(), dec = new TextDecoder();

  function subtle() {
    if (!window.crypto || !window.crypto.subtle) throw new Error("WebCrypto غير مدعوم في هذا المتصفح");
    return window.crypto.subtle;
  }
  function randomHex(bytes) {
    var a = new Uint8Array(bytes || 16);
    window.crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  /* كلمة المرور -> hash ثابت للتخزين */
  function sha256Hex(text) {
    return subtle().digest("SHA-256", enc.encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    });
  }

  function pbkdf2Key(password, saltHex, iterations) {
    return subtle().importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return subtle().deriveKey(
        { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: iterations || 120000, hash: "SHA-256" },
        base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }

  function hexToBytes(hex) {
    var out = new Uint8Array(hex.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  function bytesToHex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  /* نص -> AES-GCM -> payload{v,s,iv,d} */
  function encryptText(text, password) {
    var salt = randomHex(16), iv = window.crypto.getRandomValues(new Uint8Array(12));
    return pbkdf2Key(password, salt).then(function (key) {
      return subtle().encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(text)).then(function (cipher) {
        return JSON.stringify({ v: 1, s: salt, iv: bytesToHex(iv), d: bytesToHex(cipher) });
      });
    });
  }
  function decryptText(payloadJSON, password) {
    var p;
    try { p = JSON.parse(payloadJSON); } catch (e) { return Promise.reject(new Error("ملف التشفير غير صالح")); }
    var iv = hexToBytes(p.iv);
    return pbkdf2Key(password, p.s).then(function (key) {
      return subtle().decrypt({ name: "AES-GCM", iv: iv }, key, hexToBytes(p.d)).then(function (plain) {
        return dec.decode(plain);
      });
    });
  }

  return { sha256Hex: sha256Hex, randomHex: randomHex, encryptText: encryptText, decryptText: decryptText };
})();
