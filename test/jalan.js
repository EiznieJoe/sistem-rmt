/**
 * Ujian logik backend. Jalankan: npm test
 * Memuatkan fail .gs yang SEBENAR ke dalam satu konteks bersama, sama
 * seperti Apps Script, kemudian memanggil doPost() seperti browser.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buatPersekitaran } = require('./stub-google');
const { MURID, matriks } = require('./data-sintetik');

const DIR = path.join(__dirname, '..', 'apps-script');
const { global: g } = buatPersekitaran();
const konteks = vm.createContext(g);
fs.readdirSync(DIR).filter((f) => f.endsWith('.gs')).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), konteks, { filename: f }));

let lulus = 0, gagal = 0; const kegagalan = [];
function semak(nama, syarat, butiran) {
  if (syarat) { lulus++; console.log('  lulus  ' + nama); }
  else { gagal++; kegagalan.push(nama); console.log('  GAGAL  ' + nama + (butiran ? '\n         -> ' + butiran : '')); }
}
const jalankan = (kod) => vm.runInContext(kod, konteks);
const fn = (nama) => vm.runInContext(nama, konteks);
function panggil(badan) {
  return JSON.parse(fn('doPost')({ postData: { contents: JSON.stringify(badan) } }).getContent());
}
function tampalImport(m) {
  const sh = jalankan('_ss()').insertSheet('ImportMentah');
  sh._mentah.sel = [];
  sh.getRange(1, 1, m.length, Math.max(...m.map((r) => r.length))).setValues(
    m.map((r) => { const b = r.slice(); while (b.length < Math.max(...m.map((x) => x.length))) b.push(''); return b; })
  );
}

console.log('\n== Pemasangan ==');
jalankan('pasang()');
jalankan('pasangSekolahContoh()');
semak('semua helaian dicipta',
  jalankan('Object.keys(LAJUR).every(function(n){return !!_ss().getSheetByName(n);})'));
semak('pasang() idempoten',
  (() => { const a = jalankan('bacaSemua(HELAIAN.TETAPAN).length'); jalankan('pasang()');
           return jalankan('bacaSemua(HELAIAN.TETAPAN).length') === a; })());

console.log('\n== Import iDME ==');
tampalImport(matriks(MURID));
let imp = jalankan('importDariHelaian()');
semak('14 baris dibaca, 1 dilangkau (STATUS PENGAJIAN bukan BERSEKOLAH)',
  imp.barisDibaca === 13 && imp.dilangkau === 1, JSON.stringify(imp));
semak('13 murid baharu dicipta', imp.baharu === 13);
semak('kepala dijumpai walaupun ada 5 baris tajuk laporan di atasnya',
  jalankan('bacaSemua(HELAIAN.MURID).length') === 13);

semak('KELAS DIKUNCI PADA TAHUN + NAMA KELAS, bukan NAMA KELAS sahaja',
  (() => { const k = jalankan('bacaSemua(HELAIAN.KELAS).map(function(x){return String(x.KelasId);})');
           return k.includes('TAHUN SATU | GIGIH') && k.includes('TAHUN DUA | GIGIH') && k.length === 4; })(),
  JSON.stringify(jalankan('bacaSemua(HELAIAN.KELAS).map(function(x){return String(x.KelasId);})')));
semak('nama guru dari iDME disimpan sebagai rujukan, GuruEmel kekal kosong',
  jalankan(`(function(){var k=bacaSemua(HELAIAN.KELAS).filter(function(x){return x.KelasId==='TAHUN SATU | GIGIH';})[0];
            return String(k.GuruNamaImport)==='Cikgu A' && String(k.GuruEmel)==='';})()`));
semak('lajur yang TIDAK diperlukan tidak diimport (PDPA minimization)',
  jalankan('LAJUR.Murid.join(",")').indexOf('Alamat') < 0 &&
  jalankan('LAJUR.Murid.join(",")').indexOf('Bank') < 0);

console.log('\n== Parser tahan susunan lajur ==');
semak('lajur disusun TERBALIK tetap diimport betul (padan ikut nama kepala)',
  (() => { tampalImport(matriks(MURID, { terbalik: true }));
           const r = jalankan('importDariHelaian()');
           const m = jalankan("cariBaris(HELAIAN.MURID,'IdMurid','100001')");
           return r.barisDibaca === 13 && String(m.Nama) === 'Ahmad Satu' &&
                  Number(m.PendapatanPenjaga1) === 800; })());
semak('kepala wajib hilang -> import BERHENTI dan namakan lajurnya',
  (() => { tampalImport(matriks(MURID, { buangLajur: 'NAMA KELAS' }));
           try { jalankan('importDariHelaian()'); return false; }
           catch (e) { return /NAMA KELAS/.test(e.message); } })());
tampalImport(matriks(MURID));
jalankan('importDariHelaian()');

console.log('\n== Staging dikosongkan selepas import ==');
semak('ImportMentah dikosongkan supaya import kedua bermula bersih',
  jalankan("(function(){var s=_ss().getSheetByName(HELAIAN.IMPORT_MENTAH); return s.getLastRow();})()") === 0,
  'baris tinggal: ' + jalankan("_ss().getSheetByName(HELAIAN.IMPORT_MENTAH).getLastRow()"));

semak('import KEDUA yang lebih kecil menanda murid yang hilang sebagai tidak aktif',
  (function () {
    // Tampal semula hanya 11 murid pertama (dua murid terakhir digugurkan).
    tampalImport(matriks(MURID.slice(0, 11)));
    var r = jalankan('importDariHelaian()');
    var m13 = jalankan("cariBaris(HELAIAN.MURID,'IdMurid','100013')");
    return r.tiadaLagi === 2 && m13.Aktif === false;
  })(),
  'Tanpa pengosongan staging, baris lama kekal dan tiadaLagi akan jadi 0.');

semak('murid yang kembali dalam import ditandakan aktif semula',
  (function () {
    tampalImport(matriks(MURID));
    jalankan('importDariHelaian()');
    return jalankan("cariBaris(HELAIAN.MURID,'IdMurid','100013').Aktif") === true;
  })());

console.log('\n== Enjin kelayakan (SPK Bil. 1/2026) ==');
jalankan("tetapPgk(1236,'ujian')");
const nilai = (id) => jalankan(`(function(){
  var m = cariBaris(HELAIAN.MURID,'IdMurid','${id}');
  var s = {}; bacaSemua(HELAIAN.SEKOLAH).forEach(function(x){s[String(x.Kod)]=x;});
  return nilaiKelayakan(m, s[String(m.SekolahKod)], konteksKelayakan());
})()`);
semak('PIR 800 < PGK 1236 -> LAYAK melalui 4.1(c)',
  nilai(100001).status === 'LAYAK' && nilai(100001).laluan === '4.1(c)');
semak('PIR dijumlah merentas kedua-dua penjaga (900+400=1300) -> TIDAK LAYAK',
  nilai(100002).status === 'TIDAK_LAYAK' && nilai(100002).pir === 1300, JSON.stringify(nilai(100002)));
semak('PIR 8000 -> TIDAK LAYAK', nilai(100003).status === 'TIDAK_LAYAK');
semak('tiada data pendapatan -> PERLU_SEMAK (bukan ditolak)',
  nilai(100004).status === 'PERLU_SEMAK');
semak('pendapatan 0 ialah data SAH, bukan kosong -> LAYAK',
  nilai(100005).status === 'LAYAK' && nilai(100005).pir === 0);
semak('perenggan 4.2: asrama mengatasi segalanya -> TIDAK LAYAK walaupun PIR 100',
  nilai(100006).status === 'TIDAK_LAYAK' && /4\.2/.test(nilai(100006).sebab), JSON.stringify(nilai(100006)));
semak('perenggan 4.1(f): Kad OKU -> LAYAK walaupun PIR 14000',
  nilai(100007).status === 'LAYAK' && nilai(100007).laluan === '4.1(f)');
semak('perenggan 4.1(a): bukan warganegara -> TIDAK LAYAK',
  nilai(100008).status === 'TIDAK_LAYAK' && /4\.1a/.test(nilai(100008).sebab));
semak('tanpa dokumen -> PERLU_SEMAK, bukan ditolak senyap',
  nilai(100009).status === 'PERLU_SEMAK');
semak('prasekolah -> LUAR_SKOP (perenggan 3.1)', nilai(100012).status === 'LUAR_SKOP');
semak('kelas khas -> LUAR_SKOP secara lalai', nilai(100013).status === 'LUAR_SKOP');
semak('tetapan kira_kelas_khas=ya membuka laluan 4.1(f) untuk kelas khas',
  (() => { jalankan(`(function(){var t=cariBaris(HELAIAN.TETAPAN,'Kunci','kira_kelas_khas');
                     kemasBaris(HELAIAN.TETAPAN,t._baris,{Nilai:'ya'});})()`);
           const r = nilai(100013).status === 'LAYAK' && nilai(100013).laluan === '4.1(f)';
           jalankan(`(function(){var t=cariBaris(HELAIAN.TETAPAN,'Kunci','kira_kelas_khas');
                     kemasBaris(HELAIAN.TETAPAN,t._baris,{Nilai:'tidak'});})()`);
           return r; })());
semak('BUKAN per kapita: PIR 1300 dengan 6 tanggungan kekal TIDAK LAYAK',
  nilai(100002).status === 'TIDAK_LAYAK',
  'per kapita akan jadi RM216.67 dan tersilap menandakannya layak');
semak('PGK belum ditetapkan -> PERLU_SEMAK, bukan menganggap layak',
  (() => { const t = jalankan("cariBaris(HELAIAN.TETAPAN,'Kunci','pgk_miskin_tegar')");
           jalankan(`kemasBaris(HELAIAN.TETAPAN,${t._baris},{Nilai:''})`);
           const r = nilai(100001).status === 'PERLU_SEMAK';
           jalankan("tetapPgk(1236,'ujian')");
           return r; })());

console.log('\n== Akaun dan skop kelas ==');
jalankan(`
  daftarPegawai('guru1@sk.my','Cikgu Satu','guru','KataLaluanKuat1','XBA0000');
  daftarPegawai('guru2@sk.my','Cikgu Dua','guru','KataLaluanKuat2','XBA0000');
  daftarPegawai('selaras@sk.my','Penyelaras','penyelaras','KataLaluanKuat3','XBA0000');
  tugaskanGuru('TAHUN SATU | GIGIH','guru1@sk.my');
  tugaskanGuru('TAHUN DUA | GIGIH','guru2@sk.my');
`);
semak('tugaskanGuru menolak emel yang belum didaftarkan',
  (() => { try { jalankan("tugaskanGuru('TAHUN SATU | GIGIH','hantu@sk.my')"); return false; }
           catch (e) { return /belum didaftarkan/.test(e.message); } })());
semak('kelasTanpaGuru menyenaraikan yang belum ditugaskan',
  jalankan('kelasTanpaGuru().length') === 2);

const T1 = panggil({ tindakan: 'logMasuk', emel: 'guru1@sk.my', katalaluan: 'KataLaluanKuat1' }).data.token;
const T2 = panggil({ tindakan: 'logMasuk', emel: 'guru2@sk.my', katalaluan: 'KataLaluanKuat2' }).data.token;
const TS = panggil({ tindakan: 'logMasuk', emel: 'selaras@sk.my', katalaluan: 'KataLaluanKuat3' }).data.token;

let r = panggil({ tindakan: 'kelasSaya', token: T1 });
semak('guru nampak SATU kelas sahaja', r.ok && r.data.kelas.length === 1 &&
  r.data.kelas[0].kelasId === 'TAHUN SATU | GIGIH', JSON.stringify(r.data && r.data.kelas));
r = panggil({ tindakan: 'senaraiMurid', token: T1, data: { kelasId: 'TAHUN SATU | GIGIH' } });
semak('guru Tahun 1 GIGIH nampak 9 murid, BUKAN 11 (Tahun 2 GIGIH terkecuali)',
  r.data.murid.length === 9, 'dapat ' + (r.data && r.data.murid.length));
semak('guru TIDAK boleh buka kelas guru lain',
  /bukan di bawah kebenaran anda/.test(
    panggil({ tindakan: 'senaraiMurid', token: T1, data: { kelasId: 'TAHUN DUA | GIGIH' } }).ralat));
semak('guru lain nampak kelasnya sendiri',
  panggil({ tindakan: 'senaraiMurid', token: T2, data: { kelasId: 'TAHUN DUA | GIGIH' } }).data.murid.length === 2);
semak('guru tiada kebenaran papan pemuka penyelaras',
  /tiada kebenaran/.test(panggil({ tindakan: 'ringkasan', token: T1 }).ralat));
semak('tiada token ditolak',
  /Sesi tamat atau tidak sah/.test(panggil({ tindakan: 'kelasSaya', token: '' }).ralat));

console.log('\n== Guru membetulkan data ==');
r = panggil({ tindakan: 'kemasMurid', token: T1,
  data: { idMurid: '100004', perubahan: { PendapatanPenjaga1: 650 }, catatan: 'Disahkan dengan penjaga' } });
semak('guru mengisi pendapatan yang kosong -> murid jadi LAYAK',
  r.ok && r.data.murid.kelayakan === 'LAYAK' && r.data.murid.pir === 650, JSON.stringify(r.ralat || r.data.murid.kelayakan));
semak('medan yang diubah direkod', r.data.murid.medanDiubah.includes('PendapatanPenjaga1'));
semak('medan di luar senarai dibenarkan ditolak',
  /tidak boleh diubah/.test(panggil({ tindakan: 'kemasMurid', token: T1,
    data: { idMurid: '100004', perubahan: { Nama: 'Nama Baharu' } } }).ralat));
semak('guru tidak boleh ubah murid kelas lain',
  /bukan di bawah kebenaran anda/.test(panggil({ tindakan: 'kemasMurid', token: T1,
    data: { idMurid: '100010', perubahan: { PendapatanPenjaga1: 1 } } }).ralat));
semak('nilai luar julat ditolak',
  /di luar julat|tidak sah/.test(panggil({ tindakan: 'kemasMurid', token: T1,
    data: { idMurid: '100004', perubahan: { PendapatanPenjaga1: -5 } } }).ralat));

console.log('\n== Import semula tidak memadam kerja guru ==');
tampalImport(matriks(MURID));
imp = jalankan('importDariHelaian()');
semak('pembetulan guru DIKEKALKAN selepas import semula',
  jalankan("Number(cariBaris(HELAIAN.MURID,'IdMurid','100004').PendapatanPenjaga1)") === 650);
semak('percanggahan dilaporkan, bukan ditimpa senyap', imp.konflik === 1, JSON.stringify(imp));
semak('medan bukan-guru tetap dikemas kini dari import',
  jalankan("String(cariBaris(HELAIAN.MURID,'IdMurid','100001').Nama)") === 'Ahmad Satu');

console.log('\n== Pengesahan guru ==');
semak('sahkan seorang murid',
  panggil({ tindakan: 'sahkanMurid', token: T1, data: { idMurid: '100001' } }).data.disahkan === true);
r = panggil({ tindakan: 'sahkanKelas', token: T1, data: { kelasId: 'TAHUN SATU | GIGIH' } });
semak('sahkan kelas melangkau murid PERLU_SEMAK',
  r.data.dilangkau === 1 && r.data.disahkan === 7, JSON.stringify(r.data));

console.log('\n== Papan pemuka penyelaras ==');
r = panggil({ tindakan: 'ringkasan', token: TS });
semak('penyelaras nampak semua kelas', r.ok && r.data.ikutKelas.length === 4);
/* LAYAK yang dijangka, dikira tangan dari data sintetik:
     100001 PIR 800              -> 4.1(c)
     100004 PIR 650 (guru isi)   -> 4.1(c)
     100005 PIR 0 (sah, bukan kosong) -> 4.1(c)
     100007 Kad OKU              -> 4.1(f)
     100010 PIR 700, Tahun 2     -> 4.1(c)
   TIDAK_LAYAK 5, PERLU_SEMAK 1 (tanpa dokumen), LUAR_SKOP 2. Jumlah 13. */
semak('jumlah layak dikira dari peraturan pekeliling',
  r.data.ringkasan.kira.LAYAK === 5 && r.data.ringkasan.kira.TIDAK_LAYAK === 5 &&
  r.data.ringkasan.kira.PERLU_SEMAK === 1 && r.data.ringkasan.kira.LUAR_SKOP === 2,
  JSON.stringify(r.data.ringkasan.kira));
semak('laluan kelayakan dipecahkan: empat melalui 4.1(c), satu melalui 4.1(f)',
  r.data.ringkasan.laluan['4.1(c)'] === 4 && r.data.ringkasan.laluan['4.1(f)'] === 1,
  JSON.stringify(r.data.ringkasan.laluan));
semak('formula dinyatakan bersama setiap jumlah',
  /Perenggan 4\.1\(c\)/.test(r.data.ringkasan.formula) &&
  /Bukan pendapatan per kapita/.test(r.data.ringkasan.formula));
semak('anggaran peruntukan = layak x kadar x hari',
  r.data.ringkasan.anggaranPeruntukan === 5 * 4.0 * 190, String(r.data.ringkasan.anggaranPeruntukan));
semak('kelas tanpa guru disenaraikan untuk pentadbir', r.data.kelasTanpaGuru.length === 2);
semak('import terakhir dipaparkan', !!r.data.importAkhir && r.data.importAkhir.barisDibaca === 13);

console.log('\n== Tetapan boleh ubah oleh penyelaras ==');
semak('tukar PGK mengubah jumlah layak serta-merta',
  (() => { panggil({ tindakan: 'ubahTetapan', token: TS, data: { kunci: 'pgk_miskin_tegar', nilai: '400' } });
           const a = panggil({ tindakan: 'ringkasan', token: TS }).data.ringkasan.kira.LAYAK;
           panggil({ tindakan: 'ubahTetapan', token: TS, data: { kunci: 'pgk_miskin_tegar', nilai: '1236' } });
           const b = panggil({ tindakan: 'ringkasan', token: TS }).data.ringkasan.kira.LAYAK;
           /* Pada PGK 400 hanya 100005 (PIR 0) dan 100007 (Kad OKU, tanpa
              ujian pendapatan) kekal layak. 100001/100004/100010 jatuh. */
           return a === 2 && b === 5; })());
semak('perubahan PGK meninggalkan jejak audit',
  jalankan("bacaSemua(HELAIAN.AUDIT).filter(function(a){return String(a.Tindakan)==='UBAH_TETAPAN';}).length") >= 2);
semak('tetapan di luar senarai ditolak',
  /tidak boleh diubah/.test(panggil({ tindakan: 'ubahTetapan', token: TS,
    data: { kunci: 'sekolah_kod', nilai: 'XXX' } }).ralat));
semak('nilai PGK bukan nombor ditolak',
  /nombor/.test(panggil({ tindakan: 'ubahTetapan', token: TS,
    data: { kunci: 'pgk_miskin_tegar', nilai: 'banyak' } }).ralat));
semak('guru tidak boleh ubah tetapan',
  /tiada kebenaran/.test(panggil({ tindakan: 'ubahTetapan', token: T1,
    data: { kunci: 'pgk_miskin_tegar', nilai: '9999' } }).ralat));

console.log('\n== Sesi dan keselamatan ==');
semak('emel tiada dan kata laluan salah beri mesej yang SAMA',
  panggil({ tindakan: 'logMasuk', emel: 'hantu@x.my', katalaluan: 'a' }).ralat ===
  panggil({ tindakan: 'logMasuk', emel: 'guru1@sk.my', katalaluan: 'salah' }).ralat);
semak('kata laluan tidak disimpan sebagai teks biasa',
  !JSON.stringify(jalankan('bacaSemua(HELAIAN.STAF)')).includes('KataLaluanKuat1'));
semak('log keluar membatalkan token di SERVER',
  (() => { const t = panggil({ tindakan: 'logMasuk', emel: 'guru2@sk.my', katalaluan: 'KataLaluanKuat2' }).data.token;
           panggil({ tindakan: 'logKeluar', token: t });
           return panggil({ tindakan: 'kelasSaya', token: t }).ok === false; })());
semak('pegawai dinyahaktifkan hilang akses serta-merta',
  (() => { jalankan("nyahaktifPegawai('guru2@sk.my')");
           const ok = panggil({ tindakan: 'kelasSaya', token: T2 }).ok === false;
           jalankan("daftarPegawai('guru2@sk.my','Cikgu Dua','guru','KataLaluanKuat2','XBA0000')");
           return ok; })());
semak('formula injection dineutralkan sebelum ditulis',
  (() => { panggil({ tindakan: 'kemasMurid', token: T1,
             data: { idMurid: '100001', perubahan: { PenjagaNama: '=HYPERLINK("http://jahat","x")' } } });
           return jalankan("String(cariBaris(HELAIAN.MURID,'IdMurid','100001').PenjagaNama)").charAt(0) === "'"; })());
semak('tindakan tidak dikenali ditolak',
  panggil({ tindakan: 'padamSemua', token: TS }).ralat === 'Tindakan tidak dikenali.');
semak('JSON rosak tidak menjatuhkan sistem',
  JSON.parse(fn('doPost')({ postData: { contents: '{rosak' } }).getContent()).ralat === 'Permintaan tidak sah.');
semak('ralat tak dijangka tidak membocorkan dalaman',
  (() => { const j = panggil({ tindakan: 'senaraiMurid', token: T1, data: {} });
           return j.ok === false && !/undefined|TypeError|_baris|getRange/.test(j.ralat); })());

console.log('\n== Jejak audit ==');
r = panggil({ tindakan: 'audit', token: TS, data: { idMurid: '100004' } });
semak('pembetulan guru direkod dengan nilai sebelum dan selepas',
  r.data.audit.some((a) => a.tindakan === 'GURU_KEMASKINI' && /650/.test(a.perubahan)),
  JSON.stringify(r.data.audit.map((a) => a.tindakan)));

console.log('\n' + '='.repeat(58));
console.log('  ' + lulus + ' lulus, ' + gagal + ' gagal');
if (gagal) console.log('  Gagal: ' + kegagalan.join(', '));
console.log('='.repeat(58) + '\n');
process.exit(gagal ? 1 : 0);
