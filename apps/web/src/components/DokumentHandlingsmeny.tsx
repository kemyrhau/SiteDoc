"use client";

// Kilde-drevet handlingsmeny (A-3a, 2026-07-17).
// Handlingssettet utledes fra `statusHandlinger.ts` (samme kilde som mobil),
// IKKE fra en lokal if-kjede. Primærhandlingen (`erPrimaer`) rendres som knapp;
// resten i nedtrekk. Handlinger brukeren ikke kan gjøre nå vises deaktivert med
// begrunnelse utledet fra kilden. Bekreftelse kreves kun for irreversible
// overganger (`closed`/`deleted`); alt annet er 1 klikk. Kommentar er en
// valgfri utvider — MED ett unntak (F1): Avvis (dismissed) krever en ikke-tom
// begrunnelse (statusKreverBegrunnelse), håndhevet både her og på serveren.

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus } from "lucide-react";
import { Tooltip } from "@sitedoc/ui";
import {
  hentStatusHandlinger,
  hentPosisjonFiltrertHandlinger,
  hentHandlingEierRoller,
  isValidStatusTransition,
  statusKreverBegrunnelse,
  type StatusHandling,
  type DokumentflytRolle,
  type AdminNiva,
} from "@sitedoc/shared";
import { byggVideresendValg, filtrerVideresendPaaMedlemskap, finnMottakerNavn } from "@/lib/videresend-valg";
import type { DokumentflytData, FaggruppeData, VideresendMedlem } from "@/lib/videresend-valg";
import { STATUS_LABEL_NOEKKEL, flythjelpTekst } from "@/lib/flytmatrise-def";
import { byggLedd, finnAktivtIndex, type FlytMedlem } from "@/lib/flyt-ledd";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface Mottaker {
  userId?: string;
  groupId?: string;
  dokumentflytId?: string;
}

interface DokumentHandlingsmenyProps {
  status: string;
  /** Aktivt ledd = dokumentets `aktivPosisjon` (server-fakta) — styrer aktiv boks. */
  aktivPosisjon?: number | null;
  /** Steg 4b: posisjon-baserte retningsrettigheter (klient-handlingsfilter = server). */
  retningsrett?: { kanSende: boolean; kanBesvare: boolean; kanVideresende: boolean; kanTerminere: boolean };
  /** Har innlogget bruker ballen? (posisjon) */
  harBallen?: boolean;
  /** Avsender-siden (medlem av ledд bak ballen) — for «Trekk tilbake». */
  seerErBakover?: boolean;
  erLaster: boolean;
  /**
   * `handlingNoekkel` (StatusHandling.tekstNoekkel) er PÅKREVD, ikke valgfri (A-3b,
   * cowork-vedtak: valgfri = glemmelig, og glemmes den forsvinner kvitteringen
   * stille — samme feilmodus som `tillatFlytMedlemskap` i sak 1, unngått med
   * kompileringsfeil i stedet). `nyStatus` er utfallet; handlingen er hva
   * brukeren gjorde — de to er ikke det samme (send/sendTilbake gir begge "sent").
   */
  onEndreStatus: (nyStatus: string, handlingNoekkel: string, kommentar?: string, mottaker?: Mottaker) => void;
  onSlett?: () => void;
  alleFaggrupper?: FaggruppeData[];
  dokumentflyter?: DokumentflytData[];
  templateId?: string | null;
  standardFaggruppeId?: string;
  minRolle?: DokumentflytRolle | null;
  /**
   * Admin-nivå i flyt-laget (Kloss 2): "sitedoc" (kode-bypass), "prosjekt" (full innenfor
   * statusmaskinen, konfigurerbar), null (vanlig rolle — inkl. firma-admin). Fra
   * hentMinFlytInfo.adminNiva. Erstatter det gamle `erAdmin`-flagget som viste firma-admin
   * et fantom-menyvalg serveren avviste.
   */
  adminNiva?: AdminNiva;
  /** Dokumentflyt-medlemmer for posisjon-utledning */
  flytMedlemmer?: FlytMedlem[];
  /**
   * H3 (videresend-rettighet): flyt-ID-ene innlogget bruker (avsenderen) er medlem av
   * i prosjektet — fra `medlem.hentMineFlyter`. Videresend-mottakerlista begrenses til
   * disse for ikke-admin. Admin (adminNiva prosjekt/sitedoc) beholder full liste.
   */
  mineFlytIder?: string[];
  /** Nåværende mottaker (bruker-ID) */
  recipientUserId?: string | null;
  /** Nåværende mottaker (gruppe-ID) */
  recipientGroupId?: string | null;
  /** Bestiller (oppretters bruker-ID) */
  bestillerUserId?: string;
  /** Tidspunkt da mottaker åpnet dokumentet */
  lestAvMottakerVed?: Date | string | null;
  /**
   * P2 (tom-besvarelse): når satt, er «Besvar» (responded) deaktivert fordi
   * besvarelsen er tom (ingen utfylte svar-felt). Teksten vises som mikrotekst/
   * tooltip. Beregnes på detaljflaten (der svarverdiene + malfeltene finnes) —
   * `DokumentHandlingsmeny` forblir innholds-agnostisk. Speiler server-guarden.
   */
  besvarDeaktivertGrunn?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Meny-oppføring                                                     */
/* ------------------------------------------------------------------ */

type Plassering = "sekundær" | "send" | "overflow" | "deaktivert";

interface MenyOppforing {
  key: string;
  label: string;
  nyStatus: string;
  /** Handlingens kilde-nøkkel (StatusHandling.tekstNoekkel) — sendes til onEndreStatus. */
  tekstNoekkel: string;
  mottaker?: Mottaker;
  plassering: Plassering;
  begrunnelse?: string;
  erDestruktiv?: boolean;
  /** Person-videresending (Del 2.4): flytens medlemmer, vist når faggruppe-raden ekspanderes. */
  medlemmer?: VideresendMedlem[];
  /** Mikrotekst-hover (flyt-flater-ordre 2026-07-25): fet tittel + brødtekst med resolvert mottaker. */
  mikro?: { tittel: string; tekst: string };
}

/**
 * Kommentar-nudge KUN ved tilbakesending (Del 2.5, Kenneths vedtak 5): «Send tilbake»
 * / «Avvis» ber om en begrunnelse før utsending — ikke universelt. Nøklet på HANDLING
 * (tekstNoekkel), ikke nyStatus, av samme grunn som kvitteringen (ikke-injektiv).
 * Begrunnelsen forblir valgfri (fritekst = valgfritt, CLAUDE.md) — nudgen oppfordrer.
 */
const NUDGE_TEKSTNOEKLER = new Set([
  // F3: «Send tilbake» (responded→in_progress) er nå den eneste tilbakesendingen som nudger.
  // «Send på nytt» (in_progress→sent) er en fram-sending og nudger ikke.
  "statushandling.sendTilbakeUtforer",
  "handling.avvis",
]);

/** Statusverdier som hører til admin/⋯-seksjonen når de IKKE er primærhandling */
const ADMIN_NY = new Set(["closed", "cancelled", "draft"]);

/** Primær-knappens fargeklasse basert på kildens `farge` */
const FARGE_KLASSE: Record<string, string> = {
  "bg-blue-600": "bg-sitedoc-primary hover:bg-blue-700",
  "bg-red-600": "bg-red-600 hover:bg-red-700",
  "bg-purple-600": "bg-purple-600 hover:bg-purple-700",
  "bg-green-600": "bg-green-600 hover:bg-green-700",
  "bg-amber-500": "bg-amber-500 hover:bg-amber-600",
  "bg-gray-500": "bg-gray-500 hover:bg-gray-600",
};

/* ------------------------------------------------------------------ */
/*  Hovedkomponent                                                      */
/* ------------------------------------------------------------------ */

export function DokumentHandlingsmeny({
  status,
  aktivPosisjon,
  retningsrett,
  harBallen,
  seerErBakover,
  erLaster,
  onEndreStatus,
  onSlett,
  alleFaggrupper,
  dokumentflyter,
  templateId,
  standardFaggruppeId,
  minRolle,
  adminNiva,
  flytMedlemmer,
  mineFlytIder,
  recipientUserId,
  recipientGroupId,
  bestillerUserId,
  lestAvMottakerVed,
  besvarDeaktivertGrunn,
}: DokumentHandlingsmenyProps) {
  const { t } = useTranslation();
  const [åpenMeny, setÅpenMeny] = useState(false);
  const [bekreft, setBekreft] = useState<{ nyStatus: string; tekstNoekkel: string; mottaker?: Mottaker; label: string; nudge?: boolean } | null>(null);
  const [visKommentar, setVisKommentar] = useState(false);
  const [kommentar, setKommentar] = useState("");
  const menyRef = useRef<HTMLDivElement>(null);

  // Lukk nedtrekk ved klikk utenfor
  useEffect(() => {
    if (!åpenMeny) return;
    const lukk = (e: MouseEvent) => {
      if (menyRef.current && !menyRef.current.contains(e.target as Node)) setÅpenMeny(false);
    };
    document.addEventListener("mousedown", lukk);
    return () => document.removeEventListener("mousedown", lukk);
  }, [åpenMeny]);

  const videresendValg = useMemo(
    () => byggVideresendValg(alleFaggrupper ?? [], dokumentflyter ?? [], templateId),
    [alleFaggrupper, dokumentflyter, templateId],
  );

  // H3 (videresend-rettighet): videresend-mottakere begrenses til flyter avsenderen selv
  // er medlem av — admin (prosjekt/sitedoc) beholder full liste. Gjelder KUN videresend-stien
  // (forwarded); førstegangs-send (draft→sent) bruker fortsatt `videresendValg` ufiltrert.
  const erFlytAdmin = adminNiva === "sitedoc" || adminNiva === "prosjekt";
  const videresendMottakere = useMemo(
    () => filtrerVideresendPaaMedlemskap(videresendValg, new Set(mineFlytIder ?? []), erFlytAdmin),
    [videresendValg, mineFlytIder, erFlytAdmin],
  );

  const ledd = useMemo(() => byggLedd(flytMedlemmer ?? []), [flytMedlemmer]);
  const aktivtIndex = useMemo(
    () => finnAktivtIndex(ledd, aktivPosisjon),
    [ledd, aktivPosisjon],
  );
  const harFlyt = ledd.length > 0;
  // Variant C krever FLERE ledd: en enkelt-ledds flyt har ingen «neste mottaker».
  const erSisteBoks = ledd.length > 1 && aktivtIndex === ledd.length - 1;

  // Kilde: aktive handlinger + hele universet (for deaktiverte).
  // Uten dokumentflyt finnes ingen rollestruktur — serveren bypasser `verifiserFlytRolle`
  // for dokumenter uten `dokumentflytId`, så klienten tilbyr da hele (statusmaskin-lovlige) settet.
  const alle = useMemo(() => hentStatusHandlinger(status), [status]);
  // Steg 4b (retning B): posisjon-basert handlingsfilter — klienten viser nøyaktig det serveren
  // (`verifiserRetningsrett`) autoriserer. Uten flyt: hele universet (som før, flyt-løst dok).
  const erFlytAdminNiva = adminNiva === "sitedoc" || adminNiva === "prosjekt";
  const aktive = useMemo(
    () =>
      harFlyt
        ? hentPosisjonFiltrertHandlinger(status, {
            retningsrett: retningsrett ?? { kanSende: false, kanBesvare: false, kanVideresende: false, kanTerminere: false },
            harBallen: harBallen ?? false,
            seerErBakover: seerErBakover ?? false,
            erAdmin: erFlytAdminNiva,
          })
        : alle,
    [harFlyt, status, retningsrett, harBallen, seerErBakover, erFlytAdminNiva, alle],
  );

  // Standard-mottaker (utfører-faggruppen) for «besvar»-overgangen
  const mottakerForStandard = (): Mottaker | undefined => {
    const std = standardFaggruppeId
      ? videresendValg.find((v) => v.faggruppeId === standardFaggruppeId)
      : undefined;
    return std?.mottaker ? { ...std.mottaker, dokumentflytId: std.dokumentflytId } : undefined;
  };

  /* ------------------------------------------------------------------ */
  /*  Mikrotekst-hover (flyt-flater-ordre 2026-07-25)                    */
  /* ------------------------------------------------------------------ */

  // Delt tekstkilde med matrisen (flythjelp.*). Kartlegger tekstNoekkel → flythjelp.handling.*
  // og fyller {{mottaker}} med resolvert navn, ellers den relasjonelle fallback-benevnelsen.
  // besvar bruker ledd[aktivtIndex-1]/avsender (server ruter til forrige avsender via
  // sisteTransfer.senderId) — ALDRI mottakerForStandard(), som kun styrer selve mutasjonen.
  const flythjelpFor = (tekstNoekkel: string): { noekkel: string; mottaker?: string } | null => {
    const leddNavn = (i: number): string | undefined => ledd[i]?.navn;
    const fb = (k: string) => t(k);
    switch (tekstNoekkel) {
      case "handling.send":
        return {
          noekkel: "flythjelp.handling.send",
          mottaker: videresendValg.length === 1 ? videresendValg[0]?.visningsnavn : fb("flythjelp.fallback.nesteMottaker"),
        };
      case "handling.slett":
        // Fiks 2 (klikktest): F0 soft-delete = papirkurv i 90 dager, ikke «permanent».
        // slettKladd/slettTrukket beholdes som relikvier (fjernes i konsoliderings-oppryddingen).
        return { noekkel: "flythjelp.handling.slett" };
      case "statushandling.trekkTilbake":
        // Retning: henter dokumentet FRA den du sendte til (ikke avsenderen) → mottakerDin.
        return {
          noekkel: "flythjelp.handling.trekkTilbake",
          mottaker: finnMottakerNavn(flytMedlemmer ?? [], recipientUserId, recipientGroupId) ?? fb("flythjelp.fallback.mottakerDin"),
        };
      case "statushandling.besvar":
        return erSisteBoks
          ? { noekkel: "flythjelp.handling.besvarSisteLedd" }
          : { noekkel: "flythjelp.handling.besvar", mottaker: leddNavn(aktivtIndex - 1) ?? fb("flythjelp.fallback.avsender") };
      case "handling.avvis":
        return { noekkel: "flythjelp.handling.avvis", mottaker: leddNavn(aktivtIndex - 1) ?? fb("flythjelp.fallback.avsender") };
      case "handling.godkjenn":
        return { noekkel: "flythjelp.handling.godkjenn" };
      case "statushandling.sendTilbakeUtforer":
        return { noekkel: "flythjelp.handling.sendTilbakeUtforer", mottaker: leddNavn(aktivtIndex - 1) ?? fb("flythjelp.fallback.utforer") };
      case "statushandling.sendPaaNytt":
        return { noekkel: "flythjelp.handling.sendPaaNytt", mottaker: leddNavn(aktivtIndex + 1) ?? fb("flythjelp.fallback.nesteMottaker") };
      case "handling.lukk":
        return { noekkel: "flythjelp.handling.lukk" };
      case "statushandling.gjenapne":
        return { noekkel: "flythjelp.handling.gjenapne" };
      case "statushandling.videresend":
        return { noekkel: "flythjelp.handling.videresend", mottaker: fb("flythjelp.fallback.videresendMottaker") };
      default:
        return null;
    }
  };

  // Bygger { tittel, tekst } for hover/inline. Tittel = «Handling → Ny status» (delt mønster med matrisen).
  const mikrotekst = (tekstNoekkel: string, nyStatus: string, label: string): { tittel: string; tekst: string } | undefined => {
    const f = flythjelpFor(tekstNoekkel);
    if (!f) return undefined;
    return {
      tittel: `${label} → ${t(STATUS_LABEL_NOEKKEL[nyStatus] ?? nyStatus)}`,
      tekst: flythjelpTekst(f.noekkel, f.mottaker, t),
    };
  };

  /* --- Begrunnelse for en deaktivert handling (utledet fra kilden) --- */
  const begrunnelseFor = (h: StatusHandling): string => {
    if (status === "closed") return t("statushandling.laast.lukket");
    const erMeta = h.nyStatus === "forwarded" || h.nyStatus === "deleted";
    if (!erMeta && !isValidStatusTransition(status, h.nyStatus)) return t("statushandling.laast.ugyldig");
    const eiere = hentHandlingEierRoller(status, h.nyStatus);
    if (eiere.length === 0) return t("statushandling.laast.admin");
    const r = eiere[0];
    return t(
      r === "bestiller"
        ? "statushandling.laast.avsender"
        : r === "utforer"
          ? "statushandling.laast.utforer"
          : "statushandling.laast.godkjenner",
    );
  };

  /* ------------------------------------------------------------------ */
  /*  Bygg oppføringer fra kilden                                        */
  /* ------------------------------------------------------------------ */

  // Primærhandling: kildens `erPrimaer`, ellers promoteres første aktive handling.
  // P3 (fabel-ordre § 1): ingen flate sekundærknapper — en status uten erPrimaer for
  // rollen (f.eks. received×godkjenner = kun Godkjenn) viser den som primærknapp, ikke
  // som løs knapp ved siden av. Alt annet lovlig samles bak primærens split-▾.
  const primærHandling = aktive.find((h) => h.erPrimaer) ?? aktive[0] ?? null;

  // Steg 4c (fabel-design 2): «Send til N · X →» (måll-leddets nummer + hvem) / «Godkjenn og
  // fullfør ✓» ved siste ledд (Send fra siste = no-op → primær blir Godkjenn). Ellers standard-tekst.
  const nesteLeddBoks = aktivtIndex >= 0 ? ledd[aktivtIndex + 1] : undefined;
  const effektivPrimær =
    primærHandling?.nyStatus === "sent" && !nesteLeddBoks
      ? aktive.find((h) => h.nyStatus === "approved") ?? primærHandling
      : primærHandling;
  const sisteLeddGodkjenn = effektivPrimær !== primærHandling && effektivPrimær?.nyStatus === "approved";
  const primærLabel: string = !effektivPrimær
    ? ""
    : effektivPrimær.nyStatus === "sent" && nesteLeddBoks
      ? t("flyt.sendTil", { navn: `${nesteLeddBoks.posisjon} · ${nesteLeddBoks.aktivNavn}` })
      : sisteLeddGodkjenn
        ? t("flyt.godkjennOgFullfor")
        : t(effektivPrimær.tekstNoekkel);

  // Recipient-oppføringer (draft-send eller videresend) fra en valg-liste.
  // Draft-send bruker full `videresendValg`; videresend-stien sender inn den
  // medlemskaps-filtrerte lista (H3).
  const recipientOppforinger = (
    nyStatus: string,
    prefix: string,
    tekstNoekkel: string,
    kilde: typeof videresendValg = videresendValg,
  ): MenyOppforing[] =>
    kilde.map((v) => ({
      key: `${prefix}-${v.key}`,
      label: v.visningsnavn,
      nyStatus,
      tekstNoekkel,
      mottaker: v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : { dokumentflytId: v.dokumentflytId },
      plassering: "send" as const,
      medlemmer: v.medlemmer,
    }));

  // Mottaker-lister: draft → send til faggruppe (førstegangs, ØVERST som framover-utvidelse);
  // ellers → Videresend (forwarded, EGEN seksjon etter destruktive). Gjensidig utelukkende.
  //
  // Posisjonsmodell (fabel-vedtatt): et FLYT-BUNDET utkast (harFlyt) ruter Send via `nesteLedd`
  // — server `beregnRuting` ignorerer klient-mottaker for `sent` og bruker aktivPosisjon. Den
  // manuelle mottakervelgeren er derfor både obsolet OG villedende der (valget kastes). Behold
  // den KUN for flyt-løse utkast (ad-hoc, ingen posisjon), der mottaker-valget binder flyten.
  const draftSend = status === "draft" && primærHandling?.nyStatus === "sent" && !harFlyt;
  const forwardedHandling = aktive.find((h) => h.nyStatus === "forwarded" && h !== primærHandling);
  const harForwarded = forwardedHandling != null;
  // Draft-mottakere vises kun ved >1 mottaker — primærknappen håndterer 0/1 direkte (klikkPrimær).
  const draftMottakerOppforinger: MenyOppforing[] =
    draftSend && videresendValg.length > 1
      ? recipientOppforinger("sent", "send", primærHandling!.tekstNoekkel)
      : [];
  const videresendOppforinger: MenyOppforing[] =
    !draftSend && harForwarded
      ? recipientOppforinger("forwarded", "fwd", forwardedHandling.tekstNoekkel, videresendMottakere)
      : [];

  // Øvrige statushandlinger (ikke primær, ikke forwarded, ikke admin-status), delt i
  // framover (nøytrale) og destruktive (Avvis/Slett, rød) for fabel-rekkefølgen.
  const byggStatusOppforing = (h: StatusHandling): MenyOppforing => ({
    key: `sek-${h.nyStatus}`,
    label: t(h.tekstNoekkel),
    nyStatus: h.nyStatus,
    tekstNoekkel: h.tekstNoekkel,
    plassering: "sekundær" as const,
    // F1: Avvis (dismissed) er en danger-handling → rød, som deleted.
    erDestruktiv: h.nyStatus === "deleted" || h.nyStatus === "dismissed",
    mikro: mikrotekst(h.tekstNoekkel, h.nyStatus, t(h.tekstNoekkel)),
  });
  const øvrigeStatus = aktive.filter(
    (h) => h !== primærHandling && h.nyStatus !== "forwarded" && !ADMIN_NY.has(h.nyStatus),
  );
  const erDestruktivNy = (ns: string) => ns === "deleted" || ns === "dismissed";
  const framoverOppforinger = øvrigeStatus.filter((h) => !erDestruktivNy(h.nyStatus)).map(byggStatusOppforing);
  const destruktivOppforinger = øvrigeStatus.filter((h) => erDestruktivNy(h.nyStatus)).map(byggStatusOppforing);

  // Admin-seksjon: aktive admin-status som IKKE er primær (Lukk/Trekk tilbake/Gjenåpne når sekundær)
  const adminOppforinger: MenyOppforing[] = aktive
    .filter((h) => h !== primærHandling && ADMIN_NY.has(h.nyStatus) && h.nyStatus !== "forwarded")
    .map((h) => ({
      key: `adm-${h.nyStatus}`,
      label: t(h.tekstNoekkel),
      nyStatus: h.nyStatus,
      tekstNoekkel: h.tekstNoekkel,
      plassering: "overflow" as const,
      erDestruktiv: h.nyStatus === "cancelled",
      mikro: mikrotekst(h.tekstNoekkel, h.nyStatus, t(h.tekstNoekkel)),
    }));

  // Deaktiverte: finnes i universet, men ikke tilgjengelig for denne rollen/statusen
  const aktiveNy = new Set(aktive.map((h) => h.nyStatus));
  const deaktiverteOppforinger: MenyOppforing[] = alle
    .filter((h) => !aktiveNy.has(h.nyStatus))
    .map((h) => ({
      key: `deakt-${h.nyStatus}`,
      label: t(h.tekstNoekkel),
      nyStatus: h.nyStatus,
      tekstNoekkel: h.tekstNoekkel,
      plassering: "deaktivert" as const,
      begrunnelse: begrunnelseFor(h),
    }));

  // Øvrige LOVLIGE handlinger (alt utenom primær som kan utføres) styrer split-▾ (fabel § 1).
  const aktiveØvrige =
    draftMottakerOppforinger.length +
    framoverOppforinger.length +
    destruktivOppforinger.length +
    videresendOppforinger.length +
    adminOppforinger.length;
  // Split vises kun ved primær + ≥1 øvrig lovlig. Deaktiverte alene utløser IKKE split
  // (received×godkjenner = «Godkjenn uten split»); de vises som info NÅR menyen åpnes.
  const harØvrige = aktiveØvrige > 0;
  const menyHarInnhold = harØvrige || deaktiverteOppforinger.length > 0;

  /* ------------------------------------------------------------------ */
  /*  Handlinger                                                         */
  /* ------------------------------------------------------------------ */

  // P3 (cowork-tillegg): utkast slettes i ett trykk — soft-delete = papirkurv 90 dager er
  // sikringen. `closed` og øvrige `deleted` (cancelled→deleted) beholder bekreft-baren.
  const trengerBekreft = (nyStatus: string) =>
    nyStatus === "closed" || (nyStatus === "deleted" && status !== "draft");

  const utfor = (nyStatus: string, tekstNoekkel: string, mottaker?: Mottaker) => {
    if (nyStatus === "deleted") {
      onSlett?.();
    } else {
      onEndreStatus(nyStatus, tekstNoekkel, kommentar.trim() || undefined, mottaker);
    }
    setBekreft(null);
    setKommentar("");
    setVisKommentar(false);
    setÅpenMeny(false);
  };

  const klikk = (o: { nyStatus: string; tekstNoekkel: string; mottaker?: Mottaker; label: string }) => {
    setÅpenMeny(false);
    const erBekreft = trengerBekreft(o.nyStatus);
    const erNudge = NUDGE_TEKSTNOEKLER.has(o.tekstNoekkel);
    // P2: en handling som krever begrunnelse (Besvar/Send tilbake/Avvis) må åpne
    // bekreftelses-dialogen med påkrevd kommentar — aldri fyre direkte mot serveren.
    const krevBegrunnelse = statusKreverBegrunnelse(o.nyStatus);
    if (erBekreft || erNudge || krevBegrunnelse) {
      setBekreft({ nyStatus: o.nyStatus, tekstNoekkel: o.tekstNoekkel, mottaker: o.mottaker, label: o.label, nudge: (erNudge || krevBegrunnelse) && !erBekreft });
      return;
    }
    utfor(o.nyStatus, o.tekstNoekkel, o.mottaker);
  };

  // P2 (tom-besvarelse): «Besvar» blokkeres når besvarelsen er tom. Speiler
  // server-guarden — UI viser aldri en handling serveren avviser.
  const besvarBlokkert = !!besvarDeaktivertGrunn && primærHandling?.nyStatus === "responded";

  // Primærknapp-klikk: draft-send med flere mottakere → åpne nedtrekk; ellers utfør
  const klikkPrimær = () => {
    if (!primærHandling || besvarBlokkert) return;
    if (draftSend) {
      const v = videresendValg[0];
      if (videresendValg.length === 1 && v) {
        utfor("sent", primærHandling.tekstNoekkel, v.mottaker ? { ...v.mottaker, dokumentflytId: v.dokumentflytId } : undefined);
      } else if (videresendValg.length === 0) {
        utfor("sent", primærHandling.tekstNoekkel); // ingen flyt → server utleder
      } else {
        setÅpenMeny((å) => !å);
      }
      return;
    }
    // Steg 4c: bruk effektivPrimær (siste ledд: Send erstattet av Godkjenn) + komponert label.
    const handling = effektivPrimær ?? primærHandling;
    const mottaker = handling.nyStatus === "responded" ? (erSisteBoks ? undefined : mottakerForStandard()) : undefined;
    klikk({ nyStatus: handling.nyStatus, tekstNoekkel: handling.tekstNoekkel, mottaker, label: primærLabel });
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  // Lesevisning — bruker uten rolle i en flyt
  if (minRolle === null && harFlyt) {
    return <span className="text-xs text-gray-400 italic">{t("bunnbar.lesevisning")}</span>;
  }

  // Ingenting å vise (f.eks. terminal `closed` uten deaktiverte)
  if (!primærHandling && !menyHarInnhold) {
    return null;
  }

  // Bekreftelse-modus (kun closed/deleted)
  if (bekreft) {
    const erTrekkTilbake = bekreft.nyStatus === "cancelled";
    const mottakerHarLest = erTrekkTilbake && lestAvMottakerVed != null;
    // F1 (gate-JA #2): Avvis (dismissed) krever en ikke-tom begrunnelse — blokker send til
    // feltet er fylt. Speiler server-Zod-gaten (statusKreverBegrunnelse), samme delte kilde.
    const paakrevd = statusKreverBegrunnelse(bekreft.nyStatus);
    const manglerBegrunnelse = paakrevd && kommentar.trim().length === 0;
    // Nudge (Del 2.5): oppfordrer til begrunnelse ved retur, men krever den ikke.
    // Påkrevd (F1): egen overskrift som gjør tvangen tydelig.
    const overskrift = paakrevd
      ? t("statushandling.begrunnelsePaakrevd")
      : bekreft.nudge
      ? t("statushandling.begrunnelseRetur")
      : t("statushandling.bekreftHandling", { handling: bekreft.label });
    // Konsekvensen vises INLINE i bekreft/nudge-modus (§ 3a: skal ikke gjemmes bak hover).
    const bekreftMikro = mikrotekst(bekreft.tekstNoekkel, bekreft.nyStatus, bekreft.label);
    return (
      <div className="flex w-full flex-col gap-1">
        {bekreftMikro && <span className="text-xs text-gray-500">{bekreftMikro.tekst}</span>}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
        {mottakerHarLest && (
          <span className="text-xs text-amber-600 font-medium shrink-0">{t("statushandling.mottakerHarLest")}</span>
        )}
        <span className={`text-sm shrink-0 ${bekreft.nudge || paakrevd ? "text-amber-700 font-medium" : "text-gray-500"}`}>
          {overskrift}
        </span>
        <input
          type="text"
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !manglerBegrunnelse) utfor(bekreft.nyStatus, bekreft.tekstNoekkel, bekreft.mottaker); }}
          placeholder={bekreft.nudge || paakrevd ? t("statushandling.begrunnelsePlaceholder") : t("statushandling.valgfriKommentar")}
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none w-full sm:w-56"
          autoFocus
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => utfor(bekreft.nyStatus, bekreft.tekstNoekkel, bekreft.mottaker)}
            disabled={erLaster || manglerBegrunnelse}
            className="rounded-lg bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {erLaster ? t("statushandling.endrer") : bekreft.nudge || paakrevd ? bekreft.label : t("handling.bekreft")}
          </button>
          <button
            onClick={() => { setBekreft(null); setKommentar(""); }}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {t("handling.avbryt")}
          </button>
        </div>
        </div>
      </div>
    );
  }

  const primærFarge = primærHandling ? FARGE_KLASSE[primærHandling.farge] ?? "bg-sitedoc-primary hover:bg-blue-700" : "";
  const primærMikro = primærHandling ? mikrotekst(primærHandling.tekstNoekkel, primærHandling.nyStatus, t(primærHandling.tekstNoekkel)) : undefined;
  // P2: når Besvar er blokkert (tom besvarelse), vis blokkerings-grunnen i tooltipen
  // framfor den vanlige flythjelp-mikroteksten.
  const primærTooltip = besvarBlokkert && primærHandling
    ? { tittel: t(primærHandling.tekstNoekkel), tekst: besvarDeaktivertGrunn! }
    : primærMikro;

  // Splittkanten (rounded-l) på primærknappen når split-▾ vises.
  const primærRund = harØvrige ? "rounded-l-lg" : "rounded-lg";
  const primærKnappKlasse = `px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${primærRund} ${primærFarge}`;

  const meny = (
    <DropdownMeny
      draftMottaker={draftMottakerOppforinger}
      framover={framoverOppforinger}
      destruktiv={destruktivOppforinger}
      videresend={videresendOppforinger}
      admin={adminOppforinger}
      deaktivert={deaktiverteOppforinger}
      onVelg={klikk}
      sendLabel={t("statushandling.sendVidereTil")}
      videresendLabel={t("statushandling.videresend")}
      adminLabel={t("statushandling.admin")}
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-2" ref={menyRef}>
      {/* Primærhandling som knapp + split-▾ (fabel § 1: alle øvrige lovlige handlinger i menyen) */}
      {primærHandling && (
        <div className="relative flex">
          {primærTooltip ? (
            <Tooltip tittel={primærTooltip.tittel} tekst={primærTooltip.tekst} side="top">
              <button
                data-testid={`handling-${primærHandling.nyStatus}`}
                onClick={klikkPrimær}
                disabled={erLaster || besvarBlokkert}
                className={primærKnappKlasse}
              >
                {erLaster ? t("statushandling.endrer") : primærLabel}
              </button>
            </Tooltip>
          ) : (
            <button
              data-testid={`handling-${primærHandling.nyStatus}`}
              onClick={klikkPrimær}
              disabled={erLaster || besvarBlokkert}
              className={primærKnappKlasse}
            >
              {erLaster ? t("statushandling.endrer") : t(primærHandling.tekstNoekkel)}
            </button>
          )}
          {harØvrige && (
            <button
              data-testid="handling-split-nedtrekk"
              aria-label={t("statushandling.flereHandlinger")}
              onClick={() => setÅpenMeny((å) => !å)}
              disabled={erLaster}
              className={`rounded-r-lg border-l border-white/30 px-1.5 py-1.5 text-white disabled:opacity-50 ${primærFarge}`}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
          {åpenMeny && menyHarInnhold && meny}
        </div>
      )}

      {/* Uten primærhandling (ikke-eier): alt lovlig/deaktivert bak én ▾ */}
      {!primærHandling && menyHarInnhold && (
        <div className="relative">
          <button
            data-testid="handling-admin-nedtrekk"
            onClick={() => setÅpenMeny((å) => !å)}
            disabled={erLaster}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("statushandling.flereHandlinger")}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {åpenMeny && meny}
        </div>
      )}

      {/* Kommentar-utvider — alltid tilgjengelig, aldri påkrevd */}
      {(primærHandling || harØvrige) && (
        visKommentar ? (
          <input
            type="text"
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            placeholder={t("statushandling.valgfriKommentar")}
            className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none w-40"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setVisKommentar(true)}
            className="flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"
          >
            <Plus className="h-3 w-3" />
            {t("statushandling.leggTilKommentar")}
          </button>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Nedtrekk                                                            */
/* ------------------------------------------------------------------ */

function DropdownMeny({
  draftMottaker,
  framover,
  destruktiv,
  videresend,
  admin,
  deaktivert,
  onVelg,
  sendLabel,
  videresendLabel,
  adminLabel,
}: {
  /** Draft-send: mottaker-liste (person-velger), øverst som framover-utvidelse */
  draftMottaker: MenyOppforing[];
  /** Framover-handlinger (nøytrale statushandlinger) */
  framover: MenyOppforing[];
  /** Destruktive handlinger (Avvis/Slett — rød) */
  destruktiv: MenyOppforing[];
  /** Videresend: mottaker-liste (person-velger), etter destruktive */
  videresend: MenyOppforing[];
  /** Admin-overstyringer (Lukk/Trekk tilbake/Gjenåpne-når-sekundær) */
  admin: MenyOppforing[];
  /** Deaktiverte (gjennomstrøket, med begrunnelse) */
  deaktivert: MenyOppforing[];
  onVelg: (o: MenyOppforing) => void;
  sendLabel: string;
  videresendLabel: string;
  adminLabel: string;
}) {
  const { t } = useTranslation();
  // Person-videresending (Del 2.4): hvilke faggruppe-rader er ekspandert.
  const [ekspandert, setEkspandert] = useState<Set<string>>(new Set());
  const veksle = (key: string) =>
    setEkspandert((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  // Seksjonsoverskrift (10px uppercase)
  const overskrift = (tekst: string) => (
    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{tekst}</div>
  );

  // Statushandling-rad (framover/destruktiv/admin): rød ved erDestruktiv, mikro-hover.
  const statusRad = (o: MenyOppforing) => {
    const knapp = (
      <button
        key={o.key}
        data-testid={`handling-${o.nyStatus}`}
        onClick={() => onVelg(o)}
        className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-50 ${
          o.erDestruktiv ? "text-red-600" : "text-gray-700"
        }`}
      >
        {o.label}
      </button>
    );
    return o.mikro ? (
      <Tooltip key={o.key} tittel={o.mikro.tittel} tekst={o.mikro.tekst} side="left" wrapperClassName="relative block w-full">
        {knapp}
      </Tooltip>
    ) : (
      knapp
    );
  };

  // Mottaker-rad (draft-send/videresend): person-velger-ekspansjon via medlemmer.
  const mottakerRad = (o: MenyOppforing) => {
    const harMedlemmer = (o.medlemmer?.length ?? 0) > 0;
    const erÅpen = ekspandert.has(o.key);
    return (
      <div key={o.key}>
        <div className="flex w-full items-center">
          <button
            onClick={() => onVelg(o)}
            className="flex flex-1 items-center px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            {o.label}
          </button>
          {harMedlemmer && (
            <button
              onClick={() => veksle(o.key)}
              aria-label={t("statushandling.velgPerson")}
              className="px-2 py-2 text-gray-400 hover:text-gray-600"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${erÅpen ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
        {/* Kollapset person-liste: send til spesifikk person i mottaker-flyten */}
        {harMedlemmer && erÅpen && (
          <div className="bg-gray-50/60">
            {o.medlemmer!.map((m) => (
              <button
                key={`${o.key}-${m.key}`}
                onClick={() =>
                  onVelg({
                    ...o,
                    key: `${o.key}-${m.key}`,
                    label: m.navn,
                    mottaker: { ...m.mottaker, dokumentflytId: o.mottaker?.dokumentflytId },
                    medlemmer: undefined,
                  })
                }
                className="flex w-full items-center gap-2 py-1.5 pl-7 pr-3 text-left text-sm text-gray-600 hover:bg-gray-100"
              >
                <span className="truncate">{m.navn}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Skille-linje mellom to ikke-tomme seksjoner.
  let harTidligere = false;
  const skille = (harInnhold: boolean) => {
    const vis = harInnhold && harTidligere;
    if (harInnhold) harTidligere = true;
    return vis ? <div className="my-1 border-t border-gray-100" /> : null;
  };

  // Fabel-rekkefølge: (draft-mottakere →) framover → destruktiv → Videresend → Admin → deaktiverte.
  return (
    <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
      {draftMottaker.length > 0 && (
        <>
          {skille(true)}
          {overskrift(sendLabel)}
          {draftMottaker.map(mottakerRad)}
        </>
      )}

      {framover.length > 0 && (
        <>
          {skille(true)}
          {framover.map(statusRad)}
        </>
      )}

      {destruktiv.length > 0 && (
        <>
          {skille(true)}
          {destruktiv.map(statusRad)}
        </>
      )}

      {videresend.length > 0 && (
        <>
          {skille(true)}
          {overskrift(videresendLabel)}
          {videresend.map(mottakerRad)}
        </>
      )}

      {admin.length > 0 && (
        <>
          {skille(true)}
          {overskrift(adminLabel)}
          {admin.map(statusRad)}
        </>
      )}

      {deaktivert.length > 0 && (
        <>
          {skille(true)}
          {deaktivert.map((o) => (
            // Begrunnelsen flyttet fra nativ title= til Tooltip v2 (usynlig på mobil ellers — § 2-sweep).
            <Tooltip key={o.key} tekst={o.begrunnelse ?? ""} side="left" wrapperClassName="relative block w-full">
              <div className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm text-gray-300">
                <span className="line-through">{o.label}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">{o.begrunnelse}</span>
              </div>
            </Tooltip>
          ))}
        </>
      )}
    </div>
  );
}
