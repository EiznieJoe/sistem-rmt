/**
 * Data iDME sintetik yang meniru BENTUK eksport sebenar: baris tajuk
 * laporan di atas, kepala pada baris 6, dan campuran kes yang memang
 * wujud dalam data sebenar (prasekolah, kelas khas, bukan warganegara,
 * tanpa dokumen, pendapatan kosong, pendapatan sifar).
 *
 * Tiada data murid sebenar di sini. Fail iDME sebenar tidak pernah
 * di-commit ke repo ini.
 */
'use strict';

const KEPALA = [
  'BIL.', 'ID MURID', 'NAMA', 'NO. PENGENALAN', 'JENIS PENGENALAN',
  'STATUS PENGAJIAN', 'TAHUN / TINGKATAN', 'NAMA KELAS', 'NAMA GURU KELAS',
  'WARGANEGARA', 'STATUS ASRAMA', 'STATUS OKU',
  'PENJAGA 1', 'HUBUNGAN PENJAGA 1', 'NO. TEL. BIMBIT PENJAGA 1',
  'PENDAPATAN PENJAGA 1', 'PENDAPATAN PENJAGA 2', 'TANGGUNGAN'
];

/** Lajur sengaja disusun TERBALIK dalam satu ujian untuk membuktikan
 *  pemetaan ikut nama kepala, bukan kedudukan. */
function matriks(baris, opsyen) {
  opsyen = opsyen || {};
  let kepala = KEPALA.slice();
  let susun = kepala.map((_, i) => i);
  if (opsyen.terbalik) { kepala = kepala.slice().reverse(); susun = susun.slice().reverse(); }
  if (opsyen.buangLajur) {
    const j = kepala.indexOf(opsyen.buangLajur);
    if (j >= 0) { kepala.splice(j, 1); susun.splice(j, 1); }
  }
  const atas = [
    ['SENARAI KESELURUHAN MURID'], [' '], ['SEKOLAH KEBANGSAAN UJIAN'], ['XBA0000'], [' ']
  ];
  const data = baris.map((b) => susun.map((i) => b[i]));
  return atas.concat([kepala], data);
}

/* bil, id, nama, noKp, jenisKp, statusPengajian, tahun, kelas, guru,
   warganegara, asrama, oku, penjaga, hubungan, tel, pend1, pend2, tanggungan */
const MURID = [
  // --- Tahun 1 GIGIH: campuran layak / tidak layak
  [1, 100001, 'Ahmad Satu', 101010101001, 'KAD PENGENALAN', 'BERSEKOLAH', 'TAHUN SATU', 'GIGIH', 'Cikgu A', 'WARGANEGARA', '', '', 'Bapa Satu', 'BAPA KANDUNG', '0111111111', 800, '', 5],
  [2, 100002, 'Bibah Dua', 101010101002, 'KAD PENGENALAN', 'BERSEKOLAH', 'TAHUN SATU', 'GIGIH', 'Cikgu A', 'WARGANEGARA', '', '', 'Bapa Dua', 'BAPA KANDUNG', '0111111112', 900, 400, 6],
  [3, 100003, 'Chong Tiga', 101010101003, 'KAD PENGENALAN', 'BERSEKOLAH', 'TAHUN SATU', 'GIGIH', 'Cikgu A', 'WARGANEGARA', '', '', 'Ibu Tiga', 'IBU KANDUNG', '0111111113', 5000, 3000, 4],
  [4, 100004, 'Devi Empat', 101010101004, 'KAD PENGENALAN', 'BERSEKOLAH', 'TAHUN SATU', 'GIGIH', 'Cikgu A', 'WARGANEGARA', '', '', 'Bapa Empat', 'BAPA KANDUNG', '0111111114', '', '', 7],
  [5, 100005, 'Eman Lima', 101010101005, 'KAD PENGENALAN', 'BERSEKOLAH', 'TAHUN SATU', 'GIGIH', 'Cikgu A', 'WARGANEGARA', '', '', 'Ibu Lima', 'IBU KANDUNG', '0111111115', 0, '', 8],
  // --- Perenggan 4.2: asrama = tidak layak walaupun miskin
  [6, 100006, 'Farid Enam', 101010101006, 'KAD PENGENALAN', 'BERSEKOLAH', 'TAHUN SATU', 'GIGIH', 'Cikgu A', 'WARGANEGARA', 'YA', '', 'Bapa Enam', 'BAPA KANDUNG', '0111111116', 100, '', 9],
  // --- Perenggan 4.1(f): Kad OKU, lulus tanpa ujian pendapatan
  [7, 100007, 'Gina Tujuh', 101010101007, 'KAD PENGENALAN', 'BERSEKOLAH', 'TAHUN SATU', 'GIGIH', 'Cikgu A', 'WARGANEGARA', '', 'YA', 'Bapa Tujuh', 'BAPA KANDUNG', '0111111117', 9000, 5000, 3],
  // --- Perenggan 4.1(a): bukan warganegara
  [8, 100008, 'Hadi Lapan', 'A1234567', 'NOMBOR PASPORT', 'BERSEKOLAH', 'TAHUN SATU', 'GIGIH', 'Cikgu A', 'BUKAN WARGANEGARA', '', '', 'Bapa Lapan', 'BAPA KANDUNG', '0111111118', 200, '', 5],
  // --- Tanpa dokumen: PERLU_SEMAK, bukan ditolak senyap
  [9, 100009, 'Ira Sembilan', '', 'TANPA DOKUMEN', 'BERSEKOLAH', 'TAHUN SATU', 'GIGIH', 'Cikgu A', 'TIADA MAKLUMAT', '', '', '', '', '', 300, '', 6],

  // --- Tahun 2 GIGIH: NAMA KELAS yang SAMA, tahun berbeza.
  //     Kalau kelas dikunci pada NamaKelas sahaja, guru Tahun 1 akan
  //     nampak murid ini juga. Itu yang diuji.
  [10, 100010, 'Jaya Sepuluh', 101010101010, 'KAD PENGENALAN', 'BERSEKOLAH', 'TAHUN DUA', 'GIGIH', 'Cikgu B', 'WARGANEGARA', '', '', 'Bapa Sepuluh', 'BAPA KANDUNG', '0111111120', 700, '', 4],
  [11, 100011, 'Kamal Sebelas', 101010101011, 'KAD PENGENALAN', 'BERSEKOLAH', 'TAHUN DUA', 'GIGIH', 'Cikgu B', 'WARGANEGARA', '', '', 'Ibu Sebelas', 'IBU KANDUNG', '0111111121', 4000, '', 3],

  // --- Luar skop: prasekolah dan kelas khas
  [12, 100012, 'Lina Dua Belas', 101010101012, 'KAD PENGENALAN', 'BERSEKOLAH', 'PRASEKOLAH', 'DIAMOND', 'Cikgu C', 'WARGANEGARA', '', '', 'Bapa', 'BAPA KANDUNG', '0111111122', 100, '', 5],
  [13, 100013, 'Mazlan Tiga Belas', 101010101013, 'KAD PENGENALAN', 'BERSEKOLAH', 'KELAS KHAS RENDAH', 'AKTIF', 'Cikgu D', 'WARGANEGARA', '', 'YA', 'Bapa', 'BAPA KANDUNG', '0111111123', 100, '', 5],

  // --- Sudah berhenti sekolah: patut dilangkau
  [14, 100014, 'Nora Empat Belas', 101010101014, 'KAD PENGENALAN', 'TAMAT', 'TAHUN SATU', 'GIGIH', 'Cikgu A', 'WARGANEGARA', '', '', 'Bapa', 'BAPA KANDUNG', '0111111124', 100, '', 5]
];

module.exports = { KEPALA, MURID, matriks };
