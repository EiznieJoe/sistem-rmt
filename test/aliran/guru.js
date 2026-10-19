/* Aliran guru hujung-ke-hujung, meniru apa yang guru betul-betul buat.
   Bukan ujian unit — ini mencari perkara yang pelik, bukan mengesahkan
   apa yang saya sudah tahu betul. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const AKAR = path.join(__dirname, '..', '..');
const { buatPersekitaran } = require(path.join(AKAR, 'test', 'stub-google'));
const { MURID, matriks } = require(path.join(AKAR, 'test', 'data-sintetik'));

const { global: g } = buatPersekitaran();
const kon = vm.createContext(g);
const DIR = path.join(AKAR, 'apps-script');
fs.readdirSync(DIR).filter(f => f.endsWith('.gs')).sort()
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), kon, { filename: f }));
const jalankan = k => vm.runInContext(k, kon);
const fn = n => vm.runInContext(n, kon);
const panggil = b => JSON.parse(fn('doPost')({ postData:{ contents: JSON.stringify(b) } }).getContent());

let isu = 0;
const cek = (nama, ok, butiran) => {
  if (ok) console.log('   ok   ' + nama);
  else { isu++; console.log('  ISU   ' + nama + (butiran ? '\n        -> ' + butiran : '')); }
};

// ---- Sediakan sekolah seperti pentadbir sebenar
jalankan('pasang()');
jalankan("tambahBaris(HELAIAN.SEKOLAH,{Kod:'XBA0000',Nama:'SK Ujian',Jenis:'SK',Negeri:'SABAH',Aktif:true})");
const sh = jalankan('_ss()').insertSheet('ImportMentah');
const m = matriks(MURID);
sh.getRange(1, 1, m.length, m[0].length).setValues(m);
jalankan('importDariHelaian()');
jalankan("daftarPegawai('cikgu@sk.my','Cikgu Aminah','guru','KataLaluanKuat1','XBA0000')");
jalankan("daftarPegawai('lain@sk.my','Cikgu Lain','guru','KataLaluanKuat2','XBA0000')");
jalankan("tugaskanGuru('TAHUN SATU | GIGIH','cikgu@sk.my')");
jalankan("tugaskanGuru('TAHUN DUA | GIGIH','lain@sk.my')");

console.log('\n=== 1. Guru log masuk ===');
let r = panggil({ tindakan:'logMasuk', emel:'cikgu@sk.my', katalaluan:'KataLaluanKuat1' });
cek('log masuk berjaya', !!(r.data && r.data.token), JSON.stringify(r.ralat));
const TOKEN = r.data.token;
cek('peranan dipulangkan sebagai guru', r.data.peranan === 'guru', r.data.peranan);
cek('nama dipaparkan, bukan emel', r.data.nama === 'Cikgu Aminah', r.data.nama);

console.log('\n=== 2. Guru buka kelasnya ===');
r = panggil({ tindakan:'kelasSaya', token:TOKEN });
const kelas = r.data.kelas;
cek('nampak tepat satu kelas', kelas.length === 1, JSON.stringify(kelas.map(k=>k.kelasId)));
cek('kelasnya sendiri', kelas[0].kelasId === 'TAHUN SATU | GIGIH', kelas[0].kelasId);
const ring = kelas[0].ringkasan;
cek('ringkasan ada kiraan dokumen',
  ['dokLengkap','dokTidakLengkap','dokBelum'].every(k => typeof ring[k] === 'number'),
  JSON.stringify(ring));
cek('kiraan dokumen berjumlah sama dengan bilangan murid',
  ring.dokLengkap + ring.dokTidakLengkap + ring.dokBelum === ring.jumlah,
  JSON.stringify(ring));
cek('ringkasan TIDAK lagi ada medan pengesahan',
  ring.belumDisahkan === undefined, JSON.stringify(Object.keys(ring)));
console.log('        kelas:', kelas[0].kelasId, '| murid:', ring.jumlah,
            '| layak:', ring.LAYAK, '| perlu semak:', ring.PERLU_SEMAK);

console.log('\n=== 3. Guru lihat senarai murid ===');
r = panggil({ tindakan:'senaraiMurid', token:TOKEN, data:{ kelasId:'TAHUN SATU | GIGIH' } });
const murid = r.data.murid;
cek('senarai tidak kosong', murid.length > 0, String(murid.length));
cek('semua murid dari kelas yang sama',
  murid.every(x => x.kelasId === 'TAHUN SATU | GIGIH'),
  [...new Set(murid.map(x=>x.kelasId))].join(', '));
cek('setiap murid ada medan dokumen',
  murid.every(x => 'statusDokumen' in x && 'tarikhHantarDokumen' in x && 'catatanDokumen' in x));
cek('tiada medan pengesahan bocor ke frontend',
  murid.every(x => !('disahkan' in x) && !('disahkanOleh' in x)));
cek('tiada medan PDPA yang tidak sepatutnya ada',
  murid.every(x => !('alamat' in x) && !('noAkaunBank' in x) && !('tarikhLahir' in x)));
const ps = murid.filter(x => x.kelayakan === 'PERLU_SEMAK');
cek('murid Perlu semak ada sebab yang boleh dibaca',
  ps.every(x => x.sebab && x.sebab.length > 10),
  JSON.stringify(ps.map(x=>x.sebab)));
console.log('        perlu semak:', ps.length, ps.length ? '| sebab: ' + ps[0].sebab : '');

console.log('\n=== 4. Guru betulkan murid Perlu semak ===');
if (ps.length) {
  const sasar = ps[0];
  const sebelum = sasar.kelayakan;
  r = panggil({ tindakan:'kemasMurid', token:TOKEN,
    data:{ idMurid: sasar.idMurid, perubahan:{ PendapatanPenjaga1: 800, Tanggungan: 5 },
           catatan:'Disemak dengan penjaga' } });
  cek('pembetulan diterima', !r.ralat, JSON.stringify(r.ralat));
  const segar = panggil({ tindakan:'senaraiMurid', token:TOKEN,
    data:{ kelasId:'TAHUN SATU | GIGIH' } }).data.murid.find(x => x.idMurid === sasar.idMurid);
  cek('status berubah selepas diisi', segar.kelayakan !== sebelum,
      sebelum + ' -> ' + segar.kelayakan);
  cek('medan ditanda sebagai diubah oleh guru',
      segar.medanDiubah.includes('PendapatanPenjaga1'), JSON.stringify(segar.medanDiubah));
  console.log('        ' + sebelum + ' -> ' + segar.kelayakan + ' (' + segar.sebab + ')');
} else {
  console.log('        (tiada murid Perlu semak dalam data ujian)');
}

console.log('\n=== 5. Guru rekod dokumen ===');
const sasar = murid[0];
const smlm = new Date(Date.now() - 864e5).toISOString().slice(0,10);
r = panggil({ tindakan:'kemasDokumen', token:TOKEN,
  data:{ idMurid: sasar.idMurid, status:'LENGKAP', tarikh: smlm, catatan:'Slip gaji + surat sumpah' } });
cek('dokumen lengkap direkod', !r.ralat && r.data.status === 'LENGKAP', JSON.stringify(r.ralat));

let segar = panggil({ tindakan:'senaraiMurid', token:TOKEN,
  data:{ kelasId:'TAHUN SATU | GIGIH' } }).data.murid.find(x => x.idMurid === sasar.idMurid);
cek('tarikh dipulangkan dalam bentuk YYYY-MM-DD untuk <input type=date>',
  /^\d{4}-\d{2}-\d{2}$/.test(segar.tarikhHantarDokumen), segar.tarikhHantarDokumen);
cek('tarikh yang dipulangkan sama dengan yang dihantar',
  segar.tarikhHantarDokumen === smlm, segar.tarikhHantarDokumen + ' vs ' + smlm);
cek('catatan dokumen kekal', segar.catatanDokumen === 'Slip gaji + surat sumpah');

console.log('\n=== 6. Guru kelas lain cuba masuk ===');
const TOKEN2 = panggil({ tindakan:'logMasuk', emel:'lain@sk.my',
  katalaluan:'KataLaluanKuat2' }).data.token;
r = panggil({ tindakan:'senaraiMurid', token:TOKEN2, data:{ kelasId:'TAHUN SATU | GIGIH' } });
cek('tidak boleh baca kelas orang lain', !!r.ralat, JSON.stringify(r.data && r.data.murid && r.data.murid.length));
r = panggil({ tindakan:'kemasDokumen', token:TOKEN2,
  data:{ idMurid: sasar.idMurid, status:'LENGKAP', tarikh: smlm } });
cek('tidak boleh tulis murid orang lain', !!r.ralat, JSON.stringify(r.ralat));
r = panggil({ tindakan:'ringkasan', token:TOKEN2 });
cek('guru tidak boleh buka papan pemuka penyelaras', !!r.ralat, JSON.stringify(r.ralat));
r = panggil({ tindakan:'ubahTetapan', token:TOKEN2, data:{ kunci:'pgk_miskin_tegar', nilai:'1' } });
cek('guru tidak boleh ubah had PGK', !!r.ralat, JSON.stringify(r.ralat));

console.log('\n=== 7. Token palsu dan tamat tempoh ===');
cek('token rekaan ditolak',
  !!panggil({ tindakan:'senaraiMurid', token:'x'.repeat(72), data:{ kelasId:'TAHUN SATU | GIGIH' } }).ralat);
cek('tiada token ditolak',
  !!panggil({ tindakan:'senaraiMurid', data:{ kelasId:'TAHUN SATU | GIGIH' } }).ralat);

console.log('\n=== 8. Jejak audit guru ===');
r = panggil({ tindakan:'audit', token:TOKEN, data:{ idMurid: sasar.idMurid } });
cek('guru boleh lihat jejak muridnya', !r.ralat && Array.isArray(r.data.audit));
cek('tindakan dokumen tercatat',
  r.data.audit.some(a => a.tindakan === 'GURU_DOKUMEN'),
  JSON.stringify(r.data.audit.map(a => a.tindakan)));
cek('jejak menamakan pelaku',
  r.data.audit.filter(a => a.tindakan === 'GURU_DOKUMEN').every(a => a.pelaku && a.pelaku !== 'sistem'),
  JSON.stringify(r.data.audit.filter(a=>a.tindakan==='GURU_DOKUMEN').map(a=>a.pelaku)));

console.log('\n' + '='.repeat(58));
console.log(isu ? '  ' + isu + ' ISU DIJUMPAI' : '  Tiada isu. Aliran guru berfungsi hujung ke hujung.');
console.log('='.repeat(58) + '\n');
process.exit(isu ? 1 : 0);
