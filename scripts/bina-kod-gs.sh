#!/bin/sh
# Menjana Kod.gs — gabungan semua fail dalam apps-script/.
#
# Apps Script memuatkan semua fail .gs ke dalam satu skop global, jadi satu
# fail gabungan berkelakuan sama dengan 10 fail berasingan. Ia wujud semata
# untuk memudahkan penampalan ke editor Apps Script.
#
# Sumber kebenaran kekal apps-script/. Jalankan skrip ini selepas sebarang
# perubahan di situ:  sh scripts/bina-kod-gs.sh && npm test
set -eu
cd "$(dirname "$0")/.."
OUT=Kod.gs
{
  echo "/**"
  echo " * SISTEM PENGURUSAN KELAYAKAN RMT — SEMUA KOD DALAM SATU FAIL"
  echo " *"
  echo " * Gabungan automatik fail dalam apps-script/. JANGAN EDIT DI SINI —"
  echo " * edit di apps-script/ kemudian jalankan scripts/bina-kod-gs.sh."
  echo " *"
  echo " * Rujukan kelayakan: Surat Pekeliling Kewangan Bil. 1 Tahun 2026"
  echo " * (KPM.100-1/4/2 Jld.6), bertarikh 5 Februari 2026."
  echo " *"
  echo " * Sumber: https://github.com/EiznieJoe/sistem-rmt"
  echo " */"
  echo
  for f in apps-script/0*.gs; do
    echo "/* ============================================================="
    echo "   $(basename "$f")"
    echo "   ============================================================= */"
    echo
    cat "$f"
    echo
  done
} > "$OUT"
echo "$OUT dijana: $(wc -l < "$OUT") baris"
