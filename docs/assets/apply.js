/* Muka surat awam: hantar, semak status, tarik balik, hantar semula. */
(function () {
  "use strict";
  var el = UI.el, papar = UI.papar, sorok = UI.sorok;
  var $ = function (id) { return document.getElementById(id); };

  function tukarTab(aktif) {
    [["tab-mohon", "pane-mohon"], ["tab-semak", "pane-semak"]].forEach(function (p) {
      var pilih = p[0] === aktif;
      $(p[0]).setAttribute("aria-selected", pilih ? "true" : "false");
      $(p[1]).hidden = !pilih;
    });
  }
  $("tab-mohon").onclick = function () { tukarTab("tab-mohon"); };
  $("tab-semak").onclick = function () { tukarTab("tab-semak"); };

  RMT.awam("senaraiSekolah").then(function (rows) {
    var sel = $("sekolah_id");
    sel.textContent = "";
    sel.appendChild(el("option", { value: "", text: rows.length ? "Pilih sekolah" : "Tiada sekolah didaftarkan" }));
    rows.forEach(function (s) {
      sel.appendChild(el("option", { value: s.kod, text: s.nama + " (" + s.kod + ")" }));
    });
  }).catch(function (e) {
    papar($("msg-mohon"), "err", "Gagal memuatkan senarai sekolah: " + e.message);
  });

  function kiraPerKapita() {
    var b = Number($("bil_isi_rumah").value), p = Number($("pendapatan_isi_rumah").value);
    $("perkapita").textContent = (b > 0 && p >= 0)
      ? "Pendapatan per kapita: " + UI.rm(p / b) + " sebulan" : "";
  }
  $("bil_isi_rumah").oninput = kiraPerKapita;
  $("pendapatan_isi_rumah").oninput = kiraPerKapita;

  $("ekasih").onchange = function () {
    $("lbl-ekasih").hidden = !this.checked;
    if (!this.checked) $("no_ekasih").value = "";
  };

  function icBersih(v) { return String(v || "").replace(/\D/g, ""); }

  $("borang").onsubmit = function (ev) {
    ev.preventDefault();
    var m = $("msg-mohon");
    sorok(m);

    /* Semakan di sini untuk UX sahaja — Apps Script mengesahkan semula
       semuanya, kerana sesiapa boleh POST terus ke endpoint itu. */
    var ic = icBersih($("murid_ic").value);
    if (ic.length !== 12) return papar(m, "err", "No. Kad Pengenalan murid mesti 12 angka.");
    if (!$("sekolah_id").value) return papar(m, "err", "Pilih sekolah.");
    if (!$("murid_tahun").value) return papar(m, "err", "Pilih tahun murid.");
    if (!$("penjaga_hubungan").value) return papar(m, "err", "Pilih hubungan dengan murid.");
    if (!$("akuan_benar").checked || !$("persetujuan_pdpa").checked) {
      return papar(m, "err", "Tanda kedua-dua akuan sebelum menghantar.");
    }

    var btn = $("btn-hantar");
    btn.disabled = true;
    papar(m, "info", "Menghantar…");

    RMT.awam("hantar", {
      sekolahKod: $("sekolah_id").value,
      muridNama: $("murid_nama").value,
      muridIC: ic,
      muridTahun: Number($("murid_tahun").value),
      muridKelas: $("murid_kelas").value,
      penjagaNama: $("penjaga_nama").value,
      penjagaTelefon: $("penjaga_telefon").value,
      penjagaHubungan: $("penjaga_hubungan").value,
      bilIsiRumah: Number($("bil_isi_rumah").value),
      pendapatanIsiRumah: Number($("pendapatan_isi_rumah").value),
      eKasih: $("ekasih").checked,
      noEKasih: $("no_ekasih").value,
      akuanBenar: true,
      persetujuanPdpa: true
    }).then(function (res) {
      sorok(m);
      $("borang").hidden = true;
      $("siap").hidden = false;
      $("ref-baru").textContent = res.noRujukan;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(function (e) {
      papar(m, "err", e.message);
    }).then(function () { btn.disabled = false; });
  };

  $("btn-salin").onclick = function () {
    var t = $("ref-baru").textContent, btn = this;
    var selesai = function () {
      btn.textContent = "Disalin";
      setTimeout(function () { btn.textContent = "Salin nombor rujukan"; }, 2000);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(selesai, function () {});
    else selesai();
  };
  $("btn-baru").onclick = function () {
    $("borang").reset();
    $("perkapita").textContent = "";
    $("lbl-ekasih").hidden = true;
    $("borang").hidden = false;
    $("siap").hidden = true;
  };

  /* ---------- Semak status ---------- */
  var semasa = null;

  $("borang-semak").onsubmit = function (ev) {
    ev.preventDefault();
    var m = $("msg-semak");
    papar(m, "info", "Menyemak…");
    $("hasil").hidden = true;
    $("borang-betul").hidden = true;

    var ruj = $("s_ruj").value.trim().toUpperCase();
    var ic = icBersih($("s_ic").value);

    /* Kegagalan padanan dipulangkan sebagai data ({ralat}), bukan ralat
       HTTP, supaya kaunter had percubaan di server tidak terbatal. */
    RMT.awam("semakStatus", { noRujukan: ruj, muridIC: ic }).then(function (d) {
      if (d && d.ralat) return papar(m, "err", d.ralat);
      sorok(m);
      semasa = { ruj: ruj, ic: ic, data: d };
      lukisHasil(d);
    }).catch(function (e) { papar(m, "err", e.message); });
  };

  function lukisHasil(d) {
    $("hasil").hidden = false;
    var b = $("h-badge");
    b.textContent = "";
    b.appendChild(UI.lencana(d.status));

    var kv = $("h-kv");
    kv.textContent = "";
    [["No. rujukan", d.noRujukan],
     ["Murid", d.muridNama],
     ["Sekolah", d.sekolah],
     ["Tarikh hantar", UI.tarikh(d.tarikhHantar, true)],
     ["Tarikh keputusan", d.tarikhKeputusan ? UI.tarikh(d.tarikhKeputusan, true) : "—"]
    ].forEach(function (p) {
      kv.appendChild(el("dt", { text: p[0] }));
      kv.appendChild(el("dd", { text: p[1] == null ? "—" : String(p[1]) }));
    });

    var betulkan = $("h-betulkan");
    if (d.status === "DIPULANGKAN") {
      betulkan.hidden = false;
      betulkan.textContent = "Perlu dibetulkan: " + (d.perluBetulkan || "—") +
        (d.tamatTempohBetul ? " — hantar semula sebelum " + UI.tarikh(d.tamatTempohBetul) + "." : "");
    } else { betulkan.hidden = true; }

    var tolak = $("h-tolak");
    if (d.status === "TOLAK") {
      tolak.hidden = false;
      tolak.textContent = "Sebab tolak: " + (d.sebabTolak || "—");
    } else { tolak.hidden = true; }

    $("btn-betul").hidden = d.status !== "DIPULANGKAN";
    $("btn-tarik").hidden = ["DIHANTAR", "DALAM_SEMAKAN", "DIPULANGKAN"].indexOf(d.status) < 0;
  }

  $("btn-betul").onclick = function () {
    $("borang-betul").hidden = false;
    $("borang-betul").scrollIntoView({ behavior: "smooth" });
  };

  $("borang-betul").onsubmit = function (ev) {
    ev.preventDefault();
    var m = $("msg-betul");
    if (!semasa) return papar(m, "err", "Semak status semula dahulu.");
    papar(m, "info", "Menghantar…");

    var perubahan = {};
    var bawa = function (kunci, id, nombor) {
      var v = $(id).value.trim();
      if (v !== "") perubahan[kunci] = nombor ? Number(v) : v;
    };
    bawa("muridNama", "b_murid_nama");
    bawa("muridTahun", "b_murid_tahun", true);
    bawa("penjagaNama", "b_penjaga_nama");
    bawa("penjagaTelefon", "b_penjaga_telefon");
    bawa("bilIsiRumah", "b_bil_isi_rumah", true);
    bawa("pendapatanIsiRumah", "b_pendapatan", true);
    bawa("noEKasih", "b_no_ekasih");

    if (!Object.keys(perubahan).length) return papar(m, "err", "Tiada perubahan diisi.");

    RMT.awam("hantarSemula", { noRujukan: semasa.ruj, muridIC: semasa.ic, perubahan: perubahan })
      .then(function (res) {
        if (res && res.ralat) { papar(m, "err", res.ralat); return null; }
        papar(m, "ok", "Permohonan dihantar semula. Status kembali kepada Dihantar.");
        $("borang-betul").reset();
        return RMT.awam("semakStatus", { noRujukan: semasa.ruj, muridIC: semasa.ic });
      })
      .then(function (d2) {
        if (d2 && !d2.ralat) { semasa.data = d2; lukisHasil(d2); $("borang-betul").hidden = true; }
      })
      .catch(function (e) { papar(m, "err", e.message); });
  };

  $("btn-tarik").onclick = function () {
    if (!semasa) return;
    if (!window.confirm("Tarik balik permohonan " + semasa.ruj +
        "? Tindakan ini tidak boleh dibatalkan.")) return;
    var m = $("msg-semak");
    RMT.awam("tarikBalik", { noRujukan: semasa.ruj, muridIC: semasa.ic })
      .then(function (res) {
        if (res && res.ralat) return papar(m, "err", res.ralat);
        semasa.data.status = "DITARIK_BALIK";
        lukisHasil(semasa.data);
        papar(m, "ok", "Permohonan telah ditarik balik.");
      })
      .catch(function (e) { papar(m, "err", e.message); });
  };
})();
