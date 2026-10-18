/**
 * Lapisan API ke Apps Script. Tiada dependency luar, tiada CDN.
 *
 * Kenapa Content-Type: text/plain dan bukan application/json?
 * Apps Script tidak menjawab permintaan preflight OPTIONS. Menghantar
 * application/json akan mencetuskan preflight, dan permintaan itu gagal
 * dengan ralat CORS. text/plain kekal sebagai "simple request" — tiada
 * preflight. Badan permintaan tetap JSON; Apps Script menghuraikannya
 * daripada e.postData.contents.
 */
(function () {
  "use strict";

  var URL_EXEC = (window.RMT_CONFIG && window.RMT_CONFIG.APPS_SCRIPT_URL) || "";
  var SESI_KUNCI = "rmt_sesi";

  if (!URL_EXEC || URL_EXEC.indexOf("GANTIKAN") === 0) {
    console.error("APPS_SCRIPT_URL belum ditetapkan dalam docs/assets/config.js");
  }

  /* sessionStorage, bukan localStorage: token hilang bila tab ditutup,
     jadi tempoh pendedahannya lebih pendek. */
  function simpanSesi(s) { try { sessionStorage.setItem(SESI_KUNCI, JSON.stringify(s)); } catch (e) {} }
  function buangSesi()   { try { sessionStorage.removeItem(SESI_KUNCI); } catch (e) {} }
  function ambilSesi() {
    try {
      var raw = sessionStorage.getItem(SESI_KUNCI);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s.token || !s.tamatPada || new Date(s.tamatPada).getTime() < Date.now()) {
        buangSesi();
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  function hantar(badan) {
    if (!URL_EXEC || URL_EXEC.indexOf("GANTIKAN") === 0) {
      return Promise.reject(new Error(
        "Sistem belum disambungkan ke pangkalan data. Hubungi pihak sekolah."));
    }
    return fetch(URL_EXEC, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(badan),
      redirect: "follow"
    }).then(function (res) {
      return res.text().then(function (teks) {
        var j;
        try { j = JSON.parse(teks); }
        catch (e) {
          /* Apps Script memulangkan halaman HTML dengan status 200 bila
             deployment salah konfigurasi atau skrip gagal dimuatkan —
             senang disalah anggap sebagai kejayaan. */
          throw new Error("Pelayan memulangkan respons yang tidak dijangka. " +
            "Semak tetapan deployment Apps Script (Execute as: Me, " +
            "Who has access: Anyone).");
        }
        if (!j.ok) throw new Error(j.ralat || "Permintaan gagal.");
        return j.data;
      });
    }, function () {
      throw new Error("Tiada sambungan, atau pelayan tidak dapat dihubungi.");
    });
  }

  function awam(tindakan, data) {
    return hantar({ tindakan: tindakan, data: data || {} });
  }

  function staf(tindakan, data) {
    var s = ambilSesi();
    if (!s) return Promise.reject(new Error("Sesi tamat. Sila log masuk semula."));
    return hantar({ tindakan: tindakan, token: s.token, data: data || {} })
      .catch(function (e) {
        if (/Sesi tamat|tidak sah/.test(e.message)) buangSesi();
        throw e;
      });
  }

  function logMasuk(emel, katalaluan) {
    return hantar({ tindakan: "logMasuk", emel: emel, katalaluan: katalaluan })
      .then(function (d) { simpanSesi(d); return d; });
  }

  function logKeluar() {
    var s = ambilSesi();
    buangSesi();
    if (!s) return Promise.resolve();
    /* Batalkan di server juga, bukan sekadar buang dari browser. */
    return hantar({ tindakan: "logKeluar", token: s.token, data: {} }).catch(function () {});
  }

  window.RMT = { awam: awam, staf: staf, logMasuk: logMasuk, logKeluar: logKeluar, sesi: ambilSesi };
})();
