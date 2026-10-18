/**
 * Titik masuk web app.
 *
 * URL /exec ialah endpoint API AWAM, bukan rahsia. Sesiapa boleh
 * memanggilnya dari curl tanpa pernah membuka muka surat. Sebab itu
 * SETIAP tindakan di bawah bermula dengan perluAuth() — tiada tindakan
 * tanpa token, kerana sistem ini tiada pengguna awam langsung.
 *
 * Nota CORS: Apps Script tidak menjawab preflight OPTIONS. Klien MESTI
 * POST dengan Content-Type: text/plain supaya ia kekal "simple request".
 * Badan tetap JSON dan dihurai di sini.
 */

/**
 * Tindakan AWAM — tiada token. Hanya ini. Semua yang lain perlukan sesi.
 * Kedua-duanya menjaga dirinya sendiri: had permintaan per emel, dan
 * jawapan yang sama tanpa mengira emel itu wujud atau tidak.
 */
var TINDAKAN_AWAM = {
  mintaResetKod:   function (d) { return mintaResetKod(d); },
  sahkanResetKod:  function (d) { return sahkanResetKod(d); }
};

var TINDAKAN = {
  logKeluar:        function (t) { return logKeluar(t); },
  tukarKataLaluan:  function (t, d) { return tukarKataLaluan(t, d); },
  kelasSaya:        function (t) { return guruKelasSaya(t); },
  senaraiMurid:     function (t, d) { return guruSenaraiMurid(t, d); },
  kemasMurid:       function (t, d) { return guruKemasMurid(t, d); },
  sahkanMurid:      function (t, d) { return guruSahkanMurid(t, d); },
  sahkanKelas:      function (t, d) { return guruSahkanKelas(t, d); },
  ringkasan:        function (t) { return penyelarasRingkasan(t); },
  senaraiPenuh:     function (t, d) { return penyelarasSenarai(t, d); },
  tetapan:          function (t) { return penyelarasTetapan(t); },
  ubahTetapan:      function (t, d) { return penyelarasUbahTetapan(t, d); },
  audit:            function (t, d) { return lihatAudit(t, d); }
};

function _balas(objek) {
  return ContentService.createTextOutput(JSON.stringify(objek))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  // Tiada data didedahkan — hanya penanda bahawa deployment hidup.
  return _balas({ ok: true, sistem: 'Kelayakan RMT',
                  nota: 'Guna POST untuk semua tindakan.' });
}

function doPost(e) {
  var badan;
  try {
    badan = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return _balas({ ok: false, ralat: 'Permintaan tidak sah.' });
  }

  var tindakan = String(badan.tindakan || '');
  var data = badan.data || {};
  var token = badan.token ? String(badan.token) : '';

  try {
    if (tindakan === 'logMasuk') {
      return _balas({ ok: true, data: logMasuk(badan.emel, badan.katalaluan) });
    }
    if (TINDAKAN_AWAM[tindakan]) {
      return _balas({ ok: true, data: TINDAKAN_AWAM[tindakan](data) });
    }
    if (TINDAKAN[tindakan]) {
      return _balas({ ok: true, data: TINDAKAN[tindakan](token, data) });
    }
    return _balas({ ok: false, ralat: 'Tindakan tidak dikenali.' });
  } catch (err) {
    if (err && err.mesra) return _balas({ ok: false, ralat: String(err.message) });
    // Ralat tak dijangka: butiran penuh ke log sahaja, bukan ke klien.
    Logger.log('RALAT [' + tindakan + '] ' + (err && err.stack ? err.stack : err));
    return _balas({ ok: false,
      ralat: 'Ralat sistem. Sila cuba lagi atau hubungi pentadbir sistem.' });
  }
}
