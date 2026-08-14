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
  byggArkivDokument,
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
} from "@sitedoc/pdf";
import { resolverPersonnavn } from "./persons-resolver";
import { inlineBilder } from "./bilde-inliner";
import { lesHendelseslogg, lesEndringslogg } from "./logg-lesere";

interface BildeRef { url: string; filnavn?: string; type?: string }

const ER_BILDE = (v: BildeRef): boolean =>
  typeof v.url === "string" && (v.type === "bilde" || /\.(png|jpe?g|gif|webp)$/i.test(v.filnavn ?? ""));

/**
 * Bilde-referanser i ett felt: per-felt `vedlegg` (alle felttyper) OG
 * `attachments`-feltets `verdi`-array (der filene ER verdien, per felt.ts:126).
 */
function bilderIFelt(felt: FeltVerdi): BildeRef[] {
  const fraVedlegg = (felt.vedlegg ?? []) as BildeRef[];
  const fraVerdi = Array.isArray(felt.verdi) ? (felt.verdi as BildeRef[]) : [];
  return [...fraVedlegg, ...fraVerdi].filter((v) => v && typeof v === "object" && ER_BILDE(v));
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

export interface SammenstillingResultat {
  html: string;
  /** Filnavn på vedlegg som ikke kom med → 4c setter x-render-komplett-kontrakten. */
  manglendeVedlegg: string[];
}

/** Erstatter bilde-url-er (i vedlegg OG attachments-verdi) med inlinede data-URI-er. Klone. */
function inlinDataBilder(
  data: Record<string, FeltVerdi>,
  dataUrl: Map<string, string>,
): Record<string, FeltVerdi> {
  const bytt = <T,>(v: T): T => {
    const b = v as unknown as BildeRef;
    return b && typeof b === "object" && ER_BILDE(b) && dataUrl.has(b.url)
      ? ({ ...b, url: dataUrl.get(b.url)! } as unknown as T)
      : v;
  };
  const ut: Record<string, FeltVerdi> = {};
  for (const [k, felt] of Object.entries(data)) {
    const vedlegg = (felt.vedlegg ?? []).map(bytt);
    const verdi = Array.isArray(felt.verdi) ? felt.verdi.map(bytt) : felt.verdi;
    ut[k] = { ...felt, vedlegg, verdi };
  }
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

  // 2) Firma (eksportfirma) via prosjektets org — for topptekst + logo.
  const prosjekt = await prisma.project.findUnique({
    where: { id: sjekkliste.template.projectId },
    select: {
      name: true,
      projectNumber: true,
      primaryOrganization: { select: { name: true, organizationNumber: true, logoUrl: true } },
    },
  });
  const org = prosjekt?.primaryOrganization;

  // 3) Samle bilde-url-er (vedlegg + firmalogo) → inline+komprimér.
  const bildeUrler = new Set<string>();
  for (const felt of Object.values(dataMedNavn)) {
    for (const v of bilderIFelt(felt)) bildeUrler.add(v.url);
  }
  if (org?.logoUrl) bildeUrler.add(org.logoUrl);
  const { dataUrl, manglende } = await inlineBilder(opts.hentBildeBytes, [...bildeUrler]);

  const dataInlinet = inlinDataBilder(dataMedNavn, dataUrl);

  // 4) Innhold (tre-bevisst, tomme strukturer synlig).
  const treObjekter = byggObjektTre(objects) as unknown as TreObjekt[];
  const innholdHtml = byggInnhold(treObjekter, dataInlinet, {
    bildeBaseUrl: "",
    visTommeStrukturer: true,
  });

  // 5) Logg (lag 1 alltid, lag 2 på malens enableChangeLog).
  const endringsloggAktivert = sjekkliste.template.enableChangeLog;
  const hendelser = await lesHendelseslogg(prisma, { checklistId: sjekklisteId });
  const endringer = await lesEndringslogg(prisma, { checklistId: sjekklisteId }, endringsloggAktivert);
  const logg = byggArkivLogg({ hendelser, endringer, endringsloggAktivert });

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
    logg,
    signaturer,
    generertTekst: opts.generertTekst,
    taMedEndringslogg: opts.taMedEndringslogg ?? true,
    eksport: opts.eksport,
    manglendeVedlegg: manglende,
  };

  return { html: byggArkivDokument(input), manglendeVedlegg: manglende };
}
