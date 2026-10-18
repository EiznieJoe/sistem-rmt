/**
 * Titik masuk web app.
 *
 * URL /exec ini ialah endpoint API AWAM, bukan rahsia. Sesiapa boleh
 * memanggilnya dari curl atau Postman tanpa pernah membuka borang. Sebab
 * itu setiap tindakan di bawah mengesahkan inputnya sendiri, dan setiap
 * tindakan pegawai bermula dengan perluAuth().
 *
 * Nota CORS: Apps Script tidak menjawab permintaan preflight OPTIONS.
 * Klien MESTI menghantar POST dengan Content-Type: text/plain supaya ia
 * kekal sebagai "simple request" dan tiada preflight berlaku. Badan
 * permintaan tetap JSON; ia dihurai di sini.
 */

var TINDAKAN_AWAM = {
  senaraiSekolah: function () { return senaraiSekolah(); },
  hantar:         function (d) { return awamHantar(d); },
  semakStatus:    function (d) { return awamSemakStatus(d); },
  tarikBalik:     function (d) { return awamTarikBalik(d); },
  hantarSemula:   function (d) { return awamHantarSemula(d); }
};

var TINDAKAN_STAF = {
  logKeluar:         function (t) { return logKeluar(t); },
  senarai:           function (t, d) { return stafSenarai(t, d); },
  butiran:           function (t, d) { return stafButiran(t, d); },
  mulaSemakan:       function (t, d) { return stafMulaSemakan(t, d); },
  pulangkan:         function (t, d) { return stafPulangkan(t, d); },
  keKelulusan:       function (t, d) { return stafKeKelulusan(t, d); },
  tolakTerus:        function (t, d) { return stafTolakTerus(t, d); },
  putuskan:          function (t, d) { return stafPutuskan(t, d); },
  pulangKePenyemak:  function (t, d) { return stafPulangKePenyemak(t, d); }
};

function _balas(objek) {
  return ContentService
    .createTextOutput(JSON.stringify(objek))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  // Tiada data didedahkan di sini — hanya penanda bahawa deployment hidup.
  return _balas({ ok: true, sistem: 'Permohonan RMT', nota: 'Guna POST untuk semua tindakan.' });
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
    if (TINDAKAN_STAF[tindakan]) {
      // Token disahkan DI DALAM setiap fungsi staf, bukan di sini sahaja —
      // supaya tiada fungsi baharu boleh terlepas semakan secara tak sengaja.
      return _balas({ ok: true, data: TINDAKAN_STAF[tindakan](token, data) });
    }
    return _balas({ ok: false, ralat: 'Tindakan tidak dikenali.' });
  } catch (err) {
    if (err && err.mesra) {
      return _balas({ ok: false, ralat: String(err.message) });
    }
    // Ralat tak dijangka: butiran penuh ke log sahaja.
    Logger.log('RALAT [' + tindakan + '] ' + (err && err.stack ? err.stack : err));
    return _balas({ ok: false, ralat: 'Ralat sistem. Sila cuba lagi atau hubungi pihak sekolah.' });
  }
}
