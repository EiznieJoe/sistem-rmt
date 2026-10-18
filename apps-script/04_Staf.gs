/**
 * Tindakan pegawai. Setiap satu bermula dengan perluAuth() — tiada
 * pengecualian. Sembunyikan butang di frontend hanyalah UX; kebenaran
 * sebenar dikuatkuasakan di sini.
 */

/**
 * Saringan automatik. MENASIHAT, tidak memutuskan.
 *
 * Pendapatan yang diisytihar belum disemak terhadap dokumen, jadi menolak
 * secara automatik bermakna menolak atas maklumat yang belum disahkan.
 * Penyemak yang menekan "Tolak terus" bila dia sudah pasti.
 */
function _saringan(p) {
  if (!p) return [];
  var bendera = [];
  var had = kriteria('pgk_per_kapita');

  if (had !== null && Number(p.PendapatanPerKapita) > had && p.EKasih !== true) {
    bendera.push('Pendapatan per kapita RM' + Number(p.PendapatanPerKapita).toFixed(2) +
                 ' melebihi had RM' + had);
  }
  if (p.EKasih === true && !String(p.NoEKasih || '').trim()) {
    bendera.push('Tanda eKasih dipilih tetapi nombor eKasih tiada');
  }
  var lulusLain = bacaSemua(HELAIAN.PERMOHONAN).filter(function (x) {
    return String(x.MuridIC) === String(p.MuridIC) &&
           String(x.NoRujukan) !== String(p.NoRujukan) &&
           String(x.Status) === STATUS.LULUS;
  });
  if (lulusLain.length) bendera.push('Murid ini sudah ada permohonan LULUS');

  return bendera;
}

function stafSenarai(token, data) {
  var sesi = perluAuth(token, [PERANAN.PENYEMAK, PERANAN.PELULUS]);
  var tapisStatus = data && data.status ? String(data.status) : '';

  // Penapisan ikut sekolah berlaku DI SINI, bukan di klien. Jangan sesekali
  // pulangkan semua baris dan biar frontend menapis.
  var baris = bacaSemua(HELAIAN.PERMOHONAN).filter(function (p) {
    if (sesi.peranan !== PERANAN.ADMIN && String(p.SekolahKod) !== sesi.sekolahKod) return false;
    if (tapisStatus && String(p.Status) !== tapisStatus) return false;
    return true;
  });

  return {
    saya: { nama: sesi.label, emel: sesi.emel, peranan: sesi.peranan, sekolahKod: sesi.sekolahKod },
    sla: {
      semakan: tetapanInt('sla_hari_semakan', 7),
      kelulusan: tetapanInt('sla_hari_kelulusan', 5)
    },
    permohonan: baris.map(function (p) {
      return {
        noRujukan: String(p.NoRujukan),
        status: String(p.Status),
        muridNama: String(p.MuridNama),
        muridIC: String(p.MuridIC),
        muridTahun: Number(p.MuridTahun),
        muridKelas: String(p.MuridKelas || ''),
        penjagaNama: String(p.PenjagaNama),
        penjagaTelefon: String(p.PenjagaTelefon),
        penjagaHubungan: String(p.PenjagaHubungan),
        bilIsiRumah: Number(p.BilIsiRumah),
        pendapatanIsiRumah: Number(p.PendapatanIsiRumah),
        pendapatanPerKapita: Number(p.PendapatanPerKapita),
        eKasih: p.EKasih === true,
        noEKasih: String(p.NoEKasih || ''),
        kaliDipulangkan: Number(p.KaliDipulangkan || 0),
        catatanPenyemak: String(p.CatatanPenyemak || ''),
        catatanPelulus: String(p.CatatanPelulus || ''),
        sebabTolak: String(p.SebabTolak || ''),
        penyemakEmel: String(p.PenyemakEmel || ''),
        tarikhHantar: _iso(p.TarikhHantar),
        tarikhSemakan: _iso(p.TarikhSemakan),
        tarikhKeputusan: _iso(p.TarikhKeputusan)
      };
    })
  };
}

function stafButiran(token, data) {
  var sesi = perluAuth(token, [PERANAN.PENYEMAK, PERANAN.PELULUS]);
  var p = cariBaris(HELAIAN.PERMOHONAN, 'NoRujukan', bersihTeks(data.noRujukan, 20));
  if (!p) throw Ralat('Permohonan tidak dijumpai.');
  perluSekolahSama(sesi, p);

  var jejak = bacaSemua(HELAIAN.AUDIT)
    .filter(function (a) { return String(a.NoRujukan) === String(p.NoRujukan); })
    .map(function (a) {
      return {
        masa: _iso(a.Masa), tindakan: String(a.Tindakan),
        pelaku: String(a.PelakuLabel), statusDari: String(a.StatusDari || ''),
        statusKe: String(a.StatusKe || ''), sebab: String(a.Sebab || '')
      };
    })
    .sort(function (a, b) { return (b.masa || '').localeCompare(a.masa || ''); });

  return { saringan: _saringan(p), audit: jejak };
}

/* ------------------------------------------------------------------ */

/** Baca-semak-tulis di bawah satu kunci, supaya status tak berlumba. */
function _tindakan(token, perananDibenarkan, noRujukan, statusDibenarkan, kerja) {
  var sesi = perluAuth(token, perananDibenarkan);
  var ruj = bersihTeks(noRujukan, 20);

  return dgnKunci(function () {
    var p = cariBaris(HELAIAN.PERMOHONAN, 'NoRujukan', ruj);
    if (!p) throw Ralat('Permohonan tidak dijumpai.');
    perluSekolahSama(sesi, p);
    if (statusDibenarkan && statusDibenarkan.indexOf(String(p.Status)) < 0) {
      throw Ralat('Tindakan ini tidak sah untuk status ' + p.Status + '.');
    }
    return kerja(sesi, p);
  });
}

function stafMulaSemakan(token, data) {
  return _tindakan(token, [PERANAN.PENYEMAK], data.noRujukan,
    [STATUS.DIHANTAR], function (sesi, p) {
      kemasBaris(HELAIAN.PERMOHONAN, p._baris, {
        Status: STATUS.DALAM_SEMAKAN, PenyemakEmel: sesi.emel,
        TarikhSemakan: new Date(), DikemaskiniPada: new Date()
      });
      audit(String(p.NoRujukan), 'MULA_SEMAKAN', String(p.Status),
            STATUS.DALAM_SEMAKAN, '', null, sesi);
      return { status: STATUS.DALAM_SEMAKAN };
    });
}

function stafPulangkan(token, data) {
  var catatan = bersihTeks(data.catatan, 1000);
  if (!catatan) {
    throw Ralat('Catatan wajib — pemohon perlu tahu apa yang hendak dibetulkan.');
  }
  return _tindakan(token, [PERANAN.PENYEMAK, PERANAN.PELULUS], data.noRujukan,
    [STATUS.DIHANTAR, STATUS.DALAM_SEMAKAN], function (sesi, p) {
      var had = tetapanInt('had_pulangan', 3);
      var kali = Number(p.KaliDipulangkan || 0);
      if (kali >= had) {
        throw Ralat('Had ' + had + ' kali pulangan sudah dicapai. ' +
                        'Buat keputusan LULUS atau TOLAK.');
      }
      var tamat = new Date();
      tamat.setDate(tamat.getDate() + tetapanInt('hari_tempoh_betul', 14));

      kemasBaris(HELAIAN.PERMOHONAN, p._baris, {
        Status: STATUS.DIPULANGKAN,
        CatatanPenyemak: catatan,
        KaliDipulangkan: kali + 1,
        PenyemakEmel: String(p.PenyemakEmel || '') || sesi.emel,
        TamatTempohBetul: tamat,
        DikemaskiniPada: new Date()
      });
      audit(String(p.NoRujukan), 'PULANGKAN', String(p.Status), STATUS.DIPULANGKAN,
            catatan, { kaliDipulangkan: kali + 1 }, sesi);
      return { status: STATUS.DIPULANGKAN };
    });
}

function stafKeKelulusan(token, data) {
  var catatan = bersihTeks(data.catatan, 1000);
  return _tindakan(token, [PERANAN.PENYEMAK], data.noRujukan,
    [STATUS.DIHANTAR, STATUS.DALAM_SEMAKAN], function (sesi, p) {
      kemasBaris(HELAIAN.PERMOHONAN, p._baris, {
        Status: STATUS.DALAM_KELULUSAN,
        // Penyemak rasmi = orang yang menghantarnya ke kelulusan.
        PenyemakEmel: sesi.emel,
        CatatanPenyemak: catatan,
        TarikhSemakan: p.TarikhSemakan || new Date(),
        DikemaskiniPada: new Date()
      });
      audit(String(p.NoRujukan), 'KE_KELULUSAN', String(p.Status),
            STATUS.DALAM_KELULUSAN, catatan, null, sesi);
      return { status: STATUS.DALAM_KELULUSAN };
    });
}

function stafTolakTerus(token, data) {
  var sebab = bersihTeks(data.sebab, 1000);
  if (!sebab) throw Ralat('Sebab tolak wajib.');
  return _tindakan(token, [PERANAN.PENYEMAK], data.noRujukan,
    [STATUS.DIHANTAR, STATUS.DALAM_SEMAKAN], function (sesi, p) {
      kemasBaris(HELAIAN.PERMOHONAN, p._baris, {
        Status: STATUS.TOLAK, SebabTolak: sebab,
        PenyemakEmel: String(p.PenyemakEmel || '') || sesi.emel,
        TarikhKeputusan: new Date(), DikemaskiniPada: new Date()
      });
      audit(String(p.NoRujukan), 'TOLAK_TERUS', String(p.Status),
            STATUS.TOLAK, sebab, null, sesi);
      return { status: STATUS.TOLAK };
    });
}

function stafPutuskan(token, data) {
  var lulus = data.lulus === true;
  var sebab = bersihTeks(data.sebab, 1000);
  if (!lulus && !sebab) throw Ralat('Sebab tolak wajib.');

  return _tindakan(token, [PERANAN.PELULUS], data.noRujukan,
    [STATUS.DALAM_KELULUSAN], function (sesi, p) {
      /**
       * Pengasingan tugas. Medan PenyemakEmel sahaja tidak mencukupi — ia
       * merekod seorang sahaja, jadi admin yang menyemak sendiri boleh
       * terlepas. Jejak audit merekod SETIAP tindakan semakan.
       */
      var terlibat = String(p.PenyemakEmel || '').toLowerCase() === sesi.emel ||
        bacaSemua(HELAIAN.AUDIT).some(function (a) {
          return String(a.NoRujukan) === String(p.NoRujukan) &&
                 String(a.PelakuEmel).toLowerCase() === sesi.emel &&
                 TINDAKAN_SEMAKAN.indexOf(String(a.Tindakan)) >= 0;
        });
      if (terlibat) {
        throw Ralat('Anda terlibat dalam semakan permohonan ini. ' +
                        'Pelulus lain perlu memutuskan.');
      }

      var status = lulus ? STATUS.LULUS : STATUS.TOLAK;
      kemasBaris(HELAIAN.PERMOHONAN, p._baris, {
        Status: status, PelulusEmel: sesi.emel, CatatanPelulus: sebab,
        SebabTolak: lulus ? '' : sebab,
        TarikhKeputusan: new Date(), DikemaskiniPada: new Date()
      });
      audit(String(p.NoRujukan), 'KEPUTUSAN', String(p.Status), status, sebab, null, sesi);
      return { status: status };
    });
}

function stafPulangKePenyemak(token, data) {
  var catatan = bersihTeks(data.catatan, 1000);
  if (!catatan) throw Ralat('Catatan wajib.');
  return _tindakan(token, [PERANAN.PELULUS], data.noRujukan,
    [STATUS.DALAM_KELULUSAN], function (sesi, p) {
      kemasBaris(HELAIAN.PERMOHONAN, p._baris, {
        Status: STATUS.DALAM_SEMAKAN, CatatanPelulus: catatan,
        DikemaskiniPada: new Date()
      });
      audit(String(p.NoRujukan), 'PULANG_KE_PENYEMAK', String(p.Status),
            STATUS.DALAM_SEMAKAN, catatan, null, sesi);
      return { status: STATUS.DALAM_SEMAKAN };
    });
}
