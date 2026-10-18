/**
 * Tindakan awam — tiada token diperlukan.
 *
 * Pemohon TIADA akaun. Reka bentuk ini sengaja: ibu bapa tak perlu emel
 * atau kata laluan, dan sistem tak perlu menyimpan satu lagi set kelayakan
 * untuk 1,500 keluarga. Pengenalan diri ialah no. rujukan + No. KP murid,
 * dengan had percubaan supaya pasangan itu tak boleh dibrute-force.
 */

var ABJAD_RUJUKAN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tiada I O 0 1

function _rujukanBaru() {
  for (var cuba = 0; cuba < 20; cuba++) {
    var kod = 'RMT-' + Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yy') + '-';
    var bait = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, Utilities.getUuid());
    for (var i = 0; i < 8; i++) {
      kod += ABJAD_RUJUKAN.charAt(((bait[i] + 256) % 256) % ABJAD_RUJUKAN.length);
    }
    if (!cariBaris(HELAIAN.PERMOHONAN, 'NoRujukan', kod)) return kod;
  }
  throw Ralat('Gagal menjana no. rujukan. Cuba lagi.');
}

function _icBersih(nilai) {
  return String(nilai || '').replace(/[^0-9]/g, '');
}

function senaraiSekolah() {
  return bacaSemua(HELAIAN.SEKOLAH)
    .filter(function (s) { return s.Aktif === true; })
    .map(function (s) { return { kod: String(s.Kod), nama: String(s.Nama) }; })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama); });
}

/* ------------------------------------------------------------------ */

function awamHantar(data) {
  data = data || {};

  var sekolahKod = bersihTeks(data.sekolahKod, 20);
  var muridNama  = bersihTeks(data.muridNama, 150);
  var muridIC    = _icBersih(data.muridIC);
  var muridTahun = parseInt(data.muridTahun, 10);
  var penjagaNama = bersihTeks(data.penjagaNama, 150);
  var telefon    = bersihTeks(data.penjagaTelefon, 20);
  var hubungan   = bersihTeks(data.penjagaHubungan, 40);
  var bilIsiRumah = parseInt(data.bilIsiRumah, 10);
  var pendapatan = Number(data.pendapatanIsiRumah);

  // Pengesahan semula di server. Pemeriksaan di borang hanya untuk UX —
  // sesiapa boleh POST terus ke endpoint ini tanpa melalui borang.
  if (!muridNama)  throw Ralat('Nama murid diperlukan.');
  if (!/^[0-9]{12}$/.test(muridIC)) throw Ralat('No. Kad Pengenalan murid mesti 12 angka.');
  if (!(muridTahun >= 1 && muridTahun <= 6)) throw Ralat('Tahun murid mesti 1 hingga 6.');
  if (!penjagaNama) throw Ralat('Nama penjaga diperlukan.');
  if (!/^[-0-9+ ]{9,20}$/.test(telefon)) throw Ralat('Nombor telefon tidak sah.');
  if (!hubungan) throw Ralat('Hubungan dengan murid diperlukan.');
  if (!(bilIsiRumah >= 1 && bilIsiRumah <= 30)) throw Ralat('Bilangan isi rumah mesti 1 hingga 30.');
  if (!(pendapatan >= 0) || !isFinite(pendapatan)) throw Ralat('Pendapatan isi rumah tidak sah.');
  if (data.akuanBenar !== true || data.persetujuanPdpa !== true) {
    throw Ralat('Akuan dan persetujuan PDPA wajib ditanda.');
  }

  var sekolah = cariBaris(HELAIAN.SEKOLAH, 'Kod', sekolahKod);
  if (!sekolah || sekolah.Aktif !== true) throw Ralat('Sekolah tidak sah.');

  var eKasih = data.eKasih === true;
  var noEKasih = eKasih ? bersihTeks(data.noEKasih, 40) : '';

  // Kunci meliputi semakan pendua DAN penulisan. Tanpa ini, dua
  // permohonan serentak untuk murid yang sama boleh kedua-duanya lulus.
  return dgnKunci(function () {
    var sesiTahun = Number(Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy'));
    var semua = bacaSemua(HELAIAN.PERMOHONAN);

    var pendua = semua.filter(function (p) {
      return String(p.MuridIC) === muridIC &&
             Number(p.Sesi) === sesiTahun &&
             [STATUS.DITARIK_BALIK, STATUS.GUGUR].indexOf(String(p.Status)) < 0;
    });
    if (pendua.length) {
      throw Ralat('Murid ini sudah ada permohonan aktif untuk sesi ini. ' +
                      'Guna "Semak status" dengan no. rujukan yang anda terima.');
    }

    var sehariLalu = new Date().getTime() - 86400000;
    var dariTelefon = semua.filter(function (p) {
      var t = new Date(p.TarikhHantar).getTime();
      return String(p.PenjagaTelefon) === telefon && !isNaN(t) && t > sehariLalu;
    });
    if (dariTelefon.length >= tetapanInt('had_hantar_per_telefon_sehari', 5)) {
      throw Ralat('Terlalu banyak permohonan dari nombor ini hari ini.');
    }

    var noRujukan = _rujukanBaru();
    var sekarang = new Date();
    var padamSelepas = new Date(sekarang.getTime());
    padamSelepas.setFullYear(padamSelepas.getFullYear() + tetapanInt('tahun_retention', 3));

    tambahBaris(HELAIAN.PERMOHONAN, {
      NoRujukan: noRujukan,
      SekolahKod: sekolahKod,
      Status: STATUS.DIHANTAR,
      Sesi: sesiTahun,
      PenjagaNama: penjagaNama,
      PenjagaTelefon: telefon,
      PenjagaHubungan: hubungan,
      MuridNama: muridNama,
      MuridIC: muridIC,
      MuridTahun: muridTahun,
      MuridKelas: bersihTeks(data.muridKelas, 40),
      BilIsiRumah: bilIsiRumah,
      PendapatanIsiRumah: pendapatan,
      PendapatanPerKapita: Math.round((pendapatan / bilIsiRumah) * 100) / 100,
      EKasih: eKasih,
      NoEKasih: noEKasih,
      KaliDipulangkan: 0,
      CatatanPenyemak: '', CatatanPelulus: '', SebabTolak: '',
      PenyemakEmel: '', PelulusEmel: '',
      TarikhHantar: sekarang,
      TarikhSemakan: '', TarikhKeputusan: '', TamatTempohBetul: '',
      PadamSelepas: padamSelepas,
      Dianonimkan: false,
      DikemaskiniPada: sekarang
    });

    audit(noRujukan, 'HANTAR', '', STATUS.DIHANTAR, '',
          { saringan: _saringan(cariBaris(HELAIAN.PERMOHONAN, 'NoRujukan', noRujukan)) },
          { label: 'pemohon' });

    return { noRujukan: noRujukan, status: STATUS.DIHANTAR };
  });
}

/* ------------------------------------------------------------------ */

/**
 * Mengesahkan no. rujukan + No. KP murid, dengan had percubaan.
 * Had dikira per-rujukan kerana Apps Script tak nampak IP klien sebenar.
 */
function _sahkanPemohon(noRujukan, muridIC) {
  var ruj = bersihTeks(noRujukan, 20).toUpperCase();
  var ic  = _icBersih(muridIC);
  if (!ruj || !ic) {
    return { ralat: 'Masukkan no. rujukan dan no. Kad Pengenalan murid.' };
  }

  var bil = dgnKunci(function () {
    return kiraCubaan('semak:' + ruj, HAD_SEMAK_TEMPOH_MS);
  });
  if (bil > HAD_SEMAK_CUBAAN) {
    return { ralat: 'Terlalu banyak percubaan. Cuba lagi dalam 15 minit.' };
  }

  var p = cariBaris(HELAIAN.PERMOHONAN, 'NoRujukan', ruj);
  if (!p || String(p.MuridIC) !== ic) {
    return { ralat: 'Tiada permohonan sepadan. Semak no. rujukan dan no. Kad Pengenalan.' };
  }

  dgnKunci(function () { kosongkanCubaan('semak:' + ruj); });
  return { rekod: p };
}

function awamSemakStatus(data) {
  var hasil = _sahkanPemohon(data.noRujukan, data.muridIC);
  if (hasil.ralat) return { ralat: hasil.ralat };
  var p = hasil.rekod;

  var sekolah = cariBaris(HELAIAN.SEKOLAH, 'Kod', String(p.SekolahKod));
  var status = String(p.Status);

  return {
    noRujukan: String(p.NoRujukan),
    status: status,
    muridNama: String(p.MuridNama),
    sekolah: sekolah ? String(sekolah.Nama) : '',
    tarikhHantar: _iso(p.TarikhHantar),
    // Catatan penyemak didedahkan HANYA bila dipulangkan, supaya pemohon
    // tahu apa yang perlu dibetulkan. Catatan dalaman lain kekal tertutup.
    perluBetulkan: status === STATUS.DIPULANGKAN ? String(p.CatatanPenyemak || '') : null,
    tamatTempohBetul: status === STATUS.DIPULANGKAN ? _iso(p.TamatTempohBetul) : null,
    sebabTolak: status === STATUS.TOLAK ? String(p.SebabTolak || '') : null,
    tarikhKeputusan: _iso(p.TarikhKeputusan)
  };
}

function awamTarikBalik(data) {
  var hasil = _sahkanPemohon(data.noRujukan, data.muridIC);
  if (hasil.ralat) return { ralat: hasil.ralat };
  var p = hasil.rekod;

  var bolehTarik = [STATUS.DIHANTAR, STATUS.DIPULANGKAN, STATUS.DALAM_SEMAKAN];
  if (bolehTarik.indexOf(String(p.Status)) < 0) {
    return { ralat: 'Permohonan pada status ini tidak boleh ditarik balik.' };
  }

  return dgnKunci(function () {
    var segar = cariBaris(HELAIAN.PERMOHONAN, 'NoRujukan', String(p.NoRujukan));
    if (bolehTarik.indexOf(String(segar.Status)) < 0) {
      return { ralat: 'Status permohonan telah berubah. Semak semula.' };
    }
    kemasBaris(HELAIAN.PERMOHONAN, segar._baris, {
      Status: STATUS.DITARIK_BALIK, DikemaskiniPada: new Date()
    });
    audit(String(segar.NoRujukan), 'TARIK_BALIK', String(segar.Status),
          STATUS.DITARIK_BALIK, '', null, { label: 'pemohon' });
    return { status: STATUS.DITARIK_BALIK };
  });
}

function awamHantarSemula(data) {
  var hasil = _sahkanPemohon(data.noRujukan, data.muridIC);
  if (hasil.ralat) return { ralat: hasil.ralat };
  var p = hasil.rekod;

  if (String(p.Status) !== STATUS.DIPULANGKAN) {
    return { ralat: 'Hanya permohonan yang dipulangkan boleh dihantar semula.' };
  }
  var tamat = new Date(p.TamatTempohBetul).getTime();
  if (!isNaN(tamat) && tamat < new Date().getTime()) {
    return { ralat: 'Tempoh pembetulan sudah tamat.' };
  }

  var perubahan = data.perubahan || {};
  var tampalan = {};
  var lama = {};

  function bawaTeks(medan, kunci, panjang) {
    if (perubahan[kunci] === undefined || perubahan[kunci] === null) return;
    var v = bersihTeks(perubahan[kunci], panjang);
    if (v === '') return;
    lama[medan] = p[medan]; tampalan[medan] = v;
  }
  function bawaNombor(medan, kunci, min, maks) {
    if (perubahan[kunci] === undefined || perubahan[kunci] === null ||
        perubahan[kunci] === '') return;
    var v = Number(perubahan[kunci]);
    if (!isFinite(v) || v < min || v > maks) {
      throw Ralat('Nilai tidak sah untuk ' + kunci + '.');
    }
    lama[medan] = p[medan]; tampalan[medan] = v;
  }

  bawaTeks('MuridNama', 'muridNama', 150);
  bawaTeks('MuridKelas', 'muridKelas', 40);
  bawaTeks('PenjagaNama', 'penjagaNama', 150);
  bawaTeks('NoEKasih', 'noEKasih', 40);
  bawaNombor('MuridTahun', 'muridTahun', 1, 6);
  bawaNombor('BilIsiRumah', 'bilIsiRumah', 1, 30);
  bawaNombor('PendapatanIsiRumah', 'pendapatanIsiRumah', 0, 1000000);

  if (perubahan.penjagaTelefon) {
    var tel = bersihTeks(perubahan.penjagaTelefon, 20);
    if (!/^[-0-9+ ]{9,20}$/.test(tel)) throw Ralat('Nombor telefon tidak sah.');
    lama.PenjagaTelefon = p.PenjagaTelefon; tampalan.PenjagaTelefon = tel;
  }

  if (!Object.keys(tampalan).length) return { ralat: 'Tiada perubahan diisi.' };

  return dgnKunci(function () {
    var segar = cariBaris(HELAIAN.PERMOHONAN, 'NoRujukan', String(p.NoRujukan));
    if (String(segar.Status) !== STATUS.DIPULANGKAN) {
      return { ralat: 'Status permohonan telah berubah. Semak semula.' };
    }
    var bil = tampalan.BilIsiRumah !== undefined ? tampalan.BilIsiRumah : Number(segar.BilIsiRumah);
    var pend = tampalan.PendapatanIsiRumah !== undefined
      ? tampalan.PendapatanIsiRumah : Number(segar.PendapatanIsiRumah);
    tampalan.PendapatanPerKapita = Math.round((pend / bil) * 100) / 100;
    tampalan.Status = STATUS.DIHANTAR;
    tampalan.CatatanPenyemak = '';
    tampalan.TamatTempohBetul = '';
    tampalan.DikemaskiniPada = new Date();

    kemasBaris(HELAIAN.PERMOHONAN, segar._baris, tampalan);
    audit(String(segar.NoRujukan), 'HANTAR_SEMULA', STATUS.DIPULANGKAN,
          STATUS.DIHANTAR, '', { sebelum: lama, selepas: tampalan }, { label: 'pemohon' });
    return { status: STATUS.DIHANTAR };
  });
}

function _iso(nilai) {
  if (!nilai) return null;
  var d = new Date(nilai);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
