/**
 * Prøvebenk for annoterings-HTML-en — utviklerverktøy, IKKE produktkode.
 *
 * Skriver den delte `ANNOTERINGS_HTML` (hentet fra kilden, ikke klippet) til en
 * lokal .html-fil og legger på en filvelger + verktøyknapper. Da kan Kenneth åpne
 * fila i nettleser, velge et ekte bilde og DØMME strektykkelse, halo og tekst med
 * eget blikk FØR merge — og justere skaleringen ved å endre vindusbredden, som er
 * nøyaktig variabelen `annoteringSkala()` henger på.
 *
 * Den AUTOMATISERER ingenting: ingen musesimulering, ingen asserter, ingen
 * nettleserdriver. Knappene kaller kun de `window.*`-funksjonene HTML-en selv
 * eksponerer (`settBilde`/`velgVerktoy`/`angre`/`lagre`) — menneskelige kontroller,
 * ikke et testharnesk.
 *
 * Kjør (fra repo-rot):  pnpm dlx tsx scripts/annotering-prøvebenk.ts
 * Åpne så stien skriptet printer.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ANNOTERINGS_HTML } from "../packages/shared/src/annotering/annoterings-html";

// Verktøylinje for det menneskelige blikket. Injiseres foran </body> i det ferdige
// dokumentet — settBilde/velgVerktoy m.fl. er alt definert på window der (samme
// dokument, ikke iframe), så knappene når dem direkte.
const VERKTOYLINJE = `
<div id="pb-verktoy" style="position:fixed;top:8px;left:8px;z-index:99999;display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:rgba(255,255,255,0.95);padding:8px;border-radius:8px;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 1px 6px rgba(0,0,0,0.3);">
  <label style="cursor:pointer;font-weight:600;">Velg bilde<input id="pb-fil" type="file" accept="image/*" style="display:none;"></label>
  <span style="color:#ccc;">|</span>
  <button data-verktoy="arrow">Pil</button>
  <button data-verktoy="circle">Sirkel</button>
  <button data-verktoy="rect">Firkant</button>
  <button data-verktoy="text">Tekst</button>
  <button data-verktoy="draw">Frihånd</button>
  <button data-verktoy="select">Velg</button>
  <span style="color:#ccc;">|</span>
  <button id="pb-angre">Angre</button>
  <button id="pb-lagre">Flat ut</button>
  <span id="pb-info" style="color:#666;">Endre vindusbredden for å teste skalering</span>
</div>
<script>
  (function () {
    document.getElementById('pb-fil').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) window.settBilde(URL.createObjectURL(f));
    });
    document.querySelectorAll('#pb-verktoy button[data-verktoy]').forEach(function (b) {
      b.addEventListener('click', function () { window.velgVerktoy(b.getAttribute('data-verktoy')); });
    });
    document.getElementById('pb-angre').addEventListener('click', function () { window.angre(); });
    document.getElementById('pb-lagre').addEventListener('click', function () { window.lagre(); });
    // Toppnivå-dokument: window.parent === window, så 'ferdig'-meldingen fra lagre()
    // lander her. Vis den utflatede JPEG-en så resultatet kan dømmes, ikke bare canvas.
    window.addEventListener('message', function (e) {
      try {
        var d = JSON.parse(e.data);
        if (d.type === 'ferdig') {
          var w = window.open('', '_blank');
          if (w) w.document.write('<title>Utflatet JPEG</title><img src="' + d.dataUrl + '" style="max-width:100%">');
        }
      } catch (_) {}
    });
  })();
</script>
`;

const dokument = ANNOTERINGS_HTML.replace("</body>", `${VERKTOYLINJE}</body>`);

const utFil = join(dirname(fileURLToPath(import.meta.url)), "annotering-prøvebenk.local.html");
writeFileSync(utFil, dokument, "utf-8");

// eslint-disable-next-line no-console
console.log(`Prøvebenk skrevet. Åpne i nettleser:\n  open "${utFil}"`);
