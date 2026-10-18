/**
 * Kerja berjadual. Pasang sekali melalui pasangTrigger().
 * Apps Script ada penjadual sendiri — tiada cron luar diperlukan.
 */
function sweepHarian() {
  var sekarang = new Date().getTime();
  var dibuang = 0;

  dgnKunci(function () {
    var shSesi = _helaian(HELAIAN.SESI_LOGIN);
    bacaSemua(HELAIAN.SESI_LOGIN)
      .filter(function (s) {
        var t = new Date(s.TamatPada).getTime();
        return isNaN(t) || t < sekarang;
      })
      .sort(function (a, b) { return b._baris - a._baris; })  // bawah ke atas
      .forEach(function (s) { shSesi.deleteRow(s._baris); dibuang++; });

    var shHad = _helaian(HELAIAN.HAD);
    bacaSemua(HELAIAN.HAD)
      .filter(function (h) {
        var t = new Date(h.ResetPada).getTime();
        return isNaN(t) || t < sekarang - 86400000;
      })
      .sort(function (a, b) { return b._baris - a._baris; })
      .forEach(function (h) { shHad.deleteRow(h._baris); });
  });

  Logger.log('sweepHarian: ' + dibuang + ' sesi tamat dibuang.');
  return { sesiDibuang: dibuang };
}

function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sweepHarian') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sweepHarian').timeBased().atHour(3).everyDays(1).create();
  return 'Trigger harian dipasang (lebih kurang 3 pagi).';
}
