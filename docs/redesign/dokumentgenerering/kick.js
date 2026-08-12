setInterval(function () {
  var el = document.querySelector("doc-page");
  if (!el || !el.querySelector(".page") || typeof el._measure !== "function") return;
  var sheet = el.shadowRoot && el.shadowRoot.querySelector(".sheet");
  if (sheet && !sheet.classList.contains("paginated")) {
    try { el._measure(); } catch (e) {}
  }
}, 300);
