/* Pembantu UI. Semua data dari pelayan dimasukkan melalui textContent,
   tiada innerHTML untuk nilai dinamik — ini yang menutup XSS. */
(function () {
  "use strict";

  function el(tag, attrs, kanak) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "class") n.className = attrs[k];
        else if (k === "text") n.textContent = attrs[k];
        else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
      }
    }
    (kanak || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  /* DD/MM/YYYY — format tarikh Malaysia. */
  function tarikh(iso, denganMasa) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    var p = function (n) { return String(n).padStart(2, "0"); };
    var s = p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
    return denganMasa ? s + ", " + p(d.getHours()) + ":" + p(d.getMinutes()) : s;
  }

  function hariSejak(iso) {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  }

  function rm(n) {
    var v = Number(n);
    if (!isFinite(v)) return "—";
    return "RM " + v.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  var LABEL = {
    DIHANTAR: "Dihantar",
    DALAM_SEMAKAN: "Dalam semakan",
    DIPULANGKAN: "Dipulangkan",
    DALAM_KELULUSAN: "Dalam kelulusan",
    LULUS: "Lulus",
    TOLAK: "Tolak",
    DITARIK_BALIK: "Ditarik balik",
    GUGUR: "Gugur",
  };

  function lencana(status) {
    return el("span", { class: "badge " + status, text: LABEL[status] || status });
  }

  function papar(node, jenis, teks) {
    node.className = "msg " + jenis;
    node.textContent = teks;
    node.hidden = false;
  }
  function sorok(node) { node.hidden = true; node.textContent = ""; }

  /* Formula injection: nilai yang bermula =, +, -, @ boleh ditafsir sebagai
     formula bila CSV dibuka dalam Excel/Sheets. Netralkan dengan prefix '. */
  function selCsv(v) {
    var s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function muatTurunCsv(namaFail, baris) {
    var csv = "﻿" + baris.map(function (r) {
      return r.map(selCsv).join(",");
    }).join("\r\n");
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var a = el("a", { href: url, download: namaFail });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  window.UI = {
    el: el, tarikh: tarikh, hariSejak: hariSejak, rm: rm,
    lencana: lencana, LABEL: LABEL,
    papar: papar, sorok: sorok, muatTurunCsv: muatTurunCsv,
  };
})();
