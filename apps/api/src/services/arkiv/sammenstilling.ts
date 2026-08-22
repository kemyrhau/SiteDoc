/**
 * Arkivmal — sammenstilling (Stage 4b-2, api-orkestrator).
 *
 * Kjeder api-data → ferdig arkiv-HTML for sjekkliste (oppgave/HMS følger samme
 * mønster). Rekkefølge: hent → persons-resolver → inline+komprimér bilder →
 * byggInnhold → logg-lesere+byggArkivLogg → statusceller/signaturer →
 * byggArkivDokument. Bilde-lesing er injisert (`hentBildeBytes`) — 4c leverer
 * disk-lesing fra uploads; her er det avkoblet og testbart. Containeren får
 * ferdig HTML med bilder inlinet (nettverksfri).
 */

import type { PrismaClient } from "@sitedoc/db";
import { byggObjektTre } from "@sitedoc/shared/types";
import {
  byggInnhold,
  byggArkivLogg,
  byggKolonnerPerFelt,
  byggArkivDokument,
  byggArkivSide,
  byggLokasjonsblokk,
  byggTegningssider,
  velgHelsider,
  prosjektReferanseForUtskrift,
  statusTekst,
  statusSemantiskFarge,
  formaterNummer,
  formaterDatoKort,
  type RapportObjekt,
  type TreObjekt,
  type FeltVerdi,
  type StatusCelle,
  type ArkivSignatur,
  type ArkivDokumentInput,
  type Utskriftsinnstillinger,
  type TegningsOppslagOppf,
  type TegningssideData,
} from "@sitedoc/pdf";
import { resolverPersonnavn } from "./persons-resolver";
import { inlineBilder } from "./bilde-inliner";
import { lesHendelseslogg, lesEndringslogg } from "./logg-lesere";
import { samleRepeaterMarkorer, byggUtsnittCrop, type RepeaterMarkor } from "./tegningsmarkorer";

interface BildeRef { url: string; filnavn?: string; type?: string }

const ER_BILDE = (v: BildeRef): boolean =>
  typeof v.url === "string" && (v.type === "bilde" || /\.(png|jpe?g|gif|webp)$/i.test(v.filnavn ?? ""));

/**
 * Alle bilde-referanser i ett felt, uansett nesting-dybde. Dyp traversering fordi
 * bilder også ligger i repeater-RADER (celle-`vedlegg`/`verdi`) — ikke bare i
 * feltets egen `vedlegg`/`verdi`. Uten rekursjon ble 14 av 18 bilder på BEF-001
 * aldri samlet → aldri inlinet → underrapportert i `manglendeVedlegg`.
 */
function bilderIFelt(felt: FeltVerdi): BildeRef[] {
  const ut: BildeRef[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
    } else if (v && typeof v === "object") {
      if (ER_BILDE(v as BildeRef)) ut.push(v as BildeRef);
      else for (const x of Object.values(v)) walk(x);
    }
  };
  walk(felt);
  return ut;
}

export interface SammenstillingOpts {
  /** Leser fil-bytes for en vedlegg-url (4c: fra uploads-disk). null → manglende. */
  hentBildeBytes: (url: string) => Promise<Buffer | null>;
  /** «11.08.2026 14:32» — generert-stempel. */
  generertTekst: string;
  /** Krav #2: default true (lag 2 med). */
  taMedEndringslogg?: boolean;
  eksport?: boolean;
}

/**
 * Data 4c trenger for å bygge de per-side Playwright-templatene (fortsettelses-
 * header + bunntekst). Playwright-header/-footer rendres i side-margin uten
 * dokumentets CSS, så de bygges med inline-stiler av `render-templates.ts` —
 * her leverer vi kun de rå verdiene (unngår ny DB-henting i render-laget).
 */
export interface RammeData {
  firmaNavn: string;
  orgnr?: string;
  dokumenttype: string;
  dokumentnavn: string;
  dokumentnummer: string;
  dokumentId: string;
  prosjekt: string | null;
  logoDataUrl: string | null;
}

export interface SammenstillingResultat {
  /** Fullt standalone HTML-dokument (én PDF for ett dokument). */
  html: string;
  /** Dette dokumentets `.ark-side`-blokk (uten shell) — for samleutskrift (N1). */
  side: string;
  /** Dokumenttittel (til per-dokument-status i responsen). */
  tittel: string;
  /** Nedlastingsfilnavn for enkeltdokument (`BEF-001.pdf`). */
  filnavn: string;
  /** Kompakt prosjektreferanse (ekstern/intern/SD) — for samleutskrift-filnavn. */
  prosjektRef: string;
  /** Filnavn på vedlegg som ikke kom med → 4c setter x-render-komplett-kontrakten. */
  manglendeVedlegg: string[];
  /** Verdier for per-side header/footer (4c). */
  ramme: RammeData;
}

/** «BEF-001» → filnavn. Faller tilbake til id når nummer/prefix mangler. */
function byggFilnavn(prefix: string | null, nummer: number | null, id: string): string {
  if (prefix && nummer != null) return `${prefix}-${String(nummer).padStart(3, "0")}.pdf`;
  return `sjekkliste-${id}.pdf`;
}

// Placeholder for et bilde som ikke lot seg inline (fil mangler/leser feil). MÅ
// være en data-URI: pdf-render-containeren er nettverksløs, så en gjenstående
// `<img src="/uploads/...">` får aldri `naturalWidth>0` → bilde-vakten henger
// hele 20 s-timeouten. Base64-SVG laster momentant (og overlever `esc()` rent —
// kun [A-Za-z0-9+/=]). Synlig «Bilde mangler»-markør i kroppen; mangelen står
// dessuten i loggseksjonen (`byggMangelMerknad`) — mangel-kontrakten fra 4a.
const MANGLENDE_BILDE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260">' +
  '<rect width="400" height="260" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2"/>' +
  '<text x="200" y="130" font-family="sans-serif" font-size="18" fill="#6b7280" ' +
  'text-anchor="middle" dominant-baseline="middle">Bilde mangler</text></svg>';
const MANGLENDE_BILDE_DATAURL =
  "data:image/svg+xml;base64," + Buffer.from(MANGLENDE_BILDE_SVG).toString("base64");

/**
 * Erstatter bilde-url-er med inlinede data-URI-er, uansett nesting-dybde (samme
 * rekursjon som `bilderIFelt` — repeater-rader inkludert). Dyp klone; muterer ikke
 * input. Inlinet → data-URI; ikke inlinet → placeholder (ALDRI nettverks-url,
 * se MANGLENDE_BILDE_DATAURL).
 */
function inlinDataBilder(
  data: Record<string, FeltVerdi>,
  dataUrl: Map<string, string>,
): Record<string, FeltVerdi> {
  const bytt = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(bytt);
    if (v && typeof v === "object") {
      if (ER_BILDE(v as BildeRef)) {
        const b = v as BildeRef;
        const url = dataUrl.has(b.url) ? dataUrl.get(b.url)! : MANGLENDE_BILDE_DATAURL;
        return { ...b, url };
      }
      const ut: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) ut[k] = bytt(x);
      return ut;
    }
    return v;
  };
  const ut: Record<string, FeltVerdi> = {};
  for (const [k, felt] of Object.entries(data)) ut[k] = bytt(felt) as FeltVerdi;
  return ut;
}

export async function byggSjekklisteArkivHtml(
  prisma: PrismaClient,
  sjekklisteId: string,
  opts: SammenstillingOpts,
): Promise<SammenstillingResultat> {
  const sjekkliste = await prisma.checklist.findUniqueOrThrow({
    where: { id: sjekklisteId },
    include: {
      template: { include: { objects: { orderBy: { sortOrder: "asc" } } } },
      bestillerFaggruppe: { select: { name: true } },
      utforerFaggruppe: { select: { name: true } },
      bestiller: { select: { name: true } },
      byggeplass: { select: { name: true } },
    },
  });

  const objects = sjekkliste.template.objects as unknown as RapportObjekt[];
  const raaData = (sjekkliste.data ?? {}) as unknown as Record<string, FeltVerdi>;

  // 1) persons-UUID → navn (aldri rå nøkkel til byggherre).
  const dataMedNavn = await resolverPersonnavn(prisma, raaData, objects);

  // 1b) D2: samle tegninger som markører peker på — dokumentnivå (checklist-
  // raden) + feltnivå (`drawing_position`-verdier). Slås opp samlet slik at
  // «tegning slettet etter markering» faller pent ut: `findMany` utelater den,
  // oppslaget blir tomt, og rendreren returnerer "" (ingen tom tegningsblokk).
  const tegningIder = new Set<string>();
  if (sjekkliste.drawingId) tegningIder.add(sjekkliste.drawingId);
  for (const obj of objects) {
    if (obj.type !== "drawing_position") continue;
    const v = dataMedNavn[obj.id]?.verdi as { drawingId?: string } | null | undefined;
    if (v?.drawingId) tegningIder.add(v.drawingId);
  }
  // D2b: rekursive repeater-markører (kan nestes) → deres tegninger må også med.
  // Treet bygges her (brukes også til innhold/logg-kolonner under). Negativ-testen
  // (markør på tegning A + doc-lokasjon på tegning B → BEGGE tegninger med) dekkes
  // av at både `sjekkliste.drawingId` og markørenes drawingId legges i settet.
  const treObjekter = byggObjektTre(objects) as unknown as TreObjekt[];
  const repeaterMarkorer = samleRepeaterMarkorer(treObjekter, dataMedNavn);
  for (const m of repeaterMarkorer) tegningIder.add(m.drawingId);
  const tegninger = tegningIder.size
    ? await prisma.drawing.findMany({
        where: { id: { in: [...tegningIder] } },
        select: { id: true, name: true, drawingNumber: true, fileUrl: true, imageWidth: true, imageHeight: true },
      })
    : [];
  const tegningPerId = new Map(tegninger.map((t) => [t.id, t]));
  const tegningNavn = (t: { drawingNumber: string | null; name: string }): string =>
    t.drawingNumber ? `${t.drawingNumber} ${t.name}` : t.name;

  // 2) Firma (eksportfirma) via prosjektets org — for topptekst + logo.
  const prosjekt = await prisma.project.findUnique({
    where: { id: sjekkliste.template.projectId },
    select: {
      name: true,
      projectNumber: true,
      externalProjectNumber: true,
      internalProjectNumber: true,
      visSiteDocNummer: true,
      utskriftsinnstillinger: true,
      primaryOrganization: { select: { name: true, organizationNumber: true, logoUrl: true } },
    },
  });
  const org = prosjekt?.primaryOrganization;
  // Kompakt prosjektreferanse (ekstern → intern → SD, samme fallback som headeren)
  // — brukes til samleutskrift-filnavn, så nummeret er konsistent med dokumentet.
  const prosjektRef = prosjektReferanseForUtskrift(
    prosjekt,
    (prosjekt?.utskriftsinnstillinger ?? null) as Utskriftsinnstillinger | null,
  );

  // 3) Samle bilde-url-er (vedlegg + firmalogo) → inline+komprimér.
  const bildeUrler = new Set<string>();
  for (const felt of Object.values(dataMedNavn)) {
    for (const v of bilderIFelt(felt)) bildeUrler.add(v.url);
  }
  if (org?.logoUrl) bildeUrler.add(org.logoUrl);
  // D2: tegningsbilder inlines i SAMME batch → data-URI (aldri signert URL).
  for (const t of tegninger) bildeUrler.add(t.fileUrl);
  const { dataUrl, manglende } = await inlineBilder(opts.hentBildeBytes, [...bildeUrler]);

  const dataInlinet = inlinDataBilder(dataMedNavn, dataUrl);

  // 3b) D2: oppslag drawingId → inlinet tegningsbilde + dimensjoner (arkiv-only,
  // valgfritt på PdfConfig → mobil uendret). Henting feilet → hoppes over
  // (filnavnet er alt ført i `manglende`); rendreren utelater da blokken.
  const tegningsOppslag: Record<string, TegningsOppslagOppf> = {};
  for (const t of tegninger) {
    const url = dataUrl.get(t.fileUrl);
    if (!url) continue;
    tegningsOppslag[t.id] = {
      dataUrl: url,
      imageWidth: t.imageWidth,
      imageHeight: t.imageHeight,
      navn: tegningNavn(t),
    };
  }

  // 3c) D2b (Kenneth-vedtak 2026-08-21): crop-utsnitt per repeater-markør (sharp,
  // rå bytes, moderat DPI — Gate 3) og INJISER det på markør-verdien i `dataInlinet`
  // (`utsnittDataUrl`), så repeater-cella rendrer utsnittet under koordinatteksten.
  // Innsamlingen kjøres på `dataInlinet` slik at referansene treffer det byggInnhold
  // faktisk rendrer. Bytes hentes én gang per tegning.
  const markorerInlinet = samleRepeaterMarkorer(treObjekter, dataInlinet);
  const bytesPerTegning = new Map<string, Buffer | null>();
  for (const m of markorerInlinet) {
    const t = tegningPerId.get(m.drawingId);
    if (!t || !tegningsOppslag[m.drawingId] || t.imageWidth == null || t.imageHeight == null) continue;
    if (!bytesPerTegning.has(m.drawingId)) {
      bytesPerTegning.set(m.drawingId, await opts.hentBildeBytes(t.fileUrl).catch(() => null));
    }
    const bytes = bytesPerTegning.get(m.drawingId);
    if (!bytes) continue;
    const crop = await byggUtsnittCrop(bytes, t.imageWidth, t.imageHeight, m.x, m.y);
    if (crop) m.markorObj.utsnittDataUrl = crop;
  }

  // 4) Innhold (tre-bevisst, tomme strukturer synlig). `treObjekter` bygget over.
  // Repeater-cellene bærer nå injiserte detaljutsnitt.
  const innholdHtml = byggInnhold(treObjekter, dataInlinet, {
    bildeBaseUrl: "",
    visTommeStrukturer: true,
    tegningsOppslag,
  });

  // 4b) D2: dokument-lokasjon (tegningsmarkør) øverst side 1. Tekstlinje under:
  // byggeplass · tegningsnavn. Uten markør/bilde → "" (ingen lokasjonsseksjon).
  const docTegning = sjekkliste.drawingId ? tegningPerId.get(sjekkliste.drawingId) : undefined;
  const lokasjonHtml = byggLokasjonsblokk(
    {
      drawingId: sjekkliste.drawingId,
      positionX: sjekkliste.positionX,
      positionY: sjekkliste.positionY,
      byggeplassNavn: sjekkliste.byggeplass?.name ?? null,
      tegningNavn: docTegning ? tegningNavn(docTegning) : null,
    },
    tegningsOppslag,
  );

  // 4c) D2b: helside per tegning = full tegning + nummererte markører (nr =
  // radnummer i repeater-tabellen). Markør→punkt-tabellen er FJERNET (detaljutsnittet
  // ligger nå i repeater-cella). Grupper per tegning, bevar dokumentorden.
  const helsidePerTegning = new Map<string, TegningssideData>();
  for (const m of markorerInlinet) {
    const t = tegningPerId.get(m.drawingId);
    const oppslag = tegningsOppslag[m.drawingId];
    if (!t || !oppslag) continue; // tegning slettet / bilde-henting feilet → ingen side
    let side = helsidePerTegning.get(m.drawingId);
    if (!side) {
      side = {
        tegningNavn: oppslag.navn ?? tegningNavn(t),
        bildeDataUrl: oppslag.dataUrl,
        imageWidth: t.imageWidth,
        imageHeight: t.imageHeight,
        markorer: [],
      };
      helsidePerTegning.set(m.drawingId, side);
    }
    side.markorer.push({ nr: m.radnr, x: m.x, y: m.y });
  }
  // Helside-regel (Kenneth-vedtak 2026-08-22): KUN tegninger med ≥2 markører. Teller PER
  // tegning (markørene er alt gruppert per drawingId over). Dokument-lokasjonen (4b) teller
  // ikke — den ligger ikke i `markorerInlinet` (samleRepeaterMarkorer tar kun repeater-rader).
  const tegningssiderHtml = byggTegningssider(velgHelsider([...helsidePerTegning.values()]));

  // 5) Logg (lag 1 alltid, lag 2 på malens enableChangeLog). Kolonne-map lar
  // endringsloggen ekspandere repeater-endringer til «Rad N — kolonne»-rader.
  const endringsloggAktivert = sjekkliste.template.enableChangeLog;
  const kolonnerPerFelt = byggKolonnerPerFelt(treObjekter);
  const hendelser = await lesHendelseslogg(prisma, { checklistId: sjekklisteId });
  const endringer = await lesEndringslogg(prisma, { checklistId: sjekklisteId }, endringsloggAktivert);
  const logg = byggArkivLogg({ hendelser, endringer, endringsloggAktivert, kolonnerPerFelt });

  // 6) Statusceller + signaturer utledet av status + hendelseslogg.
  const godkjent = [...hendelser].reverse().find((h) => /godkjent/i.test(h.handling));
  const utfortNavn = sjekkliste.bestiller?.name ?? "—";
  const statusCeller: StatusCelle[] = [
    { etikett: "Status", verdi: statusTekst(sjekkliste.status), farge: statusSemantiskFarge(sjekkliste.status) },
    { etikett: "Utført av", verdi: utfortNavn, underVerdi: sjekkliste.utforerFaggruppe?.name },
    { etikett: "Opprettet", verdi: formaterDatoKort(sjekkliste.createdAt) },
  ];
  if (godkjent) statusCeller.push({ etikett: "Godkjent", verdi: formaterDatoKort(godkjent.tidspunkt) });

  const signaturer: ArkivSignatur[] = [
    {
      rolleEtikett: "Utført av",
      navn: utfortNavn,
      rolle: sjekkliste.utforerFaggruppe?.name,
      tidspunkt: sjekkliste.createdAt.toISOString(),
    },
    {
      rolleEtikett: "Godkjent av",
      navn: godkjent?.aktor ?? "",
      tidspunkt: godkjent?.tidspunkt ?? null,
    },
  ];

  const input: ArkivDokumentInput = {
    firma: {
      navn: org?.name ?? prosjekt?.name ?? "",
      orgnr: org?.organizationNumber,
      logoDataUrl: org?.logoUrl ? dataUrl.get(org.logoUrl) : null,
    },
    meta: {
      kategori: "sjekkliste",
      dokumenttype: "Sjekkliste",
      dokumentnavn: sjekkliste.title,
      dokumentnummer: formaterNummer(sjekkliste.number, sjekkliste.template.prefix) ?? "",
      dokumentId: sjekkliste.id,
      status: sjekkliste.status,
    },
    prosjektblokk: {
      prosjekt: prosjekt ? [prosjekt.projectNumber, prosjekt.name].filter(Boolean).join(" · ") : null,
      byggeplass: sjekkliste.byggeplass?.name,
      // TODO(4b-2): byggherre-felt/faggruppe er uavklart i datamodellen — utelates
      // (prosjektblokken komprimeres). Egen avklaring; ikke blokkerende.
      byggherre: null,
    },
    statusCeller,
    innholdHtml,
    lokasjonHtml,
    tegningssiderHtml,
    logg,
    signaturer,
    generertTekst: opts.generertTekst,
    taMedEndringslogg: opts.taMedEndringslogg ?? true,
    eksport: opts.eksport,
    manglendeVedlegg: manglende,
  };

  const ramme: RammeData = {
    firmaNavn: input.firma.navn,
    orgnr: input.firma.orgnr ?? undefined,
    dokumenttype: input.meta.dokumenttype,
    dokumentnavn: input.meta.dokumentnavn,
    dokumentnummer: input.meta.dokumentnummer,
    dokumentId: input.meta.dokumentId,
    prosjekt: input.prosjektblokk.prosjekt ?? null,
    logoDataUrl: input.firma.logoDataUrl ?? null,
  };

  return {
    html: byggArkivDokument(input),
    side: byggArkivSide(input),
    tittel: sjekkliste.title,
    filnavn: byggFilnavn(sjekkliste.template.prefix, sjekkliste.number, sjekklisteId),
    prosjektRef,
    manglendeVedlegg: manglende,
    ramme,
  };
}
