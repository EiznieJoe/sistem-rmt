/**
 * Tiruan servis Google supaya logik Apps Script boleh diuji di Node.
 *
 * DIUJI di sini: enjin kelayakan, parser import, kebenaran peranan, skop
 * kelas, hashing, sesi, sanitization — semuanya JavaScript biasa.
 *
 * TIDAK diuji: gelagat sebenar SpreadsheetApp, kuota Apps Script, CORS,
 * kelajuan computeDigest, dan concurrency sebenar (LockService ditiru
 * sebagai sentiasa berjaya kerana Node single-threaded).
 */
'use strict';
const crypto = require('crypto');

const buatHelaian = (nama) => ({ nama, sel: [] });
const nilaiSel = (sh, r, c) => { const b = sh.sel[r]; if (!b) return ''; const v = b[c]; return v === undefined ? '' : v; };
function tetapSel(sh, r, c, v) {
  while (sh.sel.length <= r) sh.sel.push([]);
  const b = sh.sel[r];
  while (b.length <= c) b.push('');
  b[c] = v;
}
const lebarMaks = (sh) => sh.sel.reduce((m, b) => Math.max(m, b.length), 0);
function barisAkhir(sh) {
  for (let r = sh.sel.length - 1; r >= 0; r--) {
    const b = sh.sel[r] || [];
    if (b.some((v) => v !== '' && v !== null && v !== undefined)) return r + 1;
  }
  return 0;
}

function buatRange(sh, baris1, lajur1, nBaris, nLajur) {
  const r0 = baris1 - 1, c0 = lajur1 - 1;
  const rng = {
    getRow: () => baris1,
    getColumn: () => lajur1,
    getValues() {
      const out = [];
      for (let r = 0; r < nBaris; r++) {
        const b = [];
        for (let c = 0; c < nLajur; c++) b.push(nilaiSel(sh, r0 + r, c0 + c));
        out.push(b);
      }
      return out;
    },
    setValue(v) { tetapSel(sh, r0, c0, v); return rng; },
    setValues(m) { m.forEach((b, r) => b.forEach((v, c) => tetapSel(sh, r0 + r, c0 + c, v))); return rng; },
    clearContent() {
      for (let r = 0; r < nBaris; r++) for (let c = 0; c < nLajur; c++) tetapSel(sh, r0 + r, c0 + c, '');
      return rng;
    },
    setFontWeight() { return rng; },
    createTextFinder(cari) {
      let seluruh = false;
      const f = {
        matchEntireCell(v) { seluruh = v; return f; },
        matchCase() { return f; },
        findNext() {
          for (let r = 0; r < nBaris; r++) for (let c = 0; c < nLajur; c++) {
            const v = String(nilaiSel(sh, r0 + r, c0 + c));
            if (seluruh ? v === String(cari) : v.includes(String(cari))) {
              return buatRange(sh, r0 + r + 1, c0 + c + 1, 1, 1);
            }
          }
          return null;
        }
      };
      return f;
    }
  };
  return rng;
}

function bungkus(sh) {
  return {
    getName: () => sh.nama,
    getLastRow: () => barisAkhir(sh),
    getLastColumn: () => lebarMaks(sh),
    getRange: (b, l, nb, nl) => buatRange(sh, b, l, nb === undefined ? 1 : nb, nl === undefined ? 1 : nl),
    setFrozenRows: () => {},
    appendRow(baris) { const r = barisAkhir(sh); baris.forEach((v, c) => tetapSel(sh, r, c, v)); },
    deleteRow(n) { sh.sel.splice(n - 1, 1); },
    protect: () => ({ setDescription: () => ({ setWarningOnly: () => {} }) }),
    getProtections: () => [],
    _mentah: sh
  };
}

function buatPersekitaran() {
  const helaian = new Map();
  const sifat = new Map();
  const cache = new Map();
  const log = [];
  const ss = {
    getSheetByName: (n) => (helaian.has(n) ? bungkus(helaian.get(n)) : null),
    insertSheet(n) { helaian.set(n, buatHelaian(n)); return bungkus(helaian.get(n)); },
    getSheets: () => [...helaian.values()].map(bungkus)
  };
  const g = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss, ProtectionType: { SHEET: 'SHEET' } },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (sifat.has(k) ? sifat.get(k) : null),
        setProperty: (k, v) => { sifat.set(k, String(v)); },
        deleteProperty: (k) => { sifat.delete(k); }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get(k) { const e = cache.get(k); if (!e) return null; if (e.t < Date.now()) { cache.delete(k); return null; } return e.v; },
        put(k, v, s) { cache.set(k, { v: String(v), t: Date.now() + s * 1000 }); },
        remove(k) { cache.delete(k); }
      })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5' },
      computeDigest: (algo, teks) =>
        [...crypto.createHash(algo).update(String(teks), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
      getUuid: () => crypto.randomUUID(),
      formatDate(d, tz, fmt) {
        const p = (n) => String(n).padStart(2, '0');
        if (fmt === 'yy') return String(d.getFullYear()).slice(-2);
        if (fmt === 'yyyy') return String(d.getFullYear());
        if (fmt === 'dd-MM-yyyy') return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
        if (fmt === 'yyyy-MM-dd') return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        return d.toISOString();
      }
    },
    Logger: { log: (m) => log.push(String(m)) },
    MailApp: {
      _emel: [],
      sendEmail(o) { g.MailApp._emel.push(o); },
      getRemainingDailyQuota: () => 100
    },
    ScriptApp: {
      getProjectTriggers: () => [], deleteTrigger: () => {},
      newTrigger: () => ({ timeBased: () => ({ atHour: () => ({ everyDays: () => ({ create: () => {} }) }) }) })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } })
    }
  };
  g.globalThis = g;
  return { global: g, log, helaian, emel: () => g.MailApp._emel };
}

module.exports = { buatPersekitaran };
