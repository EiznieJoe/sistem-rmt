/* Pembantu UI. Semua data dari pelayan masuk melalui textContent — tiada
   innerHTML untuk nilai dinamik. Itu yang menutup XSS. */
(function () {
  "use strict";
  function el(tag, attrs, kanak) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (kanak || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  /* Ikon SVG supaya status tak pernah dibawa oleh warna sahaja. */
  var LALUAN_IKON = {
    good:    "M5 10.5l3.2 3.2L15 6.9",
    warning: "M10 5.5v5.2M10 14.2v.2",
    info:    "M10 9v5.5M10 5.6v.2"
  };
  function ikon(jenis) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("class", "ikon");
    svg.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", LALUAN_IKON[jenis] || LALUAN_IKON.info);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    svg.appendChild(p);
    return svg;
  }

  var LABEL = {
    LAYAK: "Layak", TIDAK_LAYAK: "Tidak layak",
    PERLU_SEMAK: "Perlu semak", LUAR_SKOP: "Luar skop"
  };
  var IKON_STATUS = { LAYAK: "good", PERLU_SEMAK: "warning" };

  function lencana(status) {
    var anak = [];
    if (IKON_STATUS[status]) anak.push(ikon(IKON_STATUS[status]));
    anak.push(LABEL[status] || status);
    return el("span", { class: "lencana " + status }, anak);
  }

  function tarikh(iso, denganMasa) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    var p = function (n) { return String(n).padStart(2, "0"); };
    var s = p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
    return denganMasa ? s + ", " + p(d.getHours()) + ":" + p(d.getMinutes()) : s;
  }

  function rm(n) {
    var v = Number(n);
    if (n === null || n === undefined || !isFinite(v)) return "—";
    return "RM " + v.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function nombor(n) {
    var v = Number(n);
    return isFinite(v) ? v.toLocaleString("en-MY") : "—";
  }

  function papar(node, jenis, teks) { node.className = "mesej " + jenis; node.textContent = teks; node.hidden = false; }
  function sorok(node) { node.hidden = true; node.textContent = ""; }

  /* Formula injection: nilai bermula =, +, -, @ ditafsir sebagai formula
     bila CSV dibuka dalam Excel atau Sheets. */
  function selCsv(v) {
    var s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function muatTurunCsv(nama, baris) {
    var csv = "﻿" + baris.map(function (r) { return r.map(selCsv).join(","); }).join("\r\n");
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var a = el("a", { href: url, download: nama });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  window.UI = { el: el, ikon: ikon, lencana: lencana, LABEL: LABEL,
                tarikh: tarikh, rm: rm, nombor: nombor,
                papar: papar, sorok: sorok, muatTurunCsv: muatTurunCsv };
})();
