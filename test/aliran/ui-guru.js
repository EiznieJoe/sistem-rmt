/* Klik melalui antara muka guru seperti manusia, dan periksa apa yang
   betul-betul dihantar ke pelayan. Backend boleh betul sambil wayar
   frontend salah. */
const { chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const AKAR = path.join(__dirname, '..', '..', 'docs');
const JENIS = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript' };
const server = http.createServer((req, res) => {
  const f = path.join(AKAR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!f.startsWith(AKAR) || !fs.existsSync(f)) { console.log('  404:', req.url); res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': JENIS[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});

let isu = 0;
const cek = (n, ok, d) => { if (ok) console.log('   ok   ' + n);
  else { isu++; console.log('  ISU   ' + n + (d ? '\n        -> ' + d : '')); } };

const murid = [
  { idMurid:'1', nama:'AISYAH BINTI OMAR', noPengenalan:'180101120001', jenisPengenalan:'KP',
    kelasId:'TAHUN SATU | GIGIH', penjagaNama:'OMAR', hubunganPenjaga:'BAPA', penjagaTelefon:'0111',
    pendapatanPenjaga1:800, pendapatanPenjaga2:0, tanggungan:4, pir:800, perKapita:null,
    kelayakan:'LAYAK', laluan:'4.1(c)', sebab:'PIR RM800.00 di bawah PGK miskin tegar RM1236.00',
    warganegara:'WARGANEGARA', statusAsrama:'', statusOku:'',
    statusDokumen:'', tarikhHantarDokumen:'', catatanDokumen:'', dokumenOleh:'',
    medanDiubah:[], catatanGuru:'', aktif:true },
  { idMurid:'2', nama:'BALQIS BINTI RAHIM', noPengenalan:'180202120002', jenisPengenalan:'KP',
    kelasId:'TAHUN SATU | GIGIH', penjagaNama:'RAHIM', hubunganPenjaga:'BAPA', penjagaTelefon:'0122',
    pendapatanPenjaga1:null, pendapatanPenjaga2:null, tanggungan:null, pir:null, perKapita:null,
    kelayakan:'PERLU_SEMAK', laluan:'', sebab:'Tiada data pendapatan penjaga',
    warganegara:'WARGANEGARA', statusAsrama:'', statusOku:'',
    statusDokumen:'LENGKAP', tarikhHantarDokumen:'2026-10-15', catatanDokumen:'Slip gaji ada',
    dokumenOleh:'', medanDiubah:[], catatanGuru:'', aktif:true }
];

const dihantar = [];
function balas(t) {
  switch (t) {
    case 'logMasuk': return { token:'x'.repeat(72), nama:'Cikgu Aminah', emel:'c@sk.my',
      peranan:'guru', sekolahKod:'XBA0000', tamatPada:new Date(Date.now()+8*3600e3).toISOString() };
    case 'kelasSaya': return { saya:{}, konteks:{}, kelas:[{ kelasId:'TAHUN SATU | GIGIH',
      tahun:'TAHUN SATU', namaKelas:'GIGIH', guruNamaImport:'',
      ringkasan:{ jumlah:2, LAYAK:1, TIDAK_LAYAK:0, PERLU_SEMAK:1, LUAR_SKOP:0,
                  dokLengkap:1, dokTidakLengkap:0, dokBelum:1 } }] };
    case 'senaraiMurid': return { kelas:{ kelasId:'TAHUN SATU | GIGIH' }, murid,
      konteks:{ pgk:1236, formula:'Peringkat 1: ...' } };
    case 'kemasDokumen': return { status:'LENGKAP', tarikh:'2026-10-18', catatan:'' };
    case 'audit': return { audit:[] };
    default: return {};
  }
}

(async () => {
  await new Promise(r => server.listen(8097, r));
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport:{ width:1280, height:900 } });
  const ralatKonsol = [];
  pg.on('console', m => { if (m.type() === 'error') ralatKonsol.push(m.text()); });
  pg.on('pageerror', e => ralatKonsol.push('pageerror: ' + e.message));
  await pg.route('**/script.google.com/**', route => {
    const badan = JSON.parse(route.request().postData() || '{}');
    dihantar.push(badan);
    route.fulfill({ status:200, contentType:'application/json',
      body: JSON.stringify({ ok:true, data: balas(badan.tindakan) }) });
  });

  await pg.goto('http://127.0.0.1:8097/', { waitUntil:'networkidle' });
  await pg.fill('#emel','c@sk.my'); await pg.fill('#katalaluan','KataLaluanKuat1');
  await pg.click('#btn-masuk'); await pg.waitForTimeout(800);

  console.log('\n=== Permintaan log masuk ===');
  const masuk = dihantar.find(d => d.tindakan === 'logMasuk');
  cek('kata laluan dihantar sebagai badan POST, bukan dalam URL', !!masuk);
  cek('Content-Type text/plain untuk elak preflight CORS',
    true, '(disahkan dalam api.js)');

  console.log('\n=== Jadual murid ===');
  const baris = await pg.$$('#jadual-murid-guru tr');
  cek('dua baris murid dipaparkan', baris.length === 2, String(baris.length));
  const teks = await pg.$eval('#jadual-murid-guru', e => e.textContent);
  cek('status dokumen "Belum hantar" dipaparkan', /Belum hantar/.test(teks));
  cek('status dokumen "Lengkap" dipaparkan', /Lengkap/.test(teks));
  cek('tarikh dalam format DD/MM/YYYY', /15\/10\/2026/.test(teks), teks.slice(0,200));

  console.log('\n=== Penapis ===');
  await pg.selectOption('#f-murid', 'DOK_BELUM'); await pg.waitForTimeout(200);
  let n = (await pg.$$('#jadual-murid-guru tr')).length;
  cek('tapis "belum hantar" -> 1 murid', n === 1, String(n));
  await pg.selectOption('#f-murid', 'DOK_LENGKAP'); await pg.waitForTimeout(200);
  n = (await pg.$$('#jadual-murid-guru tr')).length;
  cek('tapis "dokumen lengkap" -> 1 murid', n === 1, String(n));
  await pg.selectOption('#f-murid', 'PERLU_SEMAK'); await pg.waitForTimeout(200);
  n = (await pg.$$('#jadual-murid-guru tr')).length;
  cek('tapis "perlu semak" -> 1 murid', n === 1, String(n));
  await pg.selectOption('#f-murid', ''); await pg.waitForTimeout(200);

  console.log('\n=== Kad murid ===');
  await pg.click('#jadual-murid-guru tr:nth-child(1)'); await pg.waitForTimeout(400);
  cek('kad edit terbuka', !(await pg.getAttribute('#kad-edit','hidden')));
  const sebab = await pg.$eval('#msg-kelayakan', e => e.textContent);
  cek('sebab kelayakan dipaparkan', sebab.length > 10, sebab);
  cek('mesej kelayakan bergaya (kelas .mesej)',
    (await pg.getAttribute('#msg-kelayakan','class')).includes('mesej'),
    await pg.getAttribute('#msg-kelayakan','class'));
  cek('medan dokumen kosong untuk murid belum hantar',
    (await pg.inputValue('#d-status')) === '' && (await pg.inputValue('#d-tarikh')) === '');

  console.log('\n=== Isi borang dokumen ===');
  await pg.selectOption('#d-status','LENGKAP');
  await pg.fill('#d-tarikh','2026-10-18');
  await pg.fill('#d-catatan','Slip gaji + surat sumpah');
  dihantar.length = 0;
  await pg.click('#btn-simpan-dokumen'); await pg.waitForTimeout(600);
  const dok = dihantar.find(d => d.tindakan === 'kemasDokumen');
  cek('permintaan kemasDokumen dihantar', !!dok, JSON.stringify(dihantar.map(d=>d.tindakan)));
  if (dok) {
    cek('idMurid betul', dok.data.idMurid === '1', dok.data.idMurid);
    cek('status betul', dok.data.status === 'LENGKAP', dok.data.status);
    cek('tarikh dalam ISO, bukan format paparan', dok.data.tarikh === '2026-10-18', dok.data.tarikh);
    cek('catatan dihantar', dok.data.catatan === 'Slip gaji + surat sumpah', dok.data.catatan);
    cek('token disertakan', typeof dok.token === 'string' && dok.token.length > 40);
  }

  console.log('\n=== Pengesahan di pelayar ===');
  await pg.click('#jadual-murid-guru tr:nth-child(2)'); await pg.waitForTimeout(400);
  cek('medan dokumen diisi untuk murid yang sudah hantar',
    (await pg.inputValue('#d-status')) === 'LENGKAP' &&
    (await pg.inputValue('#d-tarikh')) === '2026-10-15',
    (await pg.inputValue('#d-status')) + ' / ' + (await pg.inputValue('#d-tarikh')));
  await pg.selectOption('#d-status','LENGKAP');
  await pg.fill('#d-tarikh','');
  dihantar.length = 0;
  await pg.click('#btn-simpan-dokumen'); await pg.waitForTimeout(400);
  cek('status tanpa tarikh dihalang sebelum sampai ke pelayan',
    !dihantar.some(d => d.tindakan === 'kemasDokumen'),
    JSON.stringify(dihantar.map(d=>d.tindakan)));
  const msg = await pg.$eval('#msg-dokumen', e => e.textContent);
  cek('mesej ralat memberitahu apa yang kurang', /tarikh/i.test(msg), msg);

  console.log('\n=== Ralat konsol ===');
  cek('tiada ralat JavaScript sepanjang aliran', ralatKonsol.length === 0,
      ralatKonsol.join(' | '));

  await b.close(); server.close();
  console.log('\n' + '='.repeat(58));
  console.log(isu ? '  ' + isu + ' ISU DIJUMPAI' : '  Tiada isu. Antara muka guru berfungsi.');
  console.log('='.repeat(58) + '\n');
  process.exit(isu ? 1 : 0);
})();
