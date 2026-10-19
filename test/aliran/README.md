# Ujian aliran

Berasingan daripada `npm test` kerana satunya memerlukan pelayar, dan
kerana ia menjawab soalan yang berbeza. `npm test` mengesahkan logik yang
sudah diketahui betul; skrip di sini memandu sistem seperti pengguna
sebenar untuk mencari perkara yang tidak dijangka.

## guru.js

```bash
node test/aliran/guru.js
```

Tiada kebergantungan. Memuatkan fail `.gs` sebenar, kemudian: log masuk,
buka kelas, betulkan murid "Perlu semak", rekod dokumen, dan cuba
menembusi sempadan kelas dengan akaun guru kedua.

## ui-guru.js

```bash
NODE_PATH=./node_modules node test/aliran/ui-guru.js
```

Memerlukan Chromium melalui Playwright, yang **bukan** kebergantungan
projek:

```bash
npm i --no-save @playwright/test
```

Memandu antara muka dalam pelayar dan memeriksa muatan yang betul-betul
dihantar ke pelayan. Backend boleh betul sambil wayar frontend salah —
ujian unit tidak akan nampak. Respons API dipalsukan melalui
`page.route()`, jadi ia tidak menyentuh deployment sebenar.

Laluan Chromium di dalamnya ditetapkan untuk persekitaran pembangunan
tertentu. Tukar `executablePath` kalau ia tidak dijumpai.
