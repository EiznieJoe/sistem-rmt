/* Papan pemuka pegawai.
   Butang yang dipapar ikut peranan, tetapi itu UX sahaja — Apps Script
   mengesahkan token dan peranan pada setiap tindakan, jadi memanggil
   endpoint terus dari curl tetap ditolak. */
(function () {
  "use strict";
  var el = UI.el, papar = UI.papar, sorok = UI.sorok;
  var $ = function (id) { return document.getElementById(id); };

  var saya = null, baris = [], pilihan = null;
  var sla = { semakan: 7, kelulusan: 5 };

  $("borang-masuk").onsubmit = function (ev) {
    ev.preventDefault();
    var m = $("msg-masuk");
    papar(m, "info", "Log masuk…");
    $("btn-masuk").disabled = true;
    RMT.logMasuk($("emel").value.trim(), $("katalaluan").value)
      .then(function () { sorok(m); return muat(); })
      .catch(function (e) { papar(m, "err", e.message); })
      .then(function () { $("btn-masuk").disabled = false; $("katalaluan").value = ""; });
  };

  $("btn-keluar").onclick = function () {
    RMT.logKeluar().then(function () { location.reload(); });
  };

  function muat() {
    papar($("msg-papan"), "info", "Memuatkan…");
    return RMT.staf("senarai", { status: $("f-status").value })
      .then(function (d) {
        saya = d.saya;
        sla = d.sla;
        baris = d.permohonan || [];
        $("borang-masuk").hidden = true;
        $("papan").hidden = false;
        $("btn-keluar").hidden = false;
        $("siapa").textContent = saya.nama + " — " + saya.peranan;
        sorok($("msg-papan"));
        lukisSenarai();
      })
      .catch(function (e) {
        if (!saya) { papar($("msg-masuk"), "err", e.message); }
        else { papar($("msg-papan"), "err", e.message); }
        throw e;
      });
  }

  $("btn-muat").onclick = function () { muat().catch(function () {}); };
  $("f-status").onchange = function () { muat().catch(function () {}); };
  $("f-cari").oninput = lukisSenarai;

  function ditapis() {
    var k = $("f-cari").value.trim().toLowerCase();
    if (!k) return baris;
    return baris.filter(function (r) {
      return (r.muridNama || "").toLowerCase().indexOf(k) >= 0 ||
             (r.noRujukan || "").toLowerCase().indexOf(k) >= 0;
    });
  }

  function lambat(r) {
    var hari = UI.hariSejak(r.tarikhHantar);
    if (r.status === "DIHANTAR" || r.status === "DALAM_SEMAKAN") return hari > sla.semakan;
    if (r.status === "DALAM_KELULUSAN") return UI.hariSejak(r.tarikhSemakan) > sla.kelulusan;
    return false;
  }

  function lukisSenarai() {
    var rows = ditapis(), tb = $("senarai");
    tb.textContent = "";
    if (!rows.length) {
      tb.appendChild(el("tr", null, [el("td", { colspan: "6", text: "Tiada permohonan." })]));
    }
    rows.forEach(function (r) {
      var hari = UI.hariSejak(r.tarikhHantar);
      var tdUmur = el("td", { text: hari + " hari" });
      if (lambat(r)) { tdUmur.className = "late"; tdUmur.textContent = hari + " hari — lewat SLA"; }

      var tr = el("tr", {
        "aria-selected": pilihan && pilihan.noRujukan === r.noRujukan ? "true" : "false"
      }, [
        el("td", { text: r.noRujukan }),
        el("td", { text: r.muridNama }),
        el("td", { text: String(r.muridTahun) }),
        el("td", { text: UI.rm(r.pendapatanPerKapita) }),
        el("td", null, [UI.lencana(r.status)]),
        tdUmur
      ]);
      tr.onclick = function () { pilih(r); };
      tb.appendChild(tr);
    });

    var kira = {};
    baris.forEach(function (r) { kira[r.status] = (kira[r.status] || 0) + 1; });
    var lewat = baris.filter(lambat).length;
    $("ringkasan").textContent = rows.length + " dipaparkan daripada " + baris.length +
      " dimuatkan" + (lewat ? " · " + lewat + " lewat SLA" : "") + " · " +
      Object.keys(kira).map(function (k) { return (UI.LABEL[k] || k) + ": " + kira[k]; }).join(" · ");
  }

  function pilih(r) {
    pilihan = r;
    lukisSenarai();
    $("butiran").hidden = false;
    $("d-ruj").textContent = r.noRujukan;
    $("d-badge").textContent = "";
    $("d-badge").appendChild(UI.lencana(r.status));
    $("d-catatan").value = "";
    sorok($("msg-tindakan"));

    var kv = $("d-kv");
    kv.textContent = "";
    [["Murid", r.muridNama],
     ["No. KP murid", r.muridIC],
     ["Tahun / kelas", r.muridTahun + (r.muridKelas ? " " + r.muridKelas : "")],
     ["Penjaga", r.penjagaNama + " (" + r.penjagaHubungan + ")"],
     ["Telefon", r.penjagaTelefon],
     ["Isi rumah", r.bilIsiRumah + " orang"],
     ["Pendapatan isi rumah", UI.rm(r.pendapatanIsiRumah)],
     ["Pendapatan per kapita", UI.rm(r.pendapatanPerKapita)],
     ["eKasih", r.eKasih ? ("Ya" + (r.noEKasih ? " — " + r.noEKasih : "")) : "Tidak"],
     ["Kali dipulangkan", String(r.kaliDipulangkan)],
     ["Tarikh hantar", UI.tarikh(r.tarikhHantar, true)],
     ["Catatan penyemak", r.catatanPenyemak || "—"],
     ["Catatan pelulus", r.catatanPelulus || "—"],
     ["Sebab tolak", r.sebabTolak || "—"]
    ].forEach(function (p) {
      kv.appendChild(el("dt", { text: p[0] }));
      kv.appendChild(el("dd", { text: p[1] == null ? "—" : String(p[1]) }));
    });

    lukisButang(r);

    var ol = $("d-audit");
    ol.textContent = "";
    ol.appendChild(el("li", { text: "Memuatkan…" }));
    $("d-saringan").hidden = true;

    RMT.staf("butiran", { noRujukan: r.noRujukan }).then(function (d) {
      var n = $("d-saringan");
      if (d.saringan && d.saringan.length) {
        n.hidden = false;
        n.textContent = "Saringan automatik menanda: " + d.saringan.join(" · ") +
          " — ini petunjuk sahaja, keputusan tetap di tangan anda.";
      }
      ol.textContent = "";
      if (!d.audit.length) { ol.appendChild(el("li", { text: "Tiada rekod." })); return; }
      d.audit.forEach(function (a) {
        ol.appendChild(el("li", null, [
          el("time", { text: UI.tarikh(a.masa, true) }),
          el("span", {
            text: a.tindakan + " oleh " + a.pelaku +
              (a.statusDari ? " (" + a.statusDari + " → " + a.statusKe + ")" : "") +
              (a.sebab ? " — " + a.sebab : "")
          })
        ]));
      });
    }).catch(function (e) {
      ol.textContent = "";
      ol.appendChild(el("li", { text: "Gagal memuatkan: " + e.message }));
    });
  }

  function lukisButang(r) {
    var wrap = $("d-butang");
    wrap.textContent = "";
    var boleh = function (p) { return saya.peranan === p || saya.peranan === "admin"; };

    function tambah(teks, kelas, kerja) {
      var b = el("button", { type: "button", class: "ghost" + (kelas ? " " + kelas : ""), text: teks });
      b.onclick = kerja;
      wrap.appendChild(b);
    }

    function jalan(tindakan, bina, perluCatatan) {
      var catatan = $("d-catatan").value.trim();
      if (perluCatatan && !catatan) {
        return papar($("msg-tindakan"), "err", "Catatan wajib untuk tindakan ini.");
      }
      papar($("msg-tindakan"), "info", "Memproses…");
      RMT.staf(tindakan, bina(catatan)).then(function (res) {
        papar($("msg-tindakan"), "ok", "Status kini: " + (UI.LABEL[res.status] || res.status));
        return muat();
      }).then(function () {
        var segar = baris.filter(function (x) { return x.noRujukan === r.noRujukan; })[0];
        if (segar) pilih(segar);
        else { $("butiran").hidden = true; pilihan = null; }
      }).catch(function (e) { papar($("msg-tindakan"), "err", e.message); });
    }

    if (boleh("penyemak")) {
      if (r.status === "DIHANTAR") {
        tambah("Mula semakan", null, function () {
          jalan("mulaSemakan", function () { return { noRujukan: r.noRujukan }; }, false);
        });
      }
      if (r.status === "DIHANTAR" || r.status === "DALAM_SEMAKAN") {
        tambah("Pulangkan kepada pemohon", null, function () {
          jalan("pulangkan", function (c) { return { noRujukan: r.noRujukan, catatan: c }; }, true);
        });
        tambah("Hantar untuk kelulusan", null, function () {
          jalan("keKelulusan", function (c) { return { noRujukan: r.noRujukan, catatan: c }; }, false);
        });
        tambah("Tolak terus (tidak layak)", "danger", function () {
          if (!window.confirm("Tolak terus tanpa ke pelulus? " +
              "Pemohon akan nampak sebab yang anda tulis.")) return;
          jalan("tolakTerus", function (c) { return { noRujukan: r.noRujukan, sebab: c }; }, true);
        });
      }
    }

    if (boleh("pelulus") && r.status === "DALAM_KELULUSAN") {
      if (String(r.penyemakEmel || "").toLowerCase() === String(saya.emel).toLowerCase()) {
        wrap.appendChild(el("span", { class: "hint",
          text: "Anda yang menyemak kes ini. Pelulus lain perlu memutuskan (pengasingan tugas)." }));
      } else {
        tambah("Lulus", null, function () {
          if (!window.confirm("Luluskan permohonan " + r.noRujukan + "?")) return;
          jalan("putuskan", function (c) { return { noRujukan: r.noRujukan, lulus: true, sebab: c }; }, false);
        });
        tambah("Tolak", "danger", function () {
          jalan("putuskan", function (c) { return { noRujukan: r.noRujukan, lulus: false, sebab: c }; }, true);
        });
        tambah("Pulangkan kepada penyemak", null, function () {
          jalan("pulangKePenyemak", function (c) { return { noRujukan: r.noRujukan, catatan: c }; }, true);
        });
      }
    }

    if (!wrap.childNodes.length) {
      wrap.appendChild(el("span", { class: "hint",
        text: "Tiada tindakan tersedia untuk peranan anda pada status ini." }));
    }
  }

  $("btn-csv").onclick = function () {
    var rows = ditapis();
    if (!rows.length) return papar($("msg-papan"), "err", "Tiada baris untuk dieksport.");
    var kepala = ["No. rujukan", "Status", "Murid", "No. KP", "Tahun", "Kelas",
      "Penjaga", "Telefon", "Hubungan", "Bil. isi rumah", "Pendapatan",
      "Per kapita", "eKasih", "Kali dipulangkan", "Tarikh hantar",
      "Tarikh keputusan", "Sebab tolak"];
    var data = rows.map(function (r) {
      return [r.noRujukan, UI.LABEL[r.status] || r.status, r.muridNama, r.muridIC,
        r.muridTahun, r.muridKelas || "", r.penjagaNama, r.penjagaTelefon,
        r.penjagaHubungan, r.bilIsiRumah, r.pendapatanIsiRumah,
        r.pendapatanPerKapita, r.eKasih ? "Ya" : "Tidak", r.kaliDipulangkan,
        UI.tarikh(r.tarikhHantar, true), UI.tarikh(r.tarikhKeputusan, true),
        r.sebabTolak || ""];
    });
    UI.muatTurunCsv("permohonan-rmt-" + new Date().toISOString().slice(0, 10) + ".csv",
      [kepala].concat(data));
    papar($("msg-papan"), "warn",
      "Fail CSV mengandungi data peribadi. Simpan dalam peranti sekolah sahaja dan padam selepas guna.");
  };

  if (RMT.sesi()) muat().catch(function () {});
})();
