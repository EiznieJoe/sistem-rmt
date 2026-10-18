/**
 * Kerja harian. Pasang trigger sekali melalui pasangTrigger(), atau
 * secara manual: Apps Script editor -> Triggers -> Add Trigger ->
 * sweepHarian, Time-driven, Day timer, 9am-10am.
 *
 * Tidak perlu GitHub Actions di sini — Apps Script ada penjadual sendiri.
 */
function sweepHarian() {
  var gugur = 0, anonim = 0;
  var hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);

  dgnKunci(function () {
    var semua = bacaSemua(HELAIAN.PERMOHONAN);

    semua.forEach(function (p) {
      // 1) Gugurkan permohonan yang tamat tempoh pembetulan.
      if (String(p.Status) === STATUS.DIPULANGKAN && p.TamatTempohBetul) {
        var tamat = new Date(p.TamatTempohBetul);
        if (!isNaN(tamat.getTime()) && tamat < hariIni) {
          kemasBaris(HELAIAN.PERMOHONAN, p._baris, {
            Status: STATUS.GUGUR, DikemaskiniPada: new Date()
          });
          audit(String(p.NoRujukan), 'AUTO_GUGUR', String(p.Status), STATUS.GUGUR,
                'Tempoh pembetulan tamat', null, { label: 'sistem' });
          gugur++;
          return;
        }
      }

      // 2) Retention PDPA: buang data peribadi, kekalkan baris untuk statistik.
      if (p.Dianonimkan !== true && p.PadamSelepas) {
        var padam = new Date(p.PadamSelepas);
        if (!isNaN(padam.getTime()) && padam < hariIni) {
          kemasBaris(HELAIAN.PERMOHONAN, p._baris, {
            PenjagaNama: '[dibuang]',
            PenjagaTelefon: '[dibuang]',
            MuridNama: '[dibuang]',
            MuridIC: 'ANON-' + String(p.NoRujukan).replace(/[^A-Z0-9]/g, ''),
            MuridKelas: '',
            NoEKasih: '',
            CatatanPenyemak: '',
            CatatanPelulus: '',
            Dianonimkan: true,
            DikemaskiniPada: new Date()
          });
          audit(String(p.NoRujukan), 'ANONIM_RETENTION', String(p.Status),
                String(p.Status), 'Tempoh simpanan tamat', null, { label: 'sistem' });
          anonim++;
        }
      }
    });

    // 3) Buang sesi log masuk dan kaunter had yang sudah tamat.
    var sekarang = new Date().getTime();
    var shSesi = _helaian(HELAIAN.SESI_LOGIN);
    bacaSemua(HELAIAN.SESI_LOGIN)
      .filter(function (s) {
        var t = new Date(s.TamatPada).getTime();
        return isNaN(t) || t < sekarang;
      })
      .sort(function (a, b) { return b._baris - a._baris; })  // bawah ke atas
      .forEach(function (s) { shSesi.deleteRow(s._baris); });

    var shHad = _helaian(HELAIAN.HAD);
    bacaSemua(HELAIAN.HAD)
      .filter(function (h) {
        var t = new Date(h.ResetPada).getTime();
        return isNaN(t) || t < sekarang - 86400000;
      })
      .sort(function (a, b) { return b._baris - a._baris; })
      .forEach(function (h) { shHad.deleteRow(h._baris); });
  });

  Logger.log('sweepHarian: ' + gugur + ' gugur, ' + anonim + ' dianonimkan.');
  return { gugur: gugur, dianonimkan: anonim };
}

function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sweepHarian') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sweepHarian').timeBased().atHour(9).everyDays(1).create();
  return 'Trigger harian dipasang untuk sweepHarian (lebih kurang 9 pagi).';
}
