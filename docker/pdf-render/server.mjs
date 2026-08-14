/**
 * pdf-render — ren HTML→PDF-konverter (Stage 4a). Standalone sidecar (mønster
 * fra embed/oversettelse: egen prosess, deps i Docker, ingen monorepo-workspace).
 *
 * ARKITEKTUR: ren konverter. INGEN DB, INGEN FIL_SIGNING_SECRET — bildene er alt
 * inlinet som data-URI av api-sammenstillingen, og api-et leverer PDF-en (det har
 * secreten). Containeren tar HTML inn, gir PDF ut. Endrer ikke sikkerhetsflaten.
 *
 * Bilde-vakt (lærdom fra klient-siden 2026-08-14): networkidle0 er IKKE nok.
 * Tegningsutsnitt rendres via pdfjs/canvas og er ikke <img> mens de lages →
 * vent også på at [data-utskrift-venter]-merker er borte. Aldri stille hull:
 * timer vakten ut, settes `x-render-komplett: false` så api-et kan markere.
 */

import Fastify from "fastify";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT) || 3304;
const HOST = process.env.HOST || "0.0.0.0";
const GIT_SHA = process.env.GIT_SHA || "dev";
const BUILD_TID = process.env.BUILD_TID || "ukjent";
const MAKS_VENT_MS = Number(process.env.PDF_MAKS_VENT_MS) || 20000;

const app = Fastify({ bodyLimit: 64 * 1024 * 1024 }); // inlinede data-URI-bilder → stor payload

/** Delt browser-instans (kald oppstart av Chromium er dyrt). */
let browser;
async function hentBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  }
  return browser;
}

/**
 * Venter til ALLE bilder er dekodet OG ingen [data-utskrift-venter] gjenstår
 * (canvas/pdfjs). Returnerer true når alt er klart, false ved timeout.
 *
 * MÅ være en ekte funksjon (ikke en streng): `page.evaluate(streng, arg)` tolker
 * strengen som et UTTRYKK og ignorerer argumentet — funksjonen ble da aldri kalt,
 * `komplett` ble `undefined` → `x-render-komplett` alltid `false`, og vakten
 * kjørte aldri. Som funksjon serialiserer Playwright den og kaller den med `maksMs`.
 */
const VENT_FN = async (maksMs) => {
  const start = Date.now();
  const klar = () => {
    const bilderOk = [...document.images].every((i) => i.complete && i.naturalWidth > 0);
    const ventereOk = document.querySelectorAll("[data-utskrift-venter]").length === 0;
    return bilderOk && ventereOk;
  };
  while (!klar() && Date.now() - start < maksMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return klar();
};

app.get("/health", async () => ({ status: "ok" }));
app.get("/version", async () => ({ gitSha: GIT_SHA, buildTid: BUILD_TID }));

app.post("/pdf", async (req, reply) => {
  const { html, headerTemplate, footerTemplate } = req.body ?? {};
  if (typeof html !== "string" || html.length === 0) {
    return reply.code(400).send({ feil: "html (streng) er påkrevd" });
  }

  const ctx = await (await hentBrowser()).newContext();
  const page = await ctx.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    const komplett = await page.evaluate(VENT_FN, MAKS_VENT_MS);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "14mm", left: "16mm", right: "16mm" },
      displayHeaderFooter: Boolean(headerTemplate || footerTemplate),
      headerTemplate: headerTemplate || "<span></span>",
      footerTemplate: footerTemplate || "<span></span>",
    });

    reply
      .header("content-type", "application/pdf")
      .header("x-render-komplett", komplett ? "true" : "false")
      .send(pdf);
  } finally {
    await ctx.close();
  }
});

async function start() {
  await hentBrowser(); // fail-fast: krasj ved oppstart hvis Chromium mangler, ikke midt i en request
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`pdf-render lytter på ${HOST}:${PORT} (git ${GIT_SHA})`);
}

start().catch((e) => {
  console.error("pdf-render startet ikke:", e);
  process.exit(1);
});
