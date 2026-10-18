# Sistem Pengurusan Kelayakan RMT

Import senarai murid dari iDME, guru kelas membetulkan yang perlu, sistem
mengira kelayakan RMT ikut pekeliling, penyelaras menyediakan senarai untuk
JBPS.

**Rujukan tunggal kelayakan:** Surat Pekeliling Kewangan Bil. 1 Tahun 2026,
Program Rancangan Makanan Tambahan dan Program Susu Sekolah
(KPM.100-1/4/2 Jld.6), bertarikh 5 Februari 2026. SPK ini membatalkan
SPK BT 19 bertarikh 17 Julai 2020.

**Stack:** Google Sheets (pangkalan data) + Google Apps Script (backend) +
GitHub Pages (frontend). Kos sifar.

---

## Ujian pendapatan ada DUA peringkat

**Peringkat 1 — PIR penuh lawan PGK miskin tegar.**
Perenggan 3.7 mentakrifkan PIR sebagai semua bentuk pendapatan ibu
bapa/penjaga; perenggan 4.1(c) membandingkannya dengan PGK Nasional semasa
dalam kategori miskin tegar. Lulus di sini = layak.

**Peringkat 2 — per kapita, HANYA jika peringkat 1 gagal.**
Pendapatan dibahagi bilangan tanggungan. Perenggan 3.6 mentakrifkan
Tanggungan sebagai "keluarga asas yang terdiri daripada **ibu bapa/penjaga
dan anak-anak**", jadi medan `TANGGUNGAN` iDME **sudah termasuk ibu bapa** —
jangan tambah satu atau dua lagi.

```
PIR < PGK ?                         -> LAYAK (4.1c)
  tidak -> had per kapita ada ?
             tidak  -> TIDAK LAYAK
             ada    -> tanggungan ada ?
                         tidak -> PERLU SEMAK
                         ada   -> PIR/tanggungan < had ? -> LAYAK (per kapita)
                                                          -> TIDAK LAYAK
```

**Nota jujur tentang sumber.** Peringkat 2 tidak tertulis dalam SPK Bil. 1
Tahun 2026 itu sendiri. Perenggan 18.1 SPK menyatakan ia hendaklah dibaca
bersama *GP Pengurusan Program RMT*, dan peraturan per kapita difahami
datang dari GP tersebut. Kalau PPD/JPN kemudian menyatakan sebaliknya,
kosongkan tetapan `pgk_per_kapita` — peringkat 2 berhenti sepenuhnya tanpa
sebarang perubahan kod.

Kesan peringkat 2 besar. Pada data sekolah ini, had per kapita RM550 boleh
menambah ratusan murid berbanding peringkat 1 sahaja. **Sahkan had itu
dengan PPD/JPN sebelum menghantar senarai.** Lalai: kosong (peringkat 2
dimatikan).

## Peraturan yang dilaksanakan

| Perenggan | Peraturan | Dalam kod |
|---|---|---|
| 3.1, 4.1(b) | "Murid" = Tahun 1 hingga Tahun 6 | `LUAR_SKOP` untuk prasekolah dan kelas khas |
| 4.2 | Murid tinggal di asrama **TIDAK LAYAK** | Penafian mutlak, mengatasi semua laluan |
| 4.1(a) | Warganegara Malaysia | Bukan warganegara ditolak; belum disahkan → `PERLU_SEMAK` |
| 4.1(c) | PIR di bawah PGK miskin tegar | Peringkat 1 |
| GP | Per kapita bila PIR melebihi PGK | Peringkat 2, boleh dimatikan |
| 4.1(d) | Sekolah Orang Asli/Penan | Semua murid layak, tanpa ujian pendapatan |
| 4.1(e) | Murid SBJK yang sudah ada dokumen | Laluan berasingan |
| 4.1(f) | MBPK pemegang Kad OKU (JKM) | Layak tanpa ujian pendapatan |
| 5.1 | RM4.00/hari Sabah, Sarawak, Labuan | Tetapan `kadar_sehari` |

Kelayakan **tidak disimpan**. Ia dikira semula setiap kali dari data semasa,
jadi menukar PGK dalam Tetapan terus mengemas kini semua angka tanpa import
semula. Setiap jumlah dipaparkan bersama formula yang menghasilkannya.

**PGK lalai RM1,236** ialah PGK Makanan nasional dari HIES 2024 (DOSM), naik
dari RM1,198 pada 2022. Pekeliling kata "PGK Nasional **semasa**" — sahkan
dengan PPD/JPN dan kemas kini dalam Tetapan, bukan dalam kod.

---

## Dua perangkap dalam data iDME

**1. `NAMA KELAS` bukan kelas.** Dalam eksport sebenar, "GIGIH" muncul 264
kali merentas enam tahun berbeza. Identiti kelas ialah `TAHUN | NAMA KELAS`.
Kalau dikunci pada nama kelas sahaja, guru Tahun Satu akan melihat pendapatan
keluarga 264 murid dari enam tahun, bukan 41 murid kelasnya. Itu pelanggaran
PDPA, bukan bug kecil.

**2. IC bukan kunci utama.** Dalam eksport sebenar, 29 murid tiada Kad
Pengenalan — 17 tanpa dokumen, 6 sijil lahir, 5 pasport, 1 nombor polis.
Pengesahan "IC mesti 12 angka" akan menolak mereka, dan murid tanpa dokumen
selalunya yang paling miskin. `ID MURID` unik untuk semua dan itu kunci yang
digunakan.

## Import tidak memadam kerja guru

Setiap medan yang guru betulkan direkod dalam `MedanDiubah`. Import iDME
berikutnya melangkau medan itu dan mencatat percanggahan dalam `ImportLog`
untuk penyelaras tengok — bukan menimpanya senyap-senyap. Medan struktur
(tahun, kelas) sentiasa ikut import; guru tidak boleh mengubah kelas murid.

Lajur dipadankan ikut **nama kepala**, bukan kedudukan. Kalau iDME menyusun
semula atau menambah lajur, import tetap berfungsi. Kalau kepala wajib
hilang, import berhenti dan menamakannya — ia tidak meneka.

---

## Pemasangan

### 1. Spreadsheet dan Apps Script

1. Cipta Google Sheet baharu → **Extensions → Apps Script**.
2. Tampal kod. Dua cara, sama hasilnya:
   - **Senang:** buka `Kod.gs` (gabungan semua fail), salin semuanya ke dalam
     fail `Code.gs` yang sedia ada. Satu tampalan sahaja.
   - **Kemas:** untuk setiap fail dalam `apps-script/`, **+ → Script**,
     namakan sama (tanpa `.gs`), tampal kandungannya. Urutan nama penting.

   `Kod.gs` dijana dari `apps-script/` oleh `scripts/bina-kod-gs.sh`. Sumber
   kebenaran ialah `apps-script/` — jangan edit `Kod.gs` terus.
3. **Project Settings** → tanda *Show "appsscript.json"*, ganti dengan
   `apps-script/appsscript.json`.
4. Jalankan `pasang()`. Benarkan kebenaran. Selamat dijalankan berulang.
5. Isi helaian **Sekolah**: Kod, Nama, **Jenis**, Negeri, Aktif(TRUE).
   Jenis: `SK`, `SBK`, `ORANG ASLI`, `PENAN`, atau `SBJK` — ia menentukan
   laluan 4.1(d) dan 4.1(e).
6. Jalankan `ujiKelajuanHash()` dan laraskan `HASH_PUSINGAN`.
7. Jalankan `pasangTrigger()`.

### 2. Import data iDME

1. Eksport "Senarai Keseluruhan Murid" dari iDME.
2. Tampal **keseluruhannya** (termasuk baris tajuk laporan) ke helaian
   **ImportMentah**.
3. Jalankan `importDariHelaian()`. Ia melaporkan baris dibaca, baharu,
   dikemaskini, dilangkau, dan konflik.

### 3. Akaun dan tugasan kelas

Akaun dan tugasan kelas **sengaja diasingkan**, kerana guru kelas bertukar
setiap tahun. Tukar guru = tukar satu baris, tanpa import semula.

```javascript
daftarPegawai('selaras@sekolah.edu.my', 'Pn. Siti', 'penyelaras', 'KataLaluanPanjang', 'XBA4382');
daftarPegawai('guru1@sekolah.edu.my',  'Cikgu Aminah', 'guru',    'KataLaluanPanjang', 'XBA4382');

kelasTanpaGuru();                                        // kelas mana belum ada guru
tugaskanGuru('TAHUN SATU | GIGIH', 'guru1@sekolah.edu.my');
```

Import membawa `NAMA GURU KELAS` dari iDME sebagai rujukan sahaja, supaya
pentadbir tahu nama mana belum ada akaun. Ia tidak pernah menetapkan akses.

### 4. Tetapkan PGK

```javascript
tetapPgk(1236, 'PGK Makanan nasional HIES 2024 (DOSM). Disahkan PPD pada ...');
```

Selagi PGK kosong, tiada murid ditanda layak — sistem tidak mengandaikan.

### 5. Deploy

**Deploy → New deployment → Web app**, Execute as **Me**, Who has access
**Anyone**. Salin URL `/exec`.

> Setiap kali tukar kod: **Manage deployments → Edit → Version: New version**.
> Tanpa ini URL lama masih menjalankan kod lama.

### 6. GitHub Pages

**Repo ini kena PUBLIC.** GitHub Pages dari repo private memerlukan pelan
berbayar. Itu selamat di sini: tiada rahsia dalam repo, dan tiada data murid
— `.gitignore` menyekat `*.xlsx` dan `*.csv`. Data duduk dalam Google Sheet
anda yang kekal private.

1. Tampal URL `/exec` ke `docs/assets/config.js`.
2. Commit, push.
3. **Settings → Pages:** Source *Deploy from a branch*, Branch `main`,
   Folder `/docs`.

---

## Ujian

```bash
npm test
```

63 ujian terhadap fail `.gs` yang **sebenar**, dengan servis Google ditiru
di Node. Antara yang dibuktikan:

- Setiap laluan perenggan 4.1(c)/(d)/(e)/(f) dan penafian 4.2
- Asrama mengatasi pendapatan; Kad OKU melepasi ujian pendapatan
- Pendapatan `0` ialah data sah, bukan data kosong
- Tiada data → `PERLU_SEMAK`, bukan ditolak senyap
- PGK belum ditetapkan → `PERLU_SEMAK`, bukan dianggap layak
- Guru Tahun 1 GIGIH nampak 9 murid, bukan 11 (Tahun 2 GIGIH terkecuali)
- Guru tidak boleh buka atau ubah kelas guru lain
- Import semula mengekalkan pembetulan guru dan melaporkan konflik
- Lajur disusun terbalik tetap diimport betul; kepala wajib hilang → berhenti
- Log keluar membatalkan token di server; pegawai dinyahaktifkan hilang akses
  serta-merta
- Formula injection dineutralkan; ralat tak dijangka tidak membocorkan dalaman

Fail iDME sebenar turut dijalankan melalui parser secara setempat (tidak
di-commit): 1,409 baris, 37 kelas, 392 layak. Beza dengan kiraan
pendapatan-sahaja (393) direkonsiliasi tepat: −2 bukan warganegara,
−1 warganegara belum disahkan, +2 melalui Kad OKU.

**Apa yang ujian ini TIDAK buktikan:** gelagat sebenar `SpreadsheetApp`,
kuota Apps Script, CORS pada deployment anda, kelajuan `computeDigest`, dan
concurrency sebenar (`LockService` ditiru sebagai sentiasa berjaya kerana
Node single-threaded).

---

## Kata laluan

Tiga laluan, kerana pentadbir sistem selalunya bukan orang yang guna sistem:

| Keadaan | Jalan |
|---|---|
| Lupa kata laluan | "Lupa kata laluan?" di skrin log masuk — kod 6 angka dihantar ke emel pegawai, sah 30 minit |
| Mahu tukar | Butang "Tukar kata laluan" selepas log masuk; perlu kata laluan semasa |
| Emel pegawai pun bermasalah | Pentadbir jalankan `resetKataLaluanPegawai('emel')` dari editor; kata laluan sementara dipapar sekali dalam log |

Butiran yang penting:

- **Kod disimpan sebagai hash bersalt**, bukan teks biasa. Sesiapa yang boleh
  baca helaian `ResetKod` tetap tidak boleh menggunakan kodnya.
- **Jawapan sama tanpa mengira emel itu wujud atau tidak.** Endpoint ini tiada
  auth, jadi jawapan yang berbeza akan menjadikannya alat untuk menyenaraikan
  akaun yang wujud.
- **Had 3 permintaan kod per emel per jam**, supaya ia tidak boleh dipakai
  membanjiri peti masuk seseorang atau menghabiskan kuota emel harian.
- **5 kod salah membatalkan kod itu** — kod betul pun ditolak selepas itu.
- **Menukar kata laluan membatalkan semua sesi**, termasuk sesi semasa. Kalau
  akaun memang dirampas, menukar kata laluan mesti menendang keluar penceroboh.

Emel dihantar melalui `MailApp` sebagai akaun yang deploy script. Had harian:
100 penerima untuk akaun Gmail biasa, 1,500 untuk Google Workspace. Untuk ~31
staf itu jauh lebih dari cukup. Nota jujur: emel datang dari alamat peribadi
akaun yang deploy, bukan domain sekolah, jadi ada kemungkinan masuk folder
spam. Deploy dari akaun Workspace sekolah akan menghapuskan masalah itu.

## Had yang perlu difahami

**Jejak audit lebih lemah dari pangkalan data sebenar.** Dalam Postgres,
trigger boleh menghalang `UPDATE` dan `DELETE` pada jadual audit sepenuhnya.
Sheets tiada mekanisme itu. Kod hanya menambah dan `pasang()` meletakkan
perlindungan amaran, tetapi **pemilik spreadsheet sentiasa boleh mengeditnya
dengan tangan**. Kalau audit kebal diperlukan untuk pengauditan rasmi, stack
ini tidak memadai.

**Hashing lebih lemah dari bcrypt.** Apps Script tiada bcrypt/Argon2. SHA-256
berulang dengan salt per-pengguna dan pepper memperlahankan brute-force
kira-kira `HASH_PUSINGAN` kali, tetapi tiada memory-hardness. Risiko terhad
kerana tiada akaun orang awam.

**Prestasi.** 1,409 murid dibaca dalam satu `getValues`; import menulis balik
dalam satu `setValues`. Pencarian seorang murid guna `TextFinder`. Kuota Apps
Script untuk akaun biasa ialah 90 minit pelaksanaan sehari.

**Concurrency.** Setiap tulisan dibalut `LockService.getScriptLock()`. Pada
lonjakan trafik pengguna mungkin nampak "Sistem sedang sibuk."

**Prasekolah dan Kelas Khas Rendah** dikecualikan secara lalai mengikut
perenggan 3.1, dan **tidak dipaparkan langsung** dalam papan pemuka — bukan
sekadar tidak dikira. Tetapi perenggan 4.1(f) memberi laluan kepada MBPK
pemegang Kad OKU tanpa ujian pendapatan, jadi tetapan `kira_kelas_khas`
boleh ditukar kepada `ya` dan mereka muncul semula.
