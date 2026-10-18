/**
 * Tiruan servis Google supaya logik Apps Script boleh diuji di Node.
 *
 * Yang DIUJI di sini: state machine, kebenaran peranan, pengasingan tugas,
 * had percubaan, hashing, dan sanitization — semuanya JavaScript biasa.
 *
 * Yang TIDAK diuji: gelagat sebenar SpreadsheetApp, kuota Apps Script,
 * CORS, dan kelajuan computeDigest. Itu hanya boleh dibuktikan pada
 * deployment sebenar.
 */
'use strict';
const crypto = require('crypto');

function buatHelaian(nama) {
  return { nama, sel: [] }; // sel[baris][lajur], 0-indexed
}

function nilaiSel(sh, r, c) {
  const baris = sh.sel[r];
  if (!baris) return '';
  const v = baris[c];
  return v === undefined ? '' : v;
}

function tetapSel(sh, r, c, v) {
  while (sh.sel.length <= r) sh.sel.push([]);
  const baris = sh.sel[r];
  while (baris.length <= c) baris.push('');
  baris[c] = v;
}

function lebarMaks(sh) {
  return sh.sel.reduce((m, b) => Math.max(m, b.length), 0);
}

function barisAkhir(sh) {
  for (let r = sh.sel.length - 1; r >= 0; r--) {
    const b = sh.sel[r] || [];
    if (b.some((v) => v !== '' && v !== null && v !== undefined)) return r + 1;
  }
  return 0;
}

function buatRange(sh, baris1, lajur1, nBaris, nLajur) {
  const r0 = baris1 - 1, c0 = lajur1 - 1;
  return {
    getRow: () => baris1,
    getColumn: () => lajur1,
    getValues() {
      const keluar = [];
      for (let r = 0; r < nBaris; r++) {
        const b = [];
        for (let c = 0; c < nLajur; c++) b.push(nilaiSel(sh, r0 + r, c0 + c));
        keluar.push(b);
      }
      return keluar;
    },
    setValue(v) { tetapSel(sh, r0, c0, v); return this; },
    setValues(m) {
      m.forEach((b, r) => b.forEach((v, c) => tetapSel(sh, r0 + r, c0 + c, v)));
      return this;
    },
    setFontWeight() { return this; },
    createTextFinder(cari) {
      let seluruhSel = false;
      const f = {
        matchEntireCell(v) { seluruhSel = v; return f; },
        matchCase() { return f; },
        findNext() {
          for (let r = 0; r < nBaris; r++) {
            for (let c = 0; c < nLajur; c++) {
              const v = String(nilaiSel(sh, r0 + r, c0 + c));
              const padan = seluruhSel ? v === String(cari) : v.indexOf(String(cari)) >= 0;
              if (padan) return buatRange(sh, r0 + r + 1, c0 + c + 1, 1, 1);
            }
          }
          return null;
        }
      };
      return f;
    }
  };
}

function bungkusHelaian(sh) {
  return {
    getName: () => sh.nama,
    getLastRow: () => barisAkhir(sh),
    getLastColumn: () => lebarMaks(sh),
    getRange: (b, l, nb, nl) => buatRange(sh, b, l, nb === undefined ? 1 : nb, nl === undefined ? 1 : nl),
    setFrozenRows: () => {},
    appendRow(baris) {
      const r = barisAkhir(sh);
      baris.forEach((v, c) => tetapSel(sh, r, c, v));
    },
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
    getSheetByName(n) { return helaian.has(n) ? bungkusHelaian(helaian.get(n)) : null; },
    insertSheet(n) { helaian.set(n, buatHelaian(n)); return bungkusHelaian(helaian.get(n)); },
    getSheets() { return [...helaian.values()].map(bungkusHelaian); }
  };

  const global = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: () => ss,
      ProtectionType: { SHEET: 'SHEET' }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (sifat.has(k) ? sifat.get(k) : null),
        setProperty: (k, v) => { sifat.set(k, String(v)); },
        deleteProperty: (k) => { sifat.delete(k); }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get(k) {
          const e = cache.get(k);
          if (!e) return null;
          if (e.tamat < Date.now()) { cache.delete(k); return null; }
          return e.nilai;
        },
        put(k, v, detik) { cache.set(k, { nilai: String(v), tamat: Date.now() + detik * 1000 }); },
        remove(k) { cache.delete(k); }
      })
    },
    LockService: {
      // Node single-threaded; kunci sentiasa berjaya. Ujian ini TIDAK
      // membuktikan keselamatan concurrency sebenar Apps Script.
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5' },
      computeDigest(algo, teks) {
        const buf = crypto.createHash(algo).update(String(teks), 'utf8').digest();
        // Apps Script memulangkan bait bertanda (-128..127).
        return [...buf].map((b) => (b > 127 ? b - 256 : b));
      },
      getUuid: () => crypto.randomUUID(),
      formatDate(d, tz, fmt) {
        const p = (n) => String(n).padStart(2, '0');
        if (fmt === 'yy') return String(d.getFullYear()).slice(-2);
        if (fmt === 'yyyy') return String(d.getFullYear());
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      }
    },
    Logger: { log: (m) => log.push(String(m)) },
    ScriptApp: {
      getProjectTriggers: () => [],
      deleteTrigger: () => {},
      newTrigger: () => ({
        timeBased: () => ({ atHour: () => ({ everyDays: () => ({ create: () => {} }) }) })
      })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (t) => ({ _teks: t, setMimeType() { return this; }, getContent() { return this._teks; } })
    }
  };
  global.globalThis = global;
  return { global, log, helaian };
}

module.exports = { buatPersekitaran };
