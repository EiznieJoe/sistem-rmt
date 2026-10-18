/**
 * Lapisan API ke Apps Script. Tiada dependency luar, tiada CDN.
 *
 * Content-Type text/plain, bukan application/json: Apps Script tidak
 * menjawab permintaan preflight OPTIONS, jadi application/json akan gagal
 * dengan ralat CORS. text/plain kekal "simple request". Badan tetap JSON.
 */
(function () {
  "use strict";
  var URL_EXEC = (window.RMT_CONFIG && window.RMT_CONFIG.APPS_SCRIPT_URL) || "";
  var KUNCI = "rmt_sesi";
  var belumDisiapkan = !URL_EXEC || URL_EXEC.indexOf("GANTIKAN") === 0;
  if (belumDisiapkan) console.error("APPS_SCRIPT_URL belum ditetapkan dalam docs/assets/config.js");

  /* sessionStorage, bukan localStorage: token hilang bila tab ditutup. */
  function simpan(s) { try { sessionStorage.setItem(KUNCI, JSON.stringify(s)); } catch (e) {} }
  function buang()  { try { sessionStorage.removeItem(KUNCI); } catch (e) {} }
  function ambil() {
    try {
      var raw = sessionStorage.getItem(KUNCI);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s.token || !s.tamatPada || new Date(s.tamatPada).getTime() < Date.now()) { buang(); return null; }
      return s;
    } catch (e) { return null; }
  }

  function hantar(badan) {
    if (belumDisiapkan) {
      return Promise.reject(new Error(
        "Sistem belum disambungkan ke pangkalan data. Hubungi pentadbir sistem."));
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
          /* Apps Script memulangkan HTML dengan status 200 bila deployment
             salah konfigurasi — senang disalah anggap sebagai kejayaan. */
          throw new Error("Pelayan memulangkan respons yang tidak dijangka. " +
            "Semak tetapan deployment Apps Script (Execute as: Me, Who has access: Anyone).");
        }
        if (!j.ok) throw new Error(j.ralat || "Permintaan gagal.");
        return j.data;
      });
    }, function () {
      throw new Error("Tiada sambungan, atau pelayan tidak dapat dihubungi.");
    });
  }

  function panggil(tindakan, data) {
    var s = ambil();
    if (!s) return Promise.reject(new Error("Sesi tamat. Sila log masuk semula."));
    return hantar({ tindakan: tindakan, token: s.token, data: data || {} })
      .catch(function (e) {
        if (/Sesi tamat|tidak sah/.test(e.message)) buang();
        throw e;
      });
  }

  /* Tindakan awam — tiada token. Hanya reset kata laluan. */
  function awam(tindakan, data) {
    return hantar({ tindakan: tindakan, data: data || {} });
  }

  function logMasuk(emel, katalaluan) {
    return hantar({ tindakan: "logMasuk", emel: emel, katalaluan: katalaluan })
      .then(function (d) { simpan(d); return d; });
  }

  function logKeluar() {
    var s = ambil();
    buang();
    if (!s) return Promise.resolve();
    return hantar({ tindakan: "logKeluar", token: s.token, data: {} }).catch(function () {});
  }

  window.RMT = { panggil: panggil, awam: awam, logMasuk: logMasuk, logKeluar: logKeluar, sesi: ambil };
})();
