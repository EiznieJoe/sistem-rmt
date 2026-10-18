/**
 * Ujian logik backend. Jalankan: node test/jalan.js
 *
 * Memuatkan fail .gs yang SEBENAR ke dalam satu konteks bersama, sama
 * seperti Apps Script, kemudian memanggil doPost() seperti browser.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buatPersekitaran } = require('./stub-google');

const DIR = path.join(__dirname, '..', 'apps-script');
const { global: g, log } = buatPersekitaran();
const konteks = vm.createContext(g);

fs.readdirSync(DIR).filter((f) => f.endsWith('.gs')).sort().forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), konteks, { filename: f });
});

/* ---------- pembantu ujian ---------- */
let lulus = 0, gagal = 0;
const kegagalan = [];

function semak(nama, syarat, butiran) {
  if (syarat) { lulus++; console.log('  lulus  ' + nama); }
  else {
    gagal++; kegagalan.push(nama);
    console.log('  GAGAL  ' + nama + (butiran ? '\n         -> ' + butiran : ''));
  }
}

function panggil(badan) {
  const res = vm.runInContext('doPost', konteks)({
    postData: { contents: JSON.stringify(badan) }
  });
  return JSON.parse(res.getContent());
}

const SS = (nama) => vm.runInContext(`_helaian(${JSON.stringify(nama)})`, konteks);
const jalankan = (kod) => vm.runInContext(kod, konteks);

/* ---------- pemasangan ---------- */
console.log('\n== Pemasangan ==');
jalankan('pasang()');
jalankan('pasangDataCubaan()');
semak('pasang() mencipta semua helaian',
  jalankan('Object.keys(LAJUR).every(function(n){ return !!_ss().getSheetByName(n); })'));
semak('pasang() idempoten', (() => { jalankan('pasang()'); return jalankan('bacaSemua(HELAIAN.TETAPAN).length') === 6; })(),
  'bil tetapan = ' + jalankan('bacaSemua(HELAIAN.TETAPAN).length'));

// Pegawai
jalankan(`
  tambahBaris(HELAIAN.STAF, {Emel:'semak@sk.edu.my', Nama:'Cikgu Semak', Peranan:'penyemak', SekolahKod:'ABA0001', Aktif:true, DiciptaPada:new Date()});
  tambahBaris(HELAIAN.STAF, {Emel:'lulus@sk.edu.my', Nama:'Cikgu Lulus', Peranan:'pelulus',  SekolahKod:'ABA0001', Aktif:true, DiciptaPada:new Date()});
  tambahBaris(HELAIAN.STAF, {Emel:'admin@sk.edu.my', Nama:'Admin',       Peranan:'admin',    SekolahKod:'ABA0001', Aktif:true, DiciptaPada:new Date()});
  tambahBaris(HELAIAN.STAF, {Emel:'lain@sk2.edu.my', Nama:'Cikgu Lain',  Peranan:'penyemak', SekolahKod:'ABA0002', Aktif:true, DiciptaPada:new Date()});
  tetapKataLaluan('semak@sk.edu.my','KataLaluanKuat1');
  tetapKataLaluan('lulus@sk.edu.my','KataLaluanKuat2');
  tetapKataLaluan('admin@sk.edu.my','KataLaluanKuat3');
  tetapKataLaluan('lain@sk2.edu.my','KataLaluanKuat4');
`);

/* ---------- kata laluan ---------- */
console.log('\n== Kata laluan ==');
semak('kata laluan tidak disimpan sebagai teks biasa',
  !JSON.stringify(jalankan('bacaSemua(HELAIAN.STAF)')).includes('KataLaluanKuat1'));
semak('setiap pegawai ada salt berbeza',
  (() => { const s = jalankan('bacaSemua(HELAIAN.STAF).map(function(x){return String(x.Salt);})');
           return new Set(s).size === s.length && s.every((x) => x.length >= 32); })());
semak('kata laluan sama -> hash berbeza (salt berfungsi)',
  (() => { jalankan("tetapKataLaluan('lain@sk2.edu.my','KataLaluanKuat1')");
           const h = jalankan(`[cariBaris(HELAIAN.STAF,'Emel','semak@sk.edu.my').KataLaluanHash,
                               cariBaris(HELAIAN.STAF,'Emel','lain@sk2.edu.my').KataLaluanHash]`);
           return h[0] !== h[1]; })());
semak('kata laluan di bawah 10 aksara ditolak',
  (() => { try { jalankan("tetapKataLaluan('semak@sk.edu.my','pendek')"); return false; }
           catch (e) { return /10 aksara/.test(e.message); } })());

/* ---------- log masuk ---------- */
console.log('\n== Log masuk ==');
let r = panggil({ tindakan: 'logMasuk', emel: 'semak@sk.edu.my', katalaluan: 'salah' });
semak('kata laluan salah ditolak', r.ok === false);
semak('mesej tidak membocorkan emel mana yang wujud',
  r.ralat === 'Emel atau kata laluan salah.', r.ralat);
semak('emel tiada beri mesej yang SAMA',
  panggil({ tindakan: 'logMasuk', emel: 'hantu@x.my', katalaluan: 'apa' }).ralat === r.ralat);

r = panggil({ tindakan: 'logMasuk', emel: 'semak@sk.edu.my', katalaluan: 'KataLaluanKuat1' });
semak('kata laluan betul diterima', r.ok === true && !!r.data.token);
const T_SEMAK = r.ok ? r.data.token : null;
semak('token panjang dan rawak', T_SEMAK && T_SEMAK.length >= 32);
semak('respons log masuk tidak mengandungi hash atau salt',
  !JSON.stringify(r).includes('Salt') && !/[0-9a-f]{64}/.test(JSON.stringify(r)));

const T_LULUS = panggil({ tindakan: 'logMasuk', emel: 'lulus@sk.edu.my', katalaluan: 'KataLaluanKuat2' }).data.token;
const T_ADMIN = panggil({ tindakan: 'logMasuk', emel: 'admin@sk.edu.my', katalaluan: 'KataLaluanKuat3' }).data.token;
const T_LAIN  = panggil({ tindakan: 'logMasuk', emel: 'lain@sk2.edu.my', katalaluan: 'KataLaluanKuat1' }).data.token;

console.log('\n== Had percubaan log masuk ==');
const cubaan = [];
for (let i = 0; i < 10; i++) {
  cubaan.push(panggil({ tindakan: 'logMasuk', emel: 'semak@sk.edu.my', katalaluan: 'x' }).ralat);
}
semak('dikunci selepas 8 percubaan gagal',
  /Terlalu banyak/.test(cubaan[8]) && /Terlalu banyak/.test(cubaan[9]), cubaan[8]);
semak('selepas dikunci, kata laluan BETUL pun ditolak',
  /Terlalu banyak/.test(panggil({ tindakan: 'logMasuk', emel: 'semak@sk.edu.my', katalaluan: 'KataLaluanKuat1' }).ralat));
jalankan("CacheService.getScriptCache().remove('login:semak@sk.edu.my')");

/* ---------- hantar permohonan ---------- */
console.log('\n== Borang awam ==');
const asas = {
  sekolahKod: 'ABA0001', muridNama: 'Nurul Aina binti Ahmad', muridIC: '150101011234',
  muridTahun: 3, muridKelas: '3 Bestari', penjagaNama: 'Ahmad bin Abdullah',
  penjagaTelefon: '011-2345678', penjagaHubungan: 'Bapa', bilIsiRumah: 6,
  pendapatanIsiRumah: 1800, eKasih: false, akuanBenar: true, persetujuanPdpa: true
};
r = panggil({ tindakan: 'hantar', data: asas });
semak('permohonan sah diterima', r.ok === true && /^RMT-\d\d-[A-Z2-9]{8}$/.test(r.data.noRujukan), JSON.stringify(r));
const RUJ = r.ok ? r.data.noRujukan : null;

semak('IC bukan 12 angka ditolak',
  panggil({ tindakan: 'hantar', data: { ...asas, muridIC: '123' } }).ralat === 'No. Kad Pengenalan murid mesti 12 angka.');
semak('akuan tak ditanda ditolak',
  /Akuan dan persetujuan/.test(panggil({ tindakan: 'hantar', data: { ...asas, muridIC: '150101019999', akuanBenar: false } }).ralat));
semak('tahun di luar 1-6 ditolak',
  /Tahun murid/.test(panggil({ tindakan: 'hantar', data: { ...asas, muridIC: '150101018888', muridTahun: 9 } }).ralat));
semak('sekolah tidak sah ditolak',
  /Sekolah tidak sah/.test(panggil({ tindakan: 'hantar', data: { ...asas, muridIC: '150101017777', sekolahKod: 'HANTU' } }).ralat));
semak('permohonan pendua untuk murid sama ditolak',
  /sudah ada permohonan aktif/.test(panggil({ tindakan: 'hantar', data: { ...asas, penjagaNama: 'Orang Lain' } }).ralat));

console.log('\n== Formula injection ==');
r = panggil({ tindakan: 'hantar', data: { ...asas, muridIC: '150101016666',
  muridNama: '=HYPERLINK("http://jahat","klik")', penjagaTelefon: '0191234567' } });
semak('nama yang bermula "=" dineutralkan dengan apostrof',
  jalankan(`String(cariBaris(HELAIAN.PERMOHONAN,'MuridIC','150101016666').MuridNama).charAt(0)`) === "'",
  jalankan(`String(cariBaris(HELAIAN.PERMOHONAN,'MuridIC','150101016666').MuridNama)`));

console.log('\n== Semak status + had percubaan ==');
r = panggil({ tindakan: 'semakStatus', data: { noRujukan: RUJ, muridIC: '150101011234' } });
semak('semak status dengan IC betul berjaya', r.ok && r.data.status === 'DIHANTAR');
semak('semak status tidak mendedahkan telefon atau pendapatan',
  !JSON.stringify(r).includes('011-2345678') && !JSON.stringify(r).includes('1800'));

const cubaSemak = [];
for (let i = 0; i < 7; i++) {
  cubaSemak.push(panggil({ tindakan: 'semakStatus', data: { noRujukan: RUJ, muridIC: '999999999999' } }).data.ralat);
}
semak('5 kali IC salah dibenarkan, kali ke-6 dikunci',
  /Tiada permohonan sepadan/.test(cubaSemak[4]) && /Terlalu banyak/.test(cubaSemak[5]),
  JSON.stringify(cubaSemak.slice(4, 6)));
semak('selepas dikunci, IC BETUL pun ditolak',
  /Terlalu banyak/.test(panggil({ tindakan: 'semakStatus', data: { noRujukan: RUJ, muridIC: '150101011234' } }).data.ralat));
semak('tarikBalik tidak boleh dipakai untuk memintas had',
  /Terlalu banyak/.test(panggil({ tindakan: 'tarikBalik', data: { noRujukan: RUJ, muridIC: '150101011234' } }).data.ralat));
jalankan(`kosongkanCubaan('semak:' + ${JSON.stringify(RUJ)})`);

/* ---------- kebenaran ---------- */
console.log('\n== Kebenaran pegawai ==');
semak('tiada token ditolak',
  /Sesi tamat atau tidak sah/.test(panggil({ tindakan: 'senarai', token: '', data: {} }).ralat));
semak('token palsu ditolak',
  /Sesi tamat atau tidak sah/.test(panggil({ tindakan: 'senarai', token: 'x'.repeat(72), data: {} }).ralat));
semak('pelulus tidak boleh guna fungsi penyemak',
  /tiada kebenaran/.test(panggil({ tindakan: 'tolakTerus', token: T_LULUS, data: { noRujukan: RUJ, sebab: 'cuba pintas' } }).ralat));

r = panggil({ tindakan: 'senarai', token: T_LAIN, data: {} });
semak('penyemak sekolah lain nampak 0 permohonan kita',
  r.ok && r.data.permohonan.every((p) => p.noRujukan !== RUJ), JSON.stringify(r.data && r.data.permohonan.length));
semak('penyemak sekolah lain tidak boleh bertindak ke atas kes kita',
  /bukan di bawah sekolah anda/.test(panggil({ tindakan: 'mulaSemakan', token: T_LAIN, data: { noRujukan: RUJ } }).ralat));

console.log('\n== Aliran status ==');
semak('mula semakan', panggil({ tindakan: 'mulaSemakan', token: T_SEMAK, data: { noRujukan: RUJ } }).data.status === 'DALAM_SEMAKAN');
semak('mula semakan kali kedua ditolak',
  /tidak sah untuk status/.test(panggil({ tindakan: 'mulaSemakan', token: T_SEMAK, data: { noRujukan: RUJ } }).ralat));
semak('pulangkan tanpa catatan ditolak',
  /Catatan wajib/.test(panggil({ tindakan: 'pulangkan', token: T_SEMAK, data: { noRujukan: RUJ, catatan: '  ' } }).ralat));
semak('pulangkan dengan catatan', panggil({ tindakan: 'pulangkan', token: T_SEMAK, data: { noRujukan: RUJ, catatan: 'Sila isi no. eKasih' } }).data.status === 'DIPULANGKAN');

r = panggil({ tindakan: 'semakStatus', data: { noRujukan: RUJ, muridIC: '150101011234' } });
semak('pemohon nampak catatan bila dipulangkan', r.data.perluBetulkan === 'Sila isi no. eKasih');
semak('hantar semula sebahagian — medan lain kekal',
  (() => { const a = panggil({ tindakan: 'hantarSemula', data: { noRujukan: RUJ, muridIC: '150101011234', perubahan: { bilIsiRumah: 7, noEKasih: 'EK123' } } });
           const p = jalankan(`cariBaris(HELAIAN.PERMOHONAN,'NoRujukan',${JSON.stringify(RUJ)})`);
           return a.data.status === 'DIHANTAR' && Number(p.BilIsiRumah) === 7 &&
                  String(p.NoEKasih) === 'EK123' && String(p.MuridNama).indexOf('Nurul Aina') >= 0 &&
                  Number(p.PendapatanPerKapita) === Math.round((1800 / 7) * 100) / 100; })());

console.log('\n== Had pulangan ==');
for (let i = 2; i <= 3; i++) {
  panggil({ tindakan: 'pulangkan', token: T_SEMAK, data: { noRujukan: RUJ, catatan: 'pusingan ' + i } });
  panggil({ tindakan: 'hantarSemula', data: { noRujukan: RUJ, muridIC: '150101011234', perubahan: { muridKelas: '3 Kelas' + i } } });
}
semak('pulangan ke-4 ditolak',
  /Had 3 kali/.test(panggil({ tindakan: 'pulangkan', token: T_SEMAK, data: { noRujukan: RUJ, catatan: 'pusingan 4' } }).ralat));

console.log('\n== Pengasingan tugas ==');
panggil({ tindakan: 'keKelulusan', token: T_SEMAK, data: { noRujukan: RUJ, catatan: 'Lengkap' } });
semak('penyemak tidak boleh luluskan (peranan)',
  /tiada kebenaran/.test(panggil({ tindakan: 'putuskan', token: T_SEMAK, data: { noRujukan: RUJ, lulus: true } }).ralat));
semak('tolak tanpa sebab ditolak',
  /Sebab tolak wajib/.test(panggil({ tindakan: 'putuskan', token: T_LULUS, data: { noRujukan: RUJ, lulus: false, sebab: '' } }).ralat));
semak('pelulus berbeza boleh luluskan',
  panggil({ tindakan: 'putuskan', token: T_LULUS, data: { noRujukan: RUJ, lulus: true } }).data.status === 'LULUS');

// Admin menyemak sendiri lalu cuba meluluskan.
const r2 = panggil({ tindakan: 'hantar', data: { ...asas, muridIC: '160202022345', muridNama: 'Budi', penjagaTelefon: '0129876543' } }).data.noRujukan;
panggil({ tindakan: 'mulaSemakan', token: T_ADMIN, data: { noRujukan: r2 } });
panggil({ tindakan: 'keKelulusan', token: T_ADMIN, data: { noRujukan: r2, catatan: 'admin semak' } });
semak('ADMIN yang menyemak sendiri tidak boleh meluluskan',
  /terlibat dalam semakan/.test(panggil({ tindakan: 'putuskan', token: T_ADMIN, data: { noRujukan: r2, lulus: true } }).ralat),
  JSON.stringify(panggil({ tindakan: 'putuskan', token: T_ADMIN, data: { noRujukan: r2, lulus: true } })));
semak('pelulus yang tidak terlibat boleh meluluskan',
  panggil({ tindakan: 'putuskan', token: T_LULUS, data: { noRujukan: r2, lulus: true } }).data.status === 'LULUS');

console.log('\n== Saringan ==');
const r3 = panggil({ tindakan: 'hantar', data: { ...asas, muridIC: '170303033456', muridNama: 'Chong', penjagaTelefon: '0171234567', bilIsiRumah: 3, pendapatanIsiRumah: 9000 } }).data.noRujukan;
semak('tiada kriteria -> tiada bendera pendapatan',
  panggil({ tindakan: 'butiran', token: T_SEMAK, data: { noRujukan: r3 } }).data.saringan.length === 0);
jalankan("tetapKriteria(600,'ujian')");
r = panggil({ tindakan: 'butiran', token: T_SEMAK, data: { noRujukan: r3 } });
semak('kriteria diisi -> pendapatan tinggi ditanda',
  r.data.saringan.length === 1 && /melebihi had/.test(r.data.saringan[0]), JSON.stringify(r.data.saringan));
semak('saringan hanya menasihat — status masih DIHANTAR',
  jalankan(`String(cariBaris(HELAIAN.PERMOHONAN,'NoRujukan',${JSON.stringify(r3)}).Status)`) === 'DIHANTAR');

console.log('\n== Jejak audit ==');
r = panggil({ tindakan: 'butiran', token: T_SEMAK, data: { noRujukan: RUJ } });
const tindakanAudit = r.data.audit.map((a) => a.tindakan);
semak('setiap peralihan direkod',
  ['HANTAR', 'MULA_SEMAKAN', 'PULANGKAN', 'HANTAR_SEMULA', 'KE_KELULUSAN', 'KEPUTUSAN']
    .every((t) => tindakanAudit.includes(t)), JSON.stringify(tindakanAudit));
semak('audit merekod siapa, bukan hanya apa',
  r.data.audit.some((a) => a.pelaku === 'Cikgu Semak') && r.data.audit.some((a) => a.pelaku === 'pemohon'));

console.log('\n== Log keluar ==');
const tBuang = panggil({ tindakan: 'logMasuk', emel: 'lulus@sk.edu.my', katalaluan: 'KataLaluanKuat2' }).data.token;
semak('token sah sebelum log keluar', panggil({ tindakan: 'senarai', token: tBuang, data: {} }).ok === true);
panggil({ tindakan: 'logKeluar', token: tBuang });
semak('token dibatalkan di SERVER selepas log keluar',
  panggil({ tindakan: 'senarai', token: tBuang, data: {} }).ok === false);

console.log('\n== Nyahaktif pegawai ==');
jalankan(`kemasBaris(HELAIAN.STAF, cariBaris(HELAIAN.STAF,'Emel','semak@sk.edu.my')._baris, {Aktif:false})`);
semak('pegawai dinyahaktifkan hilang akses SERTA-MERTA, bukan bila token tamat',
  panggil({ tindakan: 'senarai', token: T_SEMAK, data: {} }).ok === false);
jalankan(`kemasBaris(HELAIAN.STAF, cariBaris(HELAIAN.STAF,'Emel','semak@sk.edu.my')._baris, {Aktif:true})`);

console.log('\n== Sesi tamat tempoh ==');
jalankan(`kemasBaris(HELAIAN.SESI_LOGIN, cariBaris(HELAIAN.SESI_LOGIN,'Token',${JSON.stringify(T_SEMAK)})._baris, {TamatPada: new Date(Date.now()-1000)})`);
semak('token yang tamat tempoh ditolak',
  panggil({ tindakan: 'senarai', token: T_SEMAK, data: {} }).ok === false);

console.log('\n== Sweep harian ==');
jalankan(`
  var p = cariBaris(HELAIAN.PERMOHONAN,'NoRujukan',${JSON.stringify(r3)});
  var lepas = new Date(); lepas.setDate(lepas.getDate()-1);
  kemasBaris(HELAIAN.PERMOHONAN, p._baris, {Status:'DIPULANGKAN', TamatTempohBetul: lepas});
  var q = cariBaris(HELAIAN.PERMOHONAN,'NoRujukan',${JSON.stringify(r2)});
  kemasBaris(HELAIAN.PERMOHONAN, q._baris, {PadamSelepas: lepas});
`);
const hasilSweep = jalankan('sweepHarian()');
semak('permohonan tamat tempoh digugurkan', hasilSweep.gugur === 1, JSON.stringify(hasilSweep));
semak('rekod melepasi tempoh simpanan dianonimkan', hasilSweep.dianonimkan === 1);
semak('data peribadi benar-benar dibuang selepas anonim',
  (() => { const q = jalankan(`cariBaris(HELAIAN.PERMOHONAN,'NoRujukan',${JSON.stringify(r2)})`);
           return String(q.MuridNama) === '[dibuang]' && String(q.PenjagaTelefon) === '[dibuang]' &&
                  String(q.MuridIC).indexOf('ANON-') === 0 && q.Dianonimkan === true; })());
semak('status keputusan dikekalkan untuk statistik',
  jalankan(`String(cariBaris(HELAIAN.PERMOHONAN,'NoRujukan',${JSON.stringify(r2)}).Status)`) === 'LULUS');

console.log('\n== Tindakan tidak dikenali ==');
semak('tindakan tidak dikenali ditolak',
  panggil({ tindakan: 'padamSemua', token: T_ADMIN }).ralat === 'Tindakan tidak dikenali.');
semak('JSON rosak tidak menjatuhkan sistem',
  (() => { const res = jalankan('doPost')({ postData: { contents: '{rosak' } });
           return JSON.parse(res.getContent()).ralat === 'Permintaan tidak sah.'; })());
semak('ralat tak dijangka tidak membocorkan dalaman',
  (() => { const res = jalankan('doPost')({ postData: { contents: JSON.stringify({ tindakan: 'butiran', token: T_LULUS, data: {} }) } });
           const j = JSON.parse(res.getContent());
           return j.ok === false && !/undefined|TypeError|_baris|getRange/.test(j.ralat); })(),
  'ralat = ' + JSON.parse(jalankan('doPost')({ postData: { contents: JSON.stringify({ tindakan: 'butiran', token: T_LULUS, data: {} }) } }).getContent()).ralat);

/* ---------- keputusan ---------- */
console.log('\n' + '='.repeat(58));
console.log('  ' + lulus + ' lulus, ' + gagal + ' gagal');
if (gagal) { console.log('  Gagal: ' + kegagalan.join(', ')); }
console.log('='.repeat(58) + '\n');
process.exit(gagal ? 1 : 0);
