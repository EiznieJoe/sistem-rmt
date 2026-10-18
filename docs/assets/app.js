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
    $("siapa").textContent = d.nama + " \u00b7 " + d.peranan;
    $("siapa").hidden = false;
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
    var tb0 = $("jadual-kelas");
    tb0.textContent = "";
    tb0.appendChild(el("tr", null, [el("td", { colspan: "6" }, [
      el("div", { class: "rangka" }, [el("i"), el("i"), el("i")])])]));

    RMT.panggil("ringkasan").then(function (d) {
      var r = d.ringkasan;
      var dinilai = r.kira.LAYAK + r.kira.TIDAK_LAYAK + r.kira.PERLU_SEMAK;

      /* Satu angka hero sahaja — yang penyelaras datang untuk lihat. */
      if (r.pgk === null) {
        $("hero-nilai").textContent = "\u2014";
        $("hero-unit").textContent = "PGK belum ditetapkan";
        $("hero-kecil").textContent =
          "Tiada murid boleh ditanda layak sehingga had PGK diisi di bawah.";
        $("hero-wang").textContent = "";
      } else {
        $("hero-nilai").textContent = UI.nombor(r.kira.LAYAK);
        $("hero-unit").textContent = "murid layak menerima RMT";
        $("hero-kecil").textContent = "daripada " + UI.nombor(dinilai) +
          " murid Tahun 1\u20136 \u00b7 had PGK " + UI.rm(r.pgk) +
          (r.pgkPerKapita ? " \u00b7 per kapita " + UI.rm(r.pgkPerKapita) : "");
        $("hero-wang").textContent = "";
        $("hero-wang").appendChild(document.createTextNode("Anggaran peruntukan "));
        $("hero-wang").appendChild(el("b", { text: UI.rm(r.anggaranPeruntukan) }));
        $("hero-wang").appendChild(document.createTextNode(" \u00b7 " +
          UI.rm(r.kadarSehari) + " sehari \u00d7 " + r.hariPersekolahan + " hari"));
      }

      var jalur = $("jalur");
      jalur.textContent = "";
      [["Tidak layak", UI.nombor(r.kira.TIDAK_LAYAK), false],
       ["Perlu semak", UI.nombor(r.kira.PERLU_SEMAK), r.kira.PERLU_SEMAK > 0],
       ["Belum disahkan", UI.nombor(r.belumDisahkan), false]
      ].forEach(function (t) {
        jalur.appendChild(el("div", null, [
          el("div", { class: "label" }, (t[2] ? [UI.ikon("warning")] : []).concat([t[0]])),
          el("div", { class: "angka" + (t[2] ? " amaran" : ""), text: t[1] })
        ]));
      });

      /* Kemajuan pengesahan — kerja ini sebenarnya satu pungutan. */
      var sah = dinilai - r.belumDisahkan;
      var peratus = dinilai ? Math.round((sah / dinilai) * 100) : 0;
      $("kemajuan-teks").textContent = "";
      $("kemajuan-teks").appendChild(el("b",
        { text: UI.nombor(sah) + " / " + UI.nombor(dinilai) }));
      $("kemajuan-teks").appendChild(document.createTextNode(" \u00b7 " + peratus + "%"));
      $("kemajuan-bar").style.width = peratus + "%";

      $("nota-formula").textContent = r.formula;

      var tb = $("jadual-kelas");
      tb.textContent = "";
      $("kira-kelas").textContent = d.ikutKelas.length + " kelas";
      d.ikutKelas.forEach(function (k) {
        tb.appendChild(el("tr", null, [
          el("td", { text: k.kelasId }),
          el("td", { class: "num", "data-label": "Murid", text: UI.nombor(k.jumlah) }),
          el("td", { class: "num", "data-label": "Layak", text: UI.nombor(k.LAYAK) }),
          el("td", { class: "num", "data-label": "Perlu semak",
            text: k.PERLU_SEMAK ? UI.nombor(k.PERLU_SEMAK) : "\u2014" }),
          el("td", { class: "num", "data-label": "Disahkan",
            text: UI.nombor(k.jumlah - k.belumDisahkan) + " / " + UI.nombor(k.jumlah) }),
          el("td", { class: "lajur-sembunyi", "data-label": "Guru", text: k.guru })
        ]));
      });
      if (!d.ikutKelas.length) {
        tb.appendChild(el("tr", null, [el("td", { colspan: "6", class: "kosong",
          text: "Tiada kelas lagi. Import data iDME dahulu." })]));
      }

      var aw = $("amaran-guru");
      if (d.kelasTanpaGuru.length) {
        aw.hidden = false;
        aw.textContent = d.kelasTanpaGuru.length + " kelas belum ada akaun guru: " +
          d.kelasTanpaGuru.map(function (k) { return k.kelasId; }).join(", ") +
          " \u2014 pentadbir sistem perlu daftarkan dan tugaskan.";
      } else { aw.hidden = true; }

      var fk = $("f-kelas");
      fk.textContent = "";
      fk.appendChild(el("option", { value: "", text: "Semua" }));
      d.ikutKelas.forEach(function (k) {
        fk.appendChild(el("option", { value: k.kelasId, text: k.kelasId }));
      });

      muatTetapan();
      papar($("msg-senarai"), "info",
        "Pilih tapisan di atas, kemudian tekan Papar.");
    }).catch(function (e) {
      var tb = $("jadual-kelas");
      tb.textContent = "";
      tb.appendChild(el("tr", null, [
        el("td", { colspan: "6", class: "kosong", text: e.message })]));
    });
  }

  function muatTetapan() {
    RMT.panggil("tetapan").then(function (d) {
      var wrap = $("senarai-tetapan");
      wrap.textContent = "";
      d.tetapan.forEach(function (t) {
        var input = el("input", { id: "t-" + t.kunci, value: t.nilai });
        var btn = el("button", { type: "button", class: "kecil", text: "Simpan" });
        btn.onclick = function () {
          papar($("msg-tetapan"), "info", "Menyimpan\u2026");
          RMT.panggil("ubahTetapan", { kunci: t.kunci, nilai: input.value })
            .then(function () {
              papar($("msg-tetapan"), "ok",
                UI.namaTetapan(t.kunci) + " dikemas kini. Mengira semula\u2026");
              muatRingkasan();
            })
            .catch(function (e) { papar($("msg-tetapan"), "err", e.message); });
        };
        wrap.appendChild(el("div", { class: "tetapan-baris" }, [
          el("div", { class: "tetapan-label" }, [
            el("label", { for: "t-" + t.kunci, text: UI.namaTetapan(t.kunci) }),
            t.nota ? el("span", { class: "nota", text: t.nota }) : null
          ]),
          el("div", { class: "tetapan-kawal" }, [input, btn])
        ]));
      });
    }).catch(function (e) { papar($("msg-tetapan"), "err", e.message); });
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
          el("td", null, [m.nama, el("span", { class: "sub", text: m.kelasId })]),
          el("td", { class: "lajur-sembunyi", text: m.kelasId }),
          el("td", { class: "num" }, [
            m.pir === null ? "\u2014" : UI.rm(m.pir),
            m.perKapita == null ? null
              : el("span", { class: "sub", text: "pk " + UI.rm(m.perKapita) })
          ]),
          el("td", null, [UI.lencana(m.kelayakan),
            m.laluan ? el("span", { class: "sub", text: m.laluan }) : null]),
          el("td", { class: "lajur-sembunyi", text: m.sebab })
        ]));
      });
      if (!d.murid.length) {
        tb.appendChild(el("tr", null, [el("td", { colspan: "5", class: "kosong",
          text: "Tiada murid padan dengan tapisan ini." })]));
      }
      if (d.murid.length > 500) {
        papar($("msg-senarai"), "warn", d.jumlah + " murid padan; 500 pertama dipapar. " +
          "Guna eksport CSV untuk senarai penuh.");
      }
    }).catch(function (e) { papar($("msg-senarai"), "err", e.message); });
  };

  $("btn-csv").onclick = function () {
    if (!senaraiSemasa.length) return papar($("msg-senarai"), "err", "Papar senarai dahulu.");
    var kepala = ["Nama", "No. Pengenalan", "Jenis Pengenalan", "Tahun", "Kelas",
      "Pendapatan Penjaga 1", "Pendapatan Penjaga 2", "PIR", "Tanggungan", "Per kapita",
      "Kelayakan", "Laluan (SPK 1/2026)", "Sebab", "Disahkan oleh"];
    UI.muatTurunCsv("senarai-rmt-" + new Date().toISOString().slice(0, 10) + ".csv",
      [kepala].concat(senaraiSemasa.map(function (m) {
        return [m.nama, m.noPengenalan, m.jenisPengenalan, m.tahun, m.namaKelas,
          m.pendapatanPenjaga1, m.pendapatanPenjaga2, m.pir, m.tanggungan, m.perKapita,
          UI.LABEL[m.kelayakan] || m.kelayakan, m.laluan, m.sebab, m.disahkanOleh];
      })));
    papar($("msg-senarai"), "warn",
      "Fail CSV mengandungi data peribadi murid. Simpan dalam peranti sekolah sahaja.");
  };

  /* =================== GURU KELAS =================== */
  function muatKelasSaya() {
    RMT.panggil("kelasSaya").then(function (d) {
      kelasSaya = d.kelas;
      if (!d.kelas.length) {
        papar($("msg-guru"), "warn",
          "Tiada kelas ditugaskan kepada anda. Hubungi pentadbir sistem.");
        return;
      }
      sorok($("msg-guru"));

      /* Guru biasanya pegang satu kelas. Jadual satu baris membazir ruang —
         guna cip, dan sembunyikan terus kalau hanya ada satu. */
      var cip = $("pilih-kelas");
      cip.textContent = "";
      cip.hidden = d.kelas.length < 2;
      if (d.kelas.length > 1) {
        d.kelas.forEach(function (k) {
          var b = el("button", { type: "button", text: k.kelasId,
                                 "aria-pressed": "false" });
          b.onclick = function () { bukaKelas(k.kelasId); };
          cip.appendChild(b);
        });
      }
      bukaKelas(d.kelas[0].kelasId);
    }).catch(function (e) { papar($("msg-guru"), "err", e.message); });
  }

  function bukaKelas(kelasId) {
    $("kad-murid").hidden = false;
    $("kad-edit").hidden = true;
    papar($("msg-kelas"), "info", "Memuatkan\u2026");

    Array.prototype.forEach.call($("pilih-kelas").children, function (b) {
      b.setAttribute("aria-pressed", b.textContent === kelasId ? "true" : "false");
    });

    RMT.panggil("senaraiMurid", { kelasId: kelasId }).then(function (d) {
      kelasAktif = d.kelas;
      muridKelas = d.murid;
      sorok($("msg-kelas"));
      $("tajuk-kelas").textContent = d.kelas.kelasId;
      $("kira-murid").textContent = d.murid.length + " murid";
      $("formula-guru").textContent = d.konteks.formula;
      lukisRingkas();
      lukisMurid();
    }).catch(function (e) { papar($("msg-kelas"), "err", e.message); });
  }

  /* Jalur ringkas: apa yang guru perlu tahu sebelum mula. */
  function lukisRingkas() {
    var k = { LAYAK: 0, TIDAK_LAYAK: 0, PERLU_SEMAK: 0 }, belum = 0;
    muridKelas.forEach(function (m) {
      if (k[m.kelayakan] !== undefined) k[m.kelayakan]++;
      if (!m.disahkan) belum++;
    });
    var wrap = $("ringkas-kelas");
    wrap.textContent = "";
    [[k.LAYAK, "layak", "baik"],
     [k.TIDAK_LAYAK, "tidak layak", ""],
     [k.PERLU_SEMAK, "perlu semak", k.PERLU_SEMAK ? "amaran" : ""],
     [belum, "belum disahkan", ""]
    ].forEach(function (t) {
      wrap.appendChild(el("div", null, [
        el("span", { class: "n " + (t[2] || ""), text: UI.nombor(t[0]) }),
        el("span", { class: "t", text: t[1] })
      ]));
    });
  }

  function ditapisMurid() {
    var f = $("f-murid").value;
    if (!f) return muridKelas;
    if (f === "BELUM_SAH") return muridKelas.filter(function (m) { return !m.disahkan; });
    return muridKelas.filter(function (m) { return m.kelayakan === f; });
  }

  $("f-murid").onchange = function () { lukisMurid(); };

  function lukisMurid() {
    var rows = ditapisMurid();
    var tb = $("jadual-murid-guru");
    tb.textContent = "";

    if (!rows.length) {
      tb.appendChild(el("tr", null, [el("td", { colspan: "6", class: "kosong",
        text: $("f-murid").value
          ? "Tiada murid dalam tapisan ini. Bagus \u2014 tiada kerja tertunggak."
          : "Tiada murid dalam kelas ini." })]));
      return;
    }

    rows.forEach(function (m) {
      var tr = el("tr", { class: "klik", tabindex: "0" }, [
        el("td", { class: "utama-sel" }, [m.nama, m.medanDiubah.length
          ? el("span", { class: "diubah", text: "diubah: " +
              m.medanDiubah.map(UI.namaMedan).join(", ") })
          : null]),
        el("td", { class: "num lajur-sembunyi", "data-label": "Penjaga 1",
          text: m.pendapatanPenjaga1 === null ? "\u2014" : UI.rm(m.pendapatanPenjaga1) }),
        el("td", { class: "num lajur-sembunyi", "data-label": "Penjaga 2",
          text: m.pendapatanPenjaga2 === null ? "\u2014" : UI.rm(m.pendapatanPenjaga2) }),
        el("td", { class: "num", "data-label": "PIR" }, [
          m.pir === null ? "\u2014" : UI.rm(m.pir),
          m.perKapita == null ? null
            : el("span", { class: "sub", text: "pk " + UI.rm(m.perKapita) })
        ]),
        el("td", { "data-label": "Kelayakan" }, [UI.lencana(m.kelayakan)]),
        el("td", { class: "sah", "data-label": "Sah" }, [m.disahkan
          ? el("span", { class: "tanda ok", title: "Disahkan", text: "\u2713" })
          : el("span", { class: "tanda", title: "Belum disahkan", text: "\u2013" })])
      ]);
      tr.onclick = function () { bukaMurid(m); };
      tr.onkeydown = function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); bukaMurid(m); }
      };
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
     ["PIR semasa", m.pir === null ? "\u2014" : UI.rm(m.pir)],
     ["Tanggungan", m.tanggungan == null ? "\u2014" : String(m.tanggungan)],
     ["Per kapita", m.perKapita == null
        ? "\u2014 (tidak dirujuk \u2014 PIR sudah lulus, atau had belum ditetapkan)"
        : UI.rm(m.perKapita)],
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
