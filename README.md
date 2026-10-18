# Sistem Permohonan Bantuan RMT

Borang permohonan Rancangan Makanan Tambahan untuk orang awam, dengan aliran
semakan dua peringkat (penyemak → pelulus) dan jejak audit.

**Stack:** Google Sheets (pangkalan data) + Google Apps Script (backend) +
GitHub Pages (frontend statik). Kos sifar, tanpa kad kredit.

---

## Struktur

```
docs/                     frontend — GitHub Pages terbitkan folder ini
  index.html              borang permohonan + semak status (awam)
  staf.html               papan pemuka penyemak / pelulus
  privasi.html            notis privasi PDPA
  assets/
    config.js             URL web app Apps Script anda  <-- EDIT FAIL INI
    api.js                lapisan fetch, tiada dependency luar
    ui.js                 pembantu DOM, tarikh DD/MM/YYYY, CSV
    apply.js              logik muka surat awam
    staf.js               logik papan pemuka pegawai
    app.css
apps-script/              tampal fail-fail ini ke editor Apps Script
  00_Konfig.gs            lajur, pemalar, tetapan lalai
  01_Helaian.gs           akses Sheets, kunci, sanitize, audit
  02_Auth.gs              hashing, sesi, had percubaan, kebenaran
  03_Awam.gs              tindakan awam (tanpa token)
  04_Staf.gs              tindakan pegawai (perlu token)
  05_Sweep.gs             kerja harian
  06_Pemasangan.gs        pasang(), tetapKataLaluan(), tetapKriteria()
  07_Main.gs              doPost / doGet
test/
  stub-google.js          tiruan servis Google
  jalan.js                59 ujian — `npm test`
```

---

## Aliran status

```
DIHANTAR ──► DALAM_SEMAKAN ──► DALAM_KELULUSAN ──► LULUS
   │              │   ▲              │  │
   │              │   └──────────────┘  └──► TOLAK
   │              ▼
   └──────► DIPULANGKAN ──(pemohon betulkan)──► DIHANTAR
                 │
                 └──(14 hari tiada tindakan)──► GUGUR

Pemohon boleh tarik balik dari DIHANTAR / DALAM_SEMAKAN / DIPULANGKAN
                                              └──► DITARIK_BALIK

Penyemak boleh TOLAK terus bila jelas tidak layak, tanpa ke pelulus.
```

Peraturan yang dikuatkuasakan dalam Apps Script, bukan di browser:

- **Pengasingan tugas** — pegawai yang menyemak tak boleh meluluskan kes yang
  sama. Disemak terhadap jejak audit, bukan satu medan, supaya admin yang
  menyemak sendiri juga tertangkap.
- **Had pulangan** — 3 kali. Selepas itu penyemak wajib buat keputusan.
- **Sebab wajib** — tiada TOLAK tanpa sebab, tiada DIPULANGKAN tanpa catatan.
- **Satu permohonan aktif per murid per sesi.**
- **Penapisan ikut sekolah** berlaku di server sebelum data dipulangkan.

## Saringan automatik menasihat, tidak memutuskan

`_saringan()` menanda pendapatan per kapita yang melebihi had, eKasih tanpa
nombor, dan murid yang sudah ada permohonan LULUS. Ia **tidak** menolak
sendiri — pendapatan yang diisytihar belum disemak terhadap dokumen, jadi
menolak secara automatik bermakna menolak atas maklumat yang belum disahkan.
Penyemak yang tekan "Tolak terus" bila dia sudah pasti.

Had kelayakan disimpan dalam helaian `Kriteria`, bukan dalam kod. Lihat nota
dalam `tetapKriteria()` — angka PGK rasmi terkini tidak dapat disahkan, jadi
ia sengaja dibiarkan kosong. Selagi kosong, saringan tidak menanda apa-apa
pada pendapatan dan sistem tetap berfungsi.

---

## Pemasangan

### 1. Spreadsheet dan Apps Script

1. Cipta Google Sheet baharu. Namakan apa sahaja.
2. **Extensions → Apps Script.**
3. Untuk setiap fail dalam `apps-script/`: **+ → Script**, namakan sama
   (tanpa `.gs`), tampal kandungannya. Urutan nama fail penting kerana
   Apps Script memuatkannya mengikut urutan.
4. Tetapkan manifest: ikon gear **Project Settings** → tanda
   *Show "appsscript.json" manifest file*, kemudian ganti kandungannya
   dengan `apps-script/appsscript.json`.
5. Pilih fungsi `pasang` → **Run**. Benarkan kebenaran yang diminta.
   Ia mencipta semua helaian dan tetapan lalai. Selamat dijalankan berulang.
6. Jalankan `pasangDataCubaan()` untuk dua sekolah contoh.
7. Jalankan `ujiKelajuanHash()`. Ia mencadangkan nilai `HASH_PUSINGAN` yang
   sesuai. Kemas kini nilai itu dalam `00_Konfig.gs`.
8. Jalankan `pasangTrigger()` untuk kerja harian.

### 2. Pegawai

Dalam helaian **Staf**, isi satu baris per pegawai:

| Emel | Nama | Peranan | SekolahKod | Aktif |
|---|---|---|---|---|
| `semak@sekolah.edu.my` | Cikgu Aminah | `penyemak` | ABA0001 | `TRUE` |
| `lulus@sekolah.edu.my` | Pn. Siti | `pelulus` | ABA0001 | `TRUE` |

Biarkan `Salt` dan `KataLaluanHash` kosong. Kemudian untuk setiap pegawai,
jalankan dari editor Apps Script:

```javascript
tetapKataLaluan('semak@sekolah.edu.my', 'KataLaluanSekurangnya10Aksara');
```

Penyemak dan pelulus **wajib dua orang berbeza** — sistem menolak percubaan
meluluskan kes yang anda sendiri semak.

> Emel di sini hanya pengenal diri untuk log masuk. Ia tidak perlu akaun
> Google dan sistem tidak menghantar emel.

### 3. Deploy web app

**Deploy → New deployment → Web app:**

| Tetapan | Nilai |
|---|---|
| Execute as | **Me** |
| Who has access | **Anyone** |

"Anyone" wajib — pemohon awam tiada akaun Google. Ia tidak bermakna sesiapa
boleh melihat data: `doPost` mengesahkan setiap input, dan setiap tindakan
pegawai memerlukan token sesi yang sah.

Salin URL yang berakhir dengan `/exec`.

> Setiap kali anda tukar kod, **Deploy → Manage deployments → Edit → Version:
> New version**. Tanpa ini URL lama masih menjalankan kod lama.

### 4. GitHub Pages

**Repo ini kena PUBLIC.** GitHub Pages dari repo private memerlukan pelan
berbayar (Pro/Team). Pada pelan Free, Pages hanya berfungsi dari repo public.

Itu selamat untuk projek ini kerana **tiada rahsia dalam repo**. URL
Apps Script ialah endpoint awam secara reka bentuk, dan tiada kata laluan,
key, atau data pemohon dalam mana-mana fail di sini. Data duduk dalam
Google Sheet anda, yang kekal private.

1. Edit `docs/assets/config.js` — tampal URL `/exec` anda.
2. Commit dan push.
3. **Settings → Pages:** Source *Deploy from a branch*, Branch `main`,
   Folder `/docs`. Save.
4. Tunggu seminit. Borang di `https://<nama-anda>.github.io/sistem-rmt/`,
   papan pemuka pegawai di `.../staf.html`.

### 5. Kriteria kelayakan

Bila anda ada angka PGK rasmi:

```javascript
tetapKriteria(550, 'PGK per kapita, sumber: pekeliling KPM bil. X/2026');
```

---

## Ujian

```bash
npm test
```

59 ujian berjalan terhadap fail `.gs` yang **sebenar**, dengan servis Google
ditiru di Node. Yang diuji:

| Kategori | Contoh yang lulus |
|---|---|
| Kata laluan | tiada teks biasa; salt unik per pegawai; kata laluan sama → hash berbeza; minimum 10 aksara |
| Log masuk | emel tiada dan kata laluan salah beri mesej yang **sama**; dikunci selepas 8 percubaan; selepas dikunci kata laluan betul pun ditolak |
| Borang awam | IC bukan 12 angka, akuan tak ditanda, tahun luar 1–6, sekolah palsu, permohonan pendua — semua ditolak |
| Formula injection | nama bermula `=` dineutralkan dengan apostrof |
| Semak status | dikunci pada percubaan ke-6; `tarikBalik` tak boleh memintas had; respons tak mendedahkan telefon atau pendapatan |
| Kebenaran | tiada token, token palsu, pelulus guna fungsi penyemak, penyemak sekolah lain — semua ditolak |
| Pengasingan tugas | penyemak tak boleh luluskan; **admin yang menyemak sendiri** tak boleh luluskan; pelulus lain boleh |
| Aliran | hantar semula sebahagian kekalkan medan lain; per kapita dikira semula; pulangan ke-4 ditolak |
| Sesi | log keluar membatalkan token **di server**; pegawai dinyahaktifkan hilang akses serta-merta; token tamat tempoh ditolak |
| Sweep | gugur tamat tempoh; anonim retention membuang data peribadi tetapi kekalkan status untuk statistik |
| Ketahanan | JSON rosak, tindakan tak dikenali, dan ralat tak dijangka tidak membocorkan dalaman |

**Apa yang ujian ini TIDAK buktikan:** gelagat sebenar `SpreadsheetApp`, kuota
Apps Script, CORS pada deployment sebenar, kelajuan `computeDigest`, dan
keselamatan concurrency sebenar (`LockService` ditiru sebagai sentiasa
berjaya kerana Node single-threaded). Perkara-perkara itu hanya boleh
dibuktikan pada deployment anda.

### Ujian yang anda kena buat sendiri selepas deploy

1. Buka borang, hantar satu permohonan, semak status dengan IC betul dan salah.
2. Masukkan IC salah 6 kali — patut dikunci.
3. Log masuk sebagai penyemak Sekolah A, pastikan permohonan Sekolah B tidak
   kelihatan.
4. Hantar satu kes ke kelulusan, kemudian log masuk sebagai pelulus yang
   **sama orang** dan cuba luluskan — patut ditolak.
5. Dari terminal, cuba panggil endpoint terus tanpa token:
   ```bash
   curl -L -X POST "<URL_EXEC>" -H 'Content-Type: text/plain' \
     -d '{"tindakan":"senarai","data":{}}'
   ```
   Patut dapat `{"ok":false,"ralat":"Sesi tamat atau tidak sah..."}`.

---

## Had yang perlu difahami

**Jejak audit lebih lemah dari versi pangkalan data.** Dalam Postgres, trigger
boleh menghalang `UPDATE` dan `DELETE` pada jadual audit sepenuhnya — admin
pun tidak boleh mengubahnya. Sheets tiada mekanisme itu. Kod hanya menambah,
dan `pasang()` meletakkan perlindungan amaran pada helaian Audit, tetapi
**pemilik spreadsheet sentiasa boleh mengeditnya secara manual**. Kalau audit
yang benar-benar kebal diperlukan untuk tujuan pengauditan rasmi, stack ini
tidak memadai.

**Hashing kata laluan lebih lemah dari bcrypt.** Apps Script tiada
bcrypt/Argon2. Yang ada ialah SHA-256 berulang dengan salt per-pengguna dan
pepper rahsia. Ia memperlahankan brute-force kira-kira `HASH_PUSINGAN` kali,
tetapi tiada memory-hardness. Risikonya terhad kerana **pemohon tiada akaun
sama sekali** — hanya segelintir pegawai yang ada kata laluan.

**Tiada muat naik dokumen.** Sengaja. Menyimpan salinan IC dan penyata
pendapatan 1,500 keluarga menambah risiko PDPA yang besar untuk pulangan yang
kecil. Dokumen disemak secara fizikal di sekolah; pemohon mengaku maklumat
benar dalam borang. IC penjaga juga tidak dikumpul.

**Tiada notifikasi automatik.** Emel dan SMS pukal bukan kos sifar yang boleh
dijamin. Pemohon menyemak sendiri guna no. rujukan + No. KP murid.

**Prestasi.** Pada 1,500 permohonan, papan pemuka membaca seluruh helaian
setiap kali dimuatkan (satu panggilan `getValues`, kira-kira 1–2 saat).
Pencarian satu permohonan guna `TextFinder`, jadi ia pantas. Kuota Apps
Script untuk akaun biasa ialah 90 minit masa pelaksanaan sehari — memadai
untuk beban ini, tetapi bukan tanpa had.

**Concurrency.** Setiap tulisan dibalut `LockService.getScriptLock()`.
Tanpa itu, dua permohonan serentak boleh kedua-duanya lulus semakan pendua.
Kunci bermakna permintaan berbaris; pada lonjakan trafik pengguna mungkin
nampak "Sistem sedang sibuk."

**Pindah ke Supabase kemudian.** Aliran status, nama medan, dan peraturan
sama dengan versi Postgres sistem ini, jadi memindahkan data kemudian ialah
kerja eksport-import, bukan reka bentuk semula.
