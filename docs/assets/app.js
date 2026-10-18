/* Aplikasi. Paparan ikut peranan, tetapi itu UX sahaja — Apps Script
   mengesahkan token dan peranan pada setiap tindakan. */
(function () {
  "use strict";
  var el = UI.el, papar = UI.papar, sorok = UI.sorok;
  var $ = function (id) { return document.getElementById(id); };

  var saya = null, kelasSaya = [], muridKelas = [], kelasAktif = null, muridAktif = null;

  /* ---------- Log masuk ---------- */
  $("borang-masuk").onsubmit = function (ev) {
    ev.preventDefault();
    var m = $("msg-masuk");
    papar(m, "info", "Log masuk…");
    $("btn-masuk").disabled = true;
    RMT.logMasuk($("emel").value.trim(), $("katalaluan").value)
      .then(function (d) { sorok(m); mula(d); })
      .catch(function (e) { papar(m, "err", e.message); })
      .then(function () { $("btn-masuk").disabled = false; $("katalaluan").value = ""; });
  };
  $("btn-keluar").onclick = function () { RMT.logKeluar().then(function () { location.reload(); }); };

  /* ---------- Lupa kata laluan (tanpa log masuk) ---------- */
  function papar2(id) {
    ["borang-masuk", "pane-lupa"].forEach(function (x) { $(x).hidden = x !== id; });
    sorok($("msg-lupa")); sorok($("msg-masuk"));
  }
  $("pautan-lupa").onclick = function (e) {
    e.preventDefault();
    $("lupa-emel").value = $("emel").value.trim();
    $("lupa-langkah2").hidden = true;
    $("lupa-langkah1").hidden = false;
    papar2("pane-lupa");
  };
  $("pautan-balik-masuk").onclick = function (e) { e.preventDefault(); papar2("borang-masuk"); };

  function mintaKod() {
    var emel = $("lupa-emel").value.trim();
    if (!emel) return papar($("msg-lupa"), "err", "Masukkan emel anda.");
    papar($("msg-lupa"), "info", "Menghantar\u2026");
    RMT.awam("mintaResetKod", { emel: emel })
      .then(function (d) {
        /* Mesej sengaja sama sama ada emel itu wujud atau tidak — endpoint
           ini tidak boleh dipakai untuk menyenaraikan akaun yang wujud. */
        papar($("msg-lupa"), "ok", d.mesej);
        $("lupa-langkah1").hidden = true;
        $("lupa-langkah2").hidden = false;
      })
      .catch(function (e) { papar($("msg-lupa"), "err", e.message); });
  }
  $("btn-minta-kod").onclick = mintaKod;
  $("pautan-minta-semula").onclick = function (e) { e.preventDefault(); mintaKod(); };

  $("btn-sah-kod").onclick = function () {
    var emel = $("lupa-emel").value.trim();
    var kod = $("lupa-kod").value.replace(/\D/g, "");
    var baru = $("lupa-baru").value;
    if (kod.length !== 6) return papar($("msg-lupa"), "err", "Kod mesti 6 angka.");
    if (baru.length < 10) return papar($("msg-lupa"), "err", "Kata laluan baharu minimum 10 aksara.");
    papar($("msg-lupa"), "info", "Memproses\u2026");
    RMT.awam("sahkanResetKod", { emel: emel, kod: kod, kataLaluanBaru: baru })
      .then(function (d) {
        papar($("msg-masuk"), "ok", d.mesej);
        $("emel").value = emel;
        $("katalaluan").value = "";
        $("lupa-kod").value = ""; $("lupa-baru").value = "";
        papar2("borang-masuk");
      })
      .catch(function (e) { papar($("msg-lupa"), "err", e.message); });
  };

  /* ---------- Tukar kata laluan (sudah log masuk) ---------- */
  $("btn-tukar-kl").onclick = function () {
    $("pane-tukar").hidden = false;
    $("tk-lama").value = ""; $("tk-baru").value = "";
    sorok($("msg-tukar"));
    $("pane-tukar").scrollIntoView({ behavior: "smooth" });
  };
  $("btn-batal-kl").onclick = function () { $("pane-tukar").hidden = true; };
  $("btn-simpan-kl").onclick = function () {
    var lama = $("tk-lama").value, baru = $("tk-baru").value;
    if (baru.length < 10) return papar($("msg-tukar"), "err", "Kata laluan baharu minimum 10 aksara.");
    papar($("msg-tukar"), "info", "Memproses\u2026");
    RMT.panggil("tukarKataLaluan", { kataLaluanLama: lama, kataLaluanBaru: baru })
      .then(function (d) {
        /* Tukar kata laluan membatalkan semua sesi, termasuk yang ini. */
        alert(d.mesej);
        location.reload();
      })
      .catch(function (e) { papar($("msg-tukar"), "err", e.message); });
  };

  function mula(d) {
    saya = d;
    $("borang-masuk").hidden = true;
    $("pane-lupa").hidden = true;
    $("btn-keluar").hidden = false;
    $("btn-tukar-kl").hidden = false;
    $("subtajuk").textContent = d.nama + " — " + d.peranan;
    if (d.peranan === "penyelaras" || d.peranan === "admin") {
      $("pane-selaras").hidden = false;
      muatRingkasan();
    } else {
      $("pane-guru").hidden = false;
      muatKelasSaya();
    }
  }

  /* =================== PENYELARAS =================== */
  function muatRingkasan() {
    RMT.panggil("ringkasan").then(function (d) {
      var r = d.ringkasan;

      // Hero: satu angka sahaja per paparan.
      $("hero-nilai").textContent = UI.nombor(r.kira.LAYAK);
      $("hero-label").textContent = "murid layak menerima RMT, daripada " +
        UI.nombor(r.kira.LAYAK + r.kira.TIDAK_LAYAK + r.kira.PERLU_SEMAK) + " murid Tahun 1-6";
      $("hero-nota").textContent = r.formula +
        (r.pgk === null ? " PGK belum ditetapkan — tiada murid boleh ditanda layak." : "");

      var tiles = $("tiles");
      tiles.textContent = "";
      [["Tidak layak", UI.nombor(r.kira.TIDAK_LAYAK), "", null],
       ["Perlu semak oleh guru kelas", UI.nombor(r.kira.PERLU_SEMAK), "warning", "warning"],
       ["Belum disahkan guru", UI.nombor(r.belumDisahkan), "", null],
       ["Anggaran peruntukan", UI.rm(r.anggaranPeruntukan), "good", "good"]
      ].forEach(function (t) {
        tiles.appendChild(el("div", { class: "tile " + (t[2] || "") }, [
          el("div", { class: "label" }, (t[3] ? [UI.ikon(t[3])] : []).concat([t[0]])),
          el("div", { class: "nilai", text: t[1] })
        ]));
      });
      tiles.appendChild(el("div", { class: "tile" }, [
        el("div", { class: "label", text: "Kadar dan hari" }),
        el("div", { class: "nilai", text: UI.rm(r.kadarSehari) }),
        el("p", { class: "hint", text: "sehari × " + r.hariPersekolahan + " hari (perenggan 5.1)" })
      ]));

      var tb = $("jadual-kelas");
      tb.textContent = "";
      d.ikutKelas.forEach(function (k) {
        tb.appendChild(el("tr", null, [
          el("td", { text: k.kelasId }),
          el("td", { text: k.guru }),
          el("td", { class: "num", text: UI.nombor(k.jumlah) }),
          el("td", { class: "num", text: UI.nombor(k.LAYAK) }),
          el("td", { class: "num", text: UI.nombor(k.TIDAK_LAYAK) }),
          el("td", { class: "num", text: UI.nombor(k.PERLU_SEMAK) }),
          el("td", { class: "num", text: UI.nombor(k.belumDisahkan) })
        ]));
      });

      var aw = $("amaran-guru");
      if (d.kelasTanpaGuru.length) {
        aw.hidden = false;
        aw.textContent = d.kelasTanpaGuru.length + " kelas belum ada akaun guru: " +
          d.kelasTanpaGuru.map(function (k) {
            return k.kelasId + (k.guruNamaImport ? " (iDME: " + k.guruNamaImport + ")" : "");
          }).join("; ") +
          " — pentadbir sistem perlu daftarkan dan tugaskan.";
      } else { aw.hidden = true; }

      var fk = $("f-kelas");
      fk.textContent = "";
      fk.appendChild(el("option", { value: "", text: "Semua" }));
      d.ikutKelas.forEach(function (k) {
        fk.appendChild(el("option", { value: k.kelasId, text: k.kelasId }));
      });

      muatTetapan();
    }).catch(function (e) { papar($("msg-senarai"), "err", e.message); });
  }

  function muatTetapan() {
    RMT.panggil("tetapan").then(function (d) {
      var wrap = $("senarai-tetapan");
      wrap.textContent = "";
      d.tetapan.forEach(function (t) {
        var input = el("input", { id: "t-" + t.kunci, value: t.nilai });
        var btn = el("button", { type: "button", text: "Simpan" });
        btn.onclick = function () {
          papar($("msg-tetapan"), "info", "Menyimpan…");
          RMT.panggil("ubahTetapan", { kunci: t.kunci, nilai: input.value })
            .then(function () {
              papar($("msg-tetapan"), "ok", t.kunci + " dikemas kini. Mengira semula…");
              muatRingkasan();
            })
            .catch(function (e) { papar($("msg-tetapan"), "err", e.message); });
        };
        wrap.appendChild(el("div", { class: "filters" }, [
          el("label", null, [t.kunci, input]), btn
        ]));
        if (t.nota) wrap.appendChild(el("p", { class: "hint", text: t.nota }));
      });
    });
  }

  var senaraiSemasa = [];
  $("btn-muat-senarai").onclick = function () {
    papar($("msg-senarai"), "info", "Memuatkan…");
    RMT.panggil("senaraiPenuh", {
      kelayakan: $("f-kelayakan").value, kelasId: $("f-kelas").value
    }).then(function (d) {
      senaraiSemasa = d.murid;
      papar($("msg-senarai"), "info", d.jumlah + " murid dipaparkan. " + d.formula);
      var tb = $("jadual-murid");
      tb.textContent = "";
      d.murid.slice(0, 500).forEach(function (m) {
        tb.appendChild(el("tr", null, [
          el("td", { text: m.nama }),
          el("td", { text: m.kelasId }),
          el("td", { class: "num", text: m.pir === null ? "—" : UI.rm(m.pir) }),
          el("td", null, [UI.lencana(m.kelayakan)]),
          el("td", { text: m.laluan || "—" }),
          el("td", { text: m.sebab })
        ]));
      });
      if (d.murid.length > 500) {
        papar($("msg-senarai"), "warn", d.jumlah + " murid padan; 500 pertama dipapar. " +
          "Guna eksport CSV untuk senarai penuh.");
      }
    }).catch(function (e) { papar($("msg-senarai"), "err", e.message); });
  };

  $("btn-csv").onclick = function () {
    if (!senaraiSemasa.length) return papar($("msg-senarai"), "err", "Papar senarai dahulu.");
    var kepala = ["Nama", "No. Pengenalan", "Jenis Pengenalan", "Tahun", "Kelas",
      "Pendapatan Penjaga 1", "Pendapatan Penjaga 2", "PIR", "Tanggungan",
      "Kelayakan", "Laluan (SPK 1/2026)", "Sebab", "Disahkan oleh"];
    UI.muatTurunCsv("senarai-rmt-" + new Date().toISOString().slice(0, 10) + ".csv",
      [kepala].concat(senaraiSemasa.map(function (m) {
        return [m.nama, m.noPengenalan, m.jenisPengenalan, m.tahun, m.namaKelas,
          m.pendapatanPenjaga1, m.pendapatanPenjaga2, m.pir, m.tanggungan,
          UI.LABEL[m.kelayakan] || m.kelayakan, m.laluan, m.sebab, m.disahkanOleh];
      })));
    papar($("msg-senarai"), "warn",
      "Fail CSV mengandungi data peribadi murid. Simpan dalam peranti sekolah sahaja.");
  };

  /* =================== GURU KELAS =================== */
  function muatKelasSaya() {
    RMT.panggil("kelasSaya").then(function (d) {
      kelasSaya = d.kelas;
      var tb = $("jadual-kelas-guru");
      tb.textContent = "";
      if (!d.kelas.length) {
        papar($("msg-guru"), "warn",
          "Tiada kelas ditugaskan kepada anda. Hubungi pentadbir sistem.");
        return;
      }
      sorok($("msg-guru"));
      d.kelas.forEach(function (k) {
        var btn = el("button", { type: "button", text: "Buka" });
        btn.onclick = function () { bukaKelas(k.kelasId); };
        tb.appendChild(el("tr", null, [
          el("td", { text: k.kelasId }),
          el("td", { class: "num", text: UI.nombor(k.ringkasan.jumlah) }),
          el("td", { class: "num", text: UI.nombor(k.ringkasan.LAYAK) }),
          el("td", { class: "num", text: UI.nombor(k.ringkasan.PERLU_SEMAK) }),
          el("td", { class: "num", text: UI.nombor(k.ringkasan.belumDisahkan) }),
          el("td", null, [btn])
        ]));
      });
      if (d.kelas.length === 1) bukaKelas(d.kelas[0].kelasId);
    }).catch(function (e) { papar($("msg-guru"), "err", e.message); });
  }

  function bukaKelas(kelasId) {
    papar($("msg-kelas"), "info", "Memuatkan…");
    $("kad-murid").hidden = false;
    $("kad-edit").hidden = true;
    RMT.panggil("senaraiMurid", { kelasId: kelasId }).then(function (d) {
      kelasAktif = d.kelas;
      muridKelas = d.murid;
      sorok($("msg-kelas"));
      $("tajuk-kelas").textContent = d.kelas.kelasId;
      $("formula-guru").textContent = d.konteks.formula;
      lukisMurid();
    }).catch(function (e) { papar($("msg-kelas"), "err", e.message); });
  }

  function lukisMurid() {
    var tb = $("jadual-murid-guru");
    tb.textContent = "";
    muridKelas.forEach(function (m) {
      var tr = el("tr", { class: "boleh" }, [
        el("td", null, [m.nama, m.medanDiubah.length
          ? el("div", { class: "diubah", text: "diubah: " + m.medanDiubah.join(", ") }) : null]),
        el("td", { class: "num", text: m.pendapatanPenjaga1 === null ? "—" : UI.rm(m.pendapatanPenjaga1) }),
        el("td", { class: "num", text: m.pendapatanPenjaga2 === null ? "—" : UI.rm(m.pendapatanPenjaga2) }),
        el("td", { class: "num", text: m.pir === null ? "—" : UI.rm(m.pir) }),
        el("td", null, [UI.lencana(m.kelayakan)]),
        el("td", { text: m.disahkan ? "Ya" : "Belum" })
      ]);
      tr.onclick = function () { bukaMurid(m); };
      tb.appendChild(tr);
    });
  }

  $("btn-sahkan-kelas").onclick = function () {
    if (!kelasAktif) return;
    if (!window.confirm("Sahkan semua murid " + kelasAktif.kelasId +
        " yang datanya lengkap? Murid 'Perlu semak' tidak akan disahkan.")) return;
    RMT.panggil("sahkanKelas", { kelasId: kelasAktif.kelasId }).then(function (d) {
      papar($("msg-kelas"), "ok", d.disahkan + " murid disahkan. " + (d.nota || ""));
      bukaKelas(kelasAktif.kelasId);
    }).catch(function (e) { papar($("msg-kelas"), "err", e.message); });
  };

  function bukaMurid(m) {
    muridAktif = m;
    $("kad-edit").hidden = false;
    $("tajuk-edit").textContent = m.nama;
    sorok($("msg-edit"));

    var kv = $("kv-murid");
    kv.textContent = "";
    [["No. pengenalan", m.noPengenalan + " (" + m.jenisPengenalan + ")"],
     ["Kelas", m.kelasId],
     ["Penjaga", m.penjagaNama + (m.hubunganPenjaga ? " (" + m.hubunganPenjaga + ")" : "")],
     ["Telefon", m.penjagaTelefon || "—"],
     ["PIR semasa", m.pir === null ? "—" : UI.rm(m.pir)],
     ["Disahkan oleh", m.disahkanOleh || "—"]
    ].forEach(function (p) {
      kv.appendChild(el("dt", { text: p[0] }));
      kv.appendChild(el("dd", { text: String(p[1]) }));
    });

    var mk = $("msg-kelayakan");
    mk.hidden = false;
    mk.className = "msg " + (m.kelayakan === "LAYAK" ? "ok"
      : m.kelayakan === "PERLU_SEMAK" ? "warn" : "info");
    mk.textContent = (UI.LABEL[m.kelayakan] || m.kelayakan) +
      (m.laluan ? " melalui perenggan " + m.laluan : "") + " — " + m.sebab;

    $("e-p1").value = m.pendapatanPenjaga1 === null ? "" : m.pendapatanPenjaga1;
    $("e-p2").value = m.pendapatanPenjaga2 === null ? "" : m.pendapatanPenjaga2;
    $("e-tanggungan").value = m.tanggungan === null ? "" : m.tanggungan;
    $("e-warganegara").value = m.warganegara === "WARGANEGARA" ||
      m.warganegara === "BUKAN WARGANEGARA" ? m.warganegara : "";
    $("e-asrama").value = m.statusAsrama ? "YA" : "";
    $("e-oku").value = m.statusOku ? "YA" : "";
    $("e-catatan").value = m.catatanGuru || "";
    $("btn-sahkan").textContent = m.disahkan ? "Batalkan pengesahan" : "Tandakan disahkan";

    var ol = $("jejak");
    ol.textContent = "";
    RMT.panggil("audit", { idMurid: m.idMurid }).then(function (d) {
      if (!d.audit.length) { ol.appendChild(el("li", { text: "Tiada rekod." })); return; }
      d.audit.forEach(function (a) {
        ol.appendChild(el("li", null, [
          el("time", { text: UI.tarikh(a.masa, true) }),
          el("span", { text: a.tindakan + " oleh " + a.pelaku +
            (a.sebab ? " — " + a.sebab : "") + (a.perubahan ? " " + a.perubahan : "") })
        ]));
      });
    }).catch(function () {});
    $("kad-edit").scrollIntoView({ behavior: "smooth" });
  }

  $("btn-simpan").onclick = function () {
    if (!muridAktif) return;
    var p = {};
    var angka = function (medan, id) {
      var v = $(id).value.trim();
      p[medan] = v === "" ? "" : Number(v);
    };
    angka("PendapatanPenjaga1", "e-p1");
    angka("PendapatanPenjaga2", "e-p2");
    angka("Tanggungan", "e-tanggungan");
    if ($("e-warganegara").value) p.Warganegara = $("e-warganegara").value;
    p.StatusAsrama = $("e-asrama").value;
    p.StatusOku = $("e-oku").value;

    papar($("msg-edit"), "info", "Menyimpan…");
    RMT.panggil("kemasMurid", { idMurid: muridAktif.idMurid, perubahan: p,
                                catatan: $("e-catatan").value })
      .then(function (d) {
        if (d.ralat) return papar($("msg-edit"), "warn", d.ralat);
        papar($("msg-edit"), "ok", "Disimpan. Kelayakan: " +
          (UI.LABEL[d.murid.kelayakan] || d.murid.kelayakan) + ".");
        bukaKelas(kelasAktif.kelasId);
        bukaMurid(d.murid);
      })
      .catch(function (e) { papar($("msg-edit"), "err", e.message); });
  };

  $("btn-sahkan").onclick = function () {
    if (!muridAktif) return;
    RMT.panggil("sahkanMurid", { idMurid: muridAktif.idMurid, sahkan: !muridAktif.disahkan })
      .then(function () {
        papar($("msg-edit"), "ok", "Dikemas kini.");
        var id = muridAktif.idMurid;
        RMT.panggil("senaraiMurid", { kelasId: kelasAktif.kelasId }).then(function (d) {
          muridKelas = d.murid;
          lukisMurid();
          var segar = d.murid.filter(function (x) { return x.idMurid === id; })[0];
          if (segar) bukaMurid(segar);
        });
      })
      .catch(function (e) { papar($("msg-edit"), "err", e.message); });
  };

  $("btn-tutup").onclick = function () { $("kad-edit").hidden = true; muridAktif = null; };

  /* Sambung sesi yang masih hidup */
  var s = RMT.sesi();
  if (s) mula(s);
})();
