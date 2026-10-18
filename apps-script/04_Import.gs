/**
 * Import dari eksport iDME.
 *
 * Cara guna: pentadbir menampal keseluruhan eksport iDME (termasuk baris
 * tajuk laporan) ke helaian "ImportMentah", kemudian menjalankan
 * importDariHelaian() dari editor Apps Script.
 *
 * Lajur dipadankan mengikut NAMA KEPALA, bukan kedudukan. Kalau iDME
 * menyusun semula lajurnya atau menambah lajur baharu, import tetap
 * berfungsi. Kalau kepala yang diperlukan hilang, import berhenti dan
 * menamakannya — ia tidak meneka.
 */

/** kepala iDME -> medan Murid. */
var PETA_IDME = {
  'ID MURID':                   'IdMurid',
  'NAMA':                       'Nama',
  'NO. PENGENALAN':             'NoPengenalan',
  'JENIS PENGENALAN':           'JenisPengenalan',
  'TAHUN / TINGKATAN':          'Tahun',
  'NAMA KELAS':                 'NamaKelas',
  'WARGANEGARA':                'Warganegara',
  'STATUS ASRAMA':              'StatusAsrama',
  'STATUS OKU':                 'StatusOku',
  'PENJAGA 1':                  'PenjagaNama',
  'HUBUNGAN PENJAGA 1':         'HubunganPenjaga',
  'NO. TEL. BIMBIT PENJAGA 1':  'PenjagaTelefon',
  'PENDAPATAN PENJAGA 1':       'PendapatanPenjaga1',
  'PENDAPATAN PENJAGA 2':       'PendapatanPenjaga2',
  'TANGGUNGAN':                 'Tanggungan'
};

/** Kepala yang WAJIB ada. Tanpa ini kelayakan tak boleh dinilai langsung. */
var KEPALA_WAJIB = ['ID MURID', 'NAMA', 'TAHUN / TINGKATAN', 'NAMA KELAS'];

/** Kepala tambahan yang dibaca tetapi tidak disimpan dalam Murid. */
var KEPALA_GURU   = 'NAMA GURU KELAS';
var KEPALA_STATUS = 'STATUS PENGAJIAN';

function _normalKepala(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Cari baris kepala di mana-mana dalam 30 baris pertama. */
function _cariKepala(matriks) {
  for (var i = 0; i < Math.min(matriks.length, 30); i++) {
    var normal = matriks[i].map(_normalKepala);
    if (normal.indexOf('ID MURID') >= 0) return { baris: i, kepala: normal };
  }
  return null;
}

function importDariHelaian() {
  var sh = _ss().getSheetByName(HELAIAN.IMPORT_MENTAH);
  if (!sh || sh.getLastRow() < 2) {
    throw Ralat('Helaian "' + HELAIAN.IMPORT_MENTAH + '" kosong. ' +
                'Tampal eksport iDME ke situ dahulu.');
  }
  var matriks = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  return _prosesImport(matriks, { emel: 'editor', label: 'pentadbir (editor)' });
}

function _prosesImport(matriks, pelaku) {
  var jumpa = _cariKepala(matriks);
  if (!jumpa) {
    throw Ralat('Tiada lajur "ID MURID" dijumpai dalam 30 baris pertama. ' +
                'Pastikan keseluruhan eksport iDME ditampal, termasuk baris kepala.');
  }

  var idx = {};
  jumpa.kepala.forEach(function (h, j) { if (h && !(h in idx)) idx[h] = j; });

  var hilang = KEPALA_WAJIB.filter(function (h) { return !(h in idx); });
  if (hilang.length) {
    throw Ralat('Lajur wajib tiada dalam eksport: ' + hilang.join(', ') + '.');
  }

  var amaran = [];
  Object.keys(PETA_IDME).forEach(function (h) {
    if (!(h in idx)) amaran.push('Lajur "' + h + '" tiada — medan ' +
                                 PETA_IDME[h] + ' akan dibiarkan kosong.');
  });

  var sesi = sesiSemasa();
  var sekolahKod = bersihTeks(tetapan('sekolah_kod', ''), 20);
  if (!sekolahKod) {
    var senaraiSekolah = bacaSemua(HELAIAN.SEKOLAH).filter(function (s) { return s.Aktif === true; });
    if (senaraiSekolah.length !== 1) {
      throw Ralat('Tetapkan "sekolah_kod" dalam helaian Tetapan — ' +
                  senaraiSekolah.length + ' sekolah aktif didaftarkan.');
    }
    sekolahKod = String(senaraiSekolah[0].Kod);
  }

  // --- Baca baris import
  var ambil = function (r, kepala) {
    var j = idx[kepala];
    return (j === undefined || j >= r.length) ? '' : r[j];
  };

  var masuk = [];
  var guruIkutKelas = {};
  var dilangkau = 0;

  for (var i = jumpa.baris + 1; i < matriks.length; i++) {
    var r = matriks[i];
    var id = String(ambil(r, 'ID MURID') || '').trim();
    if (!/^[0-9]+$/.test(id)) { continue; }   // baris tajuk/kosong/jumlah

    // Perenggan 3.1: hanya murid yang sedang bersekolah
    if (KEPALA_STATUS in idx) {
      var sp = _normalKepala(ambil(r, KEPALA_STATUS));
      if (sp && sp !== 'BERSEKOLAH') { dilangkau++; continue; }
    }

    var rec = { IdMurid: id };
    Object.keys(PETA_IDME).forEach(function (h) {
      var medan = PETA_IDME[h];
      var nilai = ambil(r, h);
      rec[medan] = MEDAN_NOMBOR.indexOf(medan) >= 0
        ? keNombor(nilai)
        : bersihTeks(nilai, 200);
    });
    rec.KelasId = kelasId(rec.Tahun, rec.NamaKelas);
    rec.SekolahKod = sekolahKod;
    rec.Sesi = sesi;

    if (KEPALA_GURU in idx) {
      var g = bersihTeks(ambil(r, KEPALA_GURU), 150);
      if (g && !guruIkutKelas[rec.KelasId]) guruIkutKelas[rec.KelasId] = g;
    }
    masuk.push(rec);
  }

  if (!masuk.length) throw Ralat('Tiada baris murid sah dijumpai dalam import.');

  var idUnik = {};
  var pendua = [];
  masuk.forEach(function (m) {
    if (idUnik[m.IdMurid]) pendua.push(m.IdMurid);
    idUnik[m.IdMurid] = true;
  });
  if (pendua.length) {
    amaran.push('ID MURID berulang dalam import (rekod terakhir digunakan): ' +
                pendua.slice(0, 5).join(', ') + (pendua.length > 5 ? ' ...' : ''));
  }

  // --- Gabung dengan data sedia ada
  return dgnKunci(function () {
    var sedia = bacaSemua(HELAIAN.MURID);
    var ikutId = {};
    sedia.forEach(function (m) { ikutId[String(m.IdMurid)] = m; });

    var baharu = 0, dikemaskini = 0, konflik = [];
    var sekarang = new Date();
    var jejak = [];

    masuk.forEach(function (rec) {
      var lama = ikutId[rec.IdMurid];
      if (!lama) {
        rec.MedanDiubah = ''; rec.CatatanGuru = ''; rec.Aktif = true;
        rec.StatusDokumen = ''; rec.TarikhHantarDokumen = '';
        rec.CatatanDokumen = ''; rec.DokumenOleh = ''; rec.DokumenPada = '';
        rec.DiimportPada = sekarang; rec.DikemaskiniPada = sekarang;
        ikutId[rec.IdMurid] = rec;
        sedia.push(rec);
        baharu++;
        return;
      }

      /**
       * Import semula TIDAK memadam pembetulan guru.
       * Medan yang guru dah ubah dikekalkan. Kalau import membawa nilai
       * berbeza untuk medan itu, ia dicatat sebagai konflik untuk
       * penyelaras tengok — bukan ditimpa senyap-senyap.
       */
      var diubah = String(lama.MedanDiubah || '').split(',')
        .map(function (s) { return s.trim(); }).filter(Boolean);
      var perubahan = {};

      Object.keys(PETA_IDME).forEach(function (h) {
        var medan = PETA_IDME[h];
        if (medan === 'IdMurid') return;
        var baru = rec[medan];
        if (diubah.indexOf(medan) >= 0) {
          var sama = String(lama[medan] === null ? '' : lama[medan]) ===
                     String(baru === null ? '' : baru);
          if (!sama) {
            konflik.push({ IdMurid: rec.IdMurid, medan: medan,
                           guru: lama[medan], import: baru });
          }
          return;  // nilai guru menang
        }
        var sediaAdaStr = String(lama[medan] === null ? '' : lama[medan]);
        var baruStr = String(baru === null ? '' : baru);
        if (sediaAdaStr !== baruStr) {
          perubahan[medan] = { dari: lama[medan], ke: baru };
          lama[medan] = baru;
        }
      });

      // Medan struktur sentiasa ikut import — guru tak boleh ubah kelas.
      ['Tahun', 'NamaKelas', 'KelasId', 'SekolahKod', 'Sesi'].forEach(function (k) {
        if (String(lama[k]) !== String(rec[k])) {
          perubahan[k] = { dari: lama[k], ke: rec[k] };
          lama[k] = rec[k];
        }
      });

      if (lama.Aktif !== true) { perubahan.Aktif = { dari: false, ke: true }; lama.Aktif = true; }

      if (Object.keys(perubahan).length) {
        lama.DikemaskiniPada = sekarang;
        dikemaskini++;
        jejak.push({ idMurid: rec.IdMurid, tindakan: 'IMPORT_KEMASKINI',
                     perubahan: perubahan, pelaku: pelaku });
      }
    });

    // Murid yang tiada lagi dalam import: tandakan tidak aktif, JANGAN padam.
    var tiadaLagi = 0;
    sedia.forEach(function (m) {
      if (!idUnik[String(m.IdMurid)] && m.Aktif !== false) {
        m.Aktif = false;
        m.DikemaskiniPada = sekarang;
        tiadaLagi++;
        jejak.push({ idMurid: String(m.IdMurid), tindakan: 'TIADA_DALAM_IMPORT',
                     sebab: 'Tidak hadir dalam eksport iDME terkini', pelaku: pelaku });
      }
    });

    _simpanSemuaMurid(sedia);
    _segarkanKelas(masuk, guruIkutKelas, sekolahKod, sesi, pelaku);

    if (jejak.length) auditBanyak(jejak.slice(0, 500));
    if (jejak.length > 500) {
      amaran.push(jejak.length + ' perubahan direkod; 500 pertama sahaja ditulis ke Audit.');
    }
    if (tiadaLagi) {
      amaran.push(tiadaLagi + ' murid tiada dalam import ini dan ditanda tidak aktif.');
    }
    if (konflik.length) {
      amaran.push(konflik.length + ' medan yang guru dah betulkan berbeza dari import. ' +
                  'Nilai guru dikekalkan. Lihat ImportLog.');
    }

    tambahBaris(HELAIAN.IMPORT_LOG, {
      Masa: sekarang, PelakuEmel: pelaku.emel,
      BarisDibaca: masuk.length, Baharu: baharu, Dikemaskini: dikemaskini,
      Dilangkau: dilangkau,
      Konflik: konflik.length ? JSON.stringify(konflik.slice(0, 50)) : '',
      Amaran: amaran.join(' | ')
    });

    /**
     * Kosongkan helaian staging selepas import berjaya.
     *
     * Tanpa ini: import berikutnya yang lebih kecil ditampal atas yang lama
     * meninggalkan baris murid lama di bawahnya. Baris itu dibaca semula
     * sebagai murid sah, jadi murid yang sudah bertukar sekolah kekal
     * "aktif" selama-lamanya dan tidak pernah ditanda tiada dalam import.
     * Kegagalan senyap yang hanya muncul pada import kedua.
     */
    var shMentah = _ss().getSheetByName(HELAIAN.IMPORT_MENTAH);
    if (shMentah && shMentah.getLastRow() > 0 && shMentah.getLastColumn() > 0) {
      shMentah.getRange(1, 1, shMentah.getLastRow(), shMentah.getLastColumn())
        .clearContent();
    }

    var ringkas = {
      barisDibaca: masuk.length, baharu: baharu, dikemaskini: dikemaskini,
      dilangkau: dilangkau, tiadaLagi: tiadaLagi, konflik: konflik.length,
      amaran: amaran,
      nota: 'Helaian ' + HELAIAN.IMPORT_MENTAH + ' dikosongkan supaya import ' +
            'berikutnya bermula bersih.'
    };
    Logger.log(JSON.stringify(ringkas, null, 2));
    return ringkas;
  });
}

/** Tulis seluruh blok Murid dalam satu setValues — 1,400 setValue terlalu lambat. */
function _simpanSemuaMurid(senarai) {
  var sh = _helaian(HELAIAN.MURID);
  var kepala = LAJUR[HELAIAN.MURID];
  if (!senarai.length) return;
  var matriks = senarai.map(function (o) {
    return kepala.map(function (k) { return bersihUntukSheet(o[k]); });
  });
  var akhir = sh.getLastRow();
  if (akhir > 1) sh.getRange(2, 1, akhir - 1, kepala.length).clearContent();
  sh.getRange(2, 1, matriks.length, kepala.length).setValues(matriks);
}

/**
 * Kemas kini senarai kelas dari import.
 *
 * GuruEmel SENGAJA tidak disentuh di sini. Guru kelas bertukar setiap
 * tahun dan ditugaskan oleh pentadbir melalui tugaskanGuru(). Import
 * hanya membawa NAMA guru dari iDME sebagai rujukan, supaya pentadbir
 * tahu nama mana belum ada akaun.
 */
function _segarkanKelas(masuk, guruIkutKelas, sekolahKod, sesi, pelaku) {
  var sedia = bacaSemua(HELAIAN.KELAS);
  var ikutId = {};
  sedia.forEach(function (k) { ikutId[String(k.KelasId) + '|' + String(k.Sesi)] = k; });

  var dilihat = {};
  masuk.forEach(function (m) { dilihat[m.KelasId] = m; });

  var baharu = [];
  Object.keys(dilihat).forEach(function (kid) {
    var m = dilihat[kid];
    var ada = ikutId[kid + '|' + sesi];
    if (ada) {
      var tampalan = {};
      if (ada.Aktif !== true) tampalan.Aktif = true;
      var namaGuru = guruIkutKelas[kid] || '';
      if (namaGuru && String(ada.GuruNamaImport) !== namaGuru) {
        tampalan.GuruNamaImport = namaGuru;
      }
      if (Object.keys(tampalan).length) kemasBaris(HELAIAN.KELAS, ada._baris, tampalan);
      return;
    }
    baharu.push({
      KelasId: kid, Tahun: m.Tahun, NamaKelas: m.NamaKelas,
      SekolahKod: sekolahKod, GuruEmel: '',
      GuruNamaImport: guruIkutKelas[kid] || '', Sesi: sesi, Aktif: true
    });
  });

  if (baharu.length) tambahBanyakBaris(HELAIAN.KELAS, baharu);

  // Kelas sesi ini yang tiada lagi dalam import
  sedia.forEach(function (k) {
    if (String(k.Sesi) === sesi && !dilihat[String(k.KelasId)] && k.Aktif !== false) {
      kemasBaris(HELAIAN.KELAS, k._baris, { Aktif: false });
    }
  });
}

/** Tugaskan guru kelas kepada satu kelas. Dipanggil pentadbir dari editor. */
function tugaskanGuru(kelasIdPenuh, emelGuru) {
  var kid = bersihTeks(kelasIdPenuh, 130).toUpperCase();
  var emel = String(emelGuru || '').trim().toLowerCase();
  return dgnKunci(function () {
    var sesi = sesiSemasa();
    var kelas = bacaSemua(HELAIAN.KELAS).filter(function (k) {
      return String(k.KelasId).toUpperCase() === kid && String(k.Sesi) === sesi;
    })[0];
    if (!kelas) throw Ralat('Kelas "' + kid + '" tiada untuk sesi ' + sesi + '.');
    if (emel) {
      var staf = cariBaris(HELAIAN.STAF, 'Emel', emel);
      if (!staf) throw Ralat('Pegawai ' + emel + ' belum didaftarkan. ' +
                             'Jalankan daftarPegawai() dahulu.');
      if (staf.Aktif !== true) throw Ralat('Pegawai ' + emel + ' tidak aktif.');
    }
    kemasBaris(HELAIAN.KELAS, kelas._baris, { GuruEmel: emel });
    audit('', 'TUGAS_GURU', kid + ' -> ' + (emel || '(dikosongkan)'), null,
          { emel: 'editor', label: 'pentadbir (editor)' });
    return kid + ' ditugaskan kepada ' + (emel || '(tiada)');
  });
}

/** Kelas yang belum ada akaun guru — senarai kerja untuk pentadbir. */
function kelasTanpaGuru() {
  var sesi = sesiSemasa();
  var senarai = bacaSemua(HELAIAN.KELAS).filter(function (k) {
    return k.Aktif === true && String(k.Sesi) === sesi && !String(k.GuruEmel || '').trim();
  }).map(function (k) {
    return k.KelasId + '   (nama dalam iDME: ' + (k.GuruNamaImport || '—') + ')';
  });
  Logger.log(senarai.length ? senarai.join('\n') : 'Semua kelas sudah ada guru.');
  return senarai;
}
