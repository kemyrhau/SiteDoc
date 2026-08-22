"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal, Select, Button } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { byggOpprettInput } from "@/lib/opprettFraTegning";

interface DokumentflytMal {
  template: { id: string; name: string; category: string };
}

interface DokumentflytRad {
  id: string;
  name: string;
  faggruppeId: string | null;
  maler: DokumentflytMal[];
}

interface OpprettOppgaveModalProps {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  sjekklisteId: string;
  sjekklisteFeltId: string;
  sjekklisteNummer?: string | null;
  feltLabel?: string;
  /**
   * Sjekklistens egen dokumentflyt (steg 1, oppgave-fra-rad-sporet 2026-08-22): oppgaven ARVER
   * DENNE flyten — flyt-id-en velges og sendes, faggruppene leses ut av flyten (bindende vedtak
   * `domene-arbeidsflyt.md`: dokumentflyten er nøkkelen, faggruppe er avledet). Null → sjekklisten
   * er FLYT-LØS (se fallback-forklaringen ved `harSjekklisteFlyt` under).
   */
  sjekklisteFlytId?: string | null;
  /**
   * Forhåndsutfylt tegnings-posisjon (rad-oppgaver): radens egen `drawing_position` ?? dokumentets
   * lokasjon. Sendes videre til oppgaven ved opprettelse. Utelatt/null → ingen posisjon.
   */
  forhandsPosisjon?: { drawingId?: string | null; positionX?: number | null; positionY?: number | null } | null;
}

export function OpprettOppgaveModal({
  open,
  onClose,
  prosjektId,
  sjekklisteId,
  sjekklisteFeltId,
  sjekklisteNummer,
  feltLabel,
  sjekklisteFlytId,
  forhandsPosisjon,
}: OpprettOppgaveModalProps) {
  const utils = trpc.useUtils();

  // Steg 1 (oppgave-fra-rad): velgeren kollapser til ÉN ting — hvilken oppgavemal i flyten.
  // Ingen faggruppe-valg: faggruppen er en egenskap ved flyten (`byggOpprettInput` leser den ut).
  const [valgtMal, setValgtMal] = useState("");
  // Kun brukt i FLYT-LØS-fallbacken: hvilken flyt oppgaven skal følge (sjekklisten mangler en å arve).
  const [valgtFlyt, setValgtFlyt] = useState("");

  const { data: arbeidsforlop } = trpc.dokumentflyt.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );
  const { data: mineOpprettFlyter } = trpc.medlem.hentMineOpprettFlyter.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );
  const { data: alleMaler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );

  const alleArbeidsforlop = (arbeidsforlop ?? []) as unknown as DokumentflytRad[];
  const alleMalerTypet = (alleMaler ?? []) as Array<{ id: string; name: string; category: string; domain: string | null }>;
  // HMS-maler er FLYT-UAVHENGIGE (serveren auto-ruter til HMS-flyten og FORBYR klient-sendt
  // dokumentflytId). Deteksjon på domain, ikke category — jf. tegning-dialogen.
  const hmsMalIder = useMemo(
    () => new Set(alleMalerTypet.filter((m) => m.domain === "hms").map((m) => m.id)),
    [alleMalerTypet],
  );

  // Har sjekklisten en flyt å arve?
  //
  // En sjekkliste blir FLYT-LØS (`dokumentflytId = null`) på tre kjente måter — dette er en reell,
  // server-støttet tilstand (`DokumentHandlingsmeny`: serveren bypasser `verifiserFlytRolle` for
  // flyt-løse dokumenter), ikke en umulig kant:
  //   (a) flyten ble slettet — `Checklist.dokumentflyt` har `onDelete: SetNull` (schema.prisma:1084),
  //       så sletting nullstiller feltet på alle dokumenter som pekte på flyten.
  //   (b) HMS i et prosjekt uten konfigurert HMS-flyt — F1b graceful degradering (flyt-løst).
  //   (c) dokumenter fra FØR flyt-bindingen ble innført (regresjon `5573ccd2`, 24.07).
  //
  // MAIN: arv sjekklistens flyt (`.find` på `af.id` = RIKTIG nøkkel — ikke faggruppe-gjetningen
  //       vedtaket forbyr). FALLBACK: la brukeren velge flyten (ikke faggruppe) — et ærlig fravær
  //       av flyt, ikke en `.find(faggruppeId)`-gjetning.
  const harSjekklisteFlyt = !!sjekklisteFlytId;
  const mineOpprettFlytIder = new Set(mineOpprettFlyter ?? []);
  const opprettFlyter = alleArbeidsforlop.filter((af) => mineOpprettFlytIder.has(af.id));

  const valgtFlytObjekt = harSjekklisteFlyt
    ? alleArbeidsforlop.find((af) => af.id === sjekklisteFlytId) ?? null
    : opprettFlyter.find((af) => af.id === valgtFlyt) ?? null;

  // Fallback-flyter brukeren kan opprette i, som har minst én oppgavemal (tom flyt er ikke et valg).
  const flytAlternativer = useMemo(
    () =>
      opprettFlyter
        .filter((af) => af.maler.some((wt) => wt.template.category === "oppgave" && !hmsMalIder.has(wt.template.id)))
        .map((af) => ({ value: af.id, label: af.name })),
    [opprettFlyter, hmsMalIder],
  );

  // Mal-liste: den EFFEKTIVE flytens oppgavemaler (main = sjekklistens flyt, fallback = valgt flyt).
  // Tom liste er en HOVEDSTI (en flyt trenger ikke ha oppgavemaler) → deaktivert knapp. Steg 2
  // legger malbygger-CTA-en; ikke her.
  const malAlternativer = useMemo(
    () =>
      valgtFlytObjekt
        ? valgtFlytObjekt.maler
            .filter((wt) => wt.template.category === "oppgave" && !hmsMalIder.has(wt.template.id))
            .map((wt) => ({ value: wt.template.id, label: wt.template.name }))
        : [],
    [valgtFlytObjekt, hmsMalIder],
  );

  // Auto-velg flyt i fallback når nøyaktig én er mulig; rydd stale valg.
  useEffect(() => {
    if (!open || harSjekklisteFlyt) return;
    const gyldig = flytAlternativer.some((f) => f.value === valgtFlyt);
    if (valgtFlyt && !gyldig) setValgtFlyt("");
    else if (!valgtFlyt && flytAlternativer.length === 1) setValgtFlyt(flytAlternativer[0]!.value);
  }, [open, harSjekklisteFlyt, flytAlternativer, valgtFlyt]);

  // Rydd stale mal-valg når den effektive flyten ikke lenger tilbyr den.
  useEffect(() => {
    if (valgtMal && !malAlternativer.some((m) => m.value === valgtMal)) setValgtMal("");
  }, [malAlternativer, valgtMal]);

  // Funn 2 (2026-08-22): forhåndsvelg malen når det finnes NØYAKTIG ÉN — brukeren skal slippe å
  // velge fra en liste med ett element. Nedtrekket beholdes for to+ maler.
  useEffect(() => {
    if (open && !valgtMal && malAlternativer.length === 1) setValgtMal(malAlternativer[0]!.value);
  }, [open, valgtMal, malAlternativer]);

  // Reset state ved lukking
  useEffect(() => {
    if (!open) {
      setValgtMal("");
      setValgtFlyt("");
    }
  }, [open]);

  // Auto-tittel
  const tittel = useMemo(() => {
    const deler: string[] = [];
    if (sjekklisteNummer) deler.push(sjekklisteNummer);
    if (feltLabel) deler.push(feltLabel);
    return deler.length > 0 ? `Oppgave fra ${deler.join(": ")}` : "Ny oppgave";
  }, [sjekklisteNummer, feltLabel]);

  const opprettMutation = trpc.oppgave.opprett.useMutation({
    onSuccess: () => {
      utils.oppgave.hentForSjekkliste.invalidate({ checklistId: sjekklisteId });
      onClose();
    },
  });

  const erHms = valgtMal ? hmsMalIder.has(valgtMal) : false;
  // Ikke-HMS krever en flyt (kilde til dokumentflytId + faggruppe). HMS: serveren auto-ruter.
  const kanOpprette = !!valgtMal && (erHms || !!valgtFlytObjekt);

  function handleOpprett(e: React.FormEvent) {
    e.preventDefault();
    if (!kanOpprette) return;

    // Flyt-id + faggrupper leses ut av flyten (bestiller = utfører = flytens faggruppe). HMS → {}.
    const flytInput = byggOpprettInput(erHms, valgtFlytObjekt);

    opprettMutation.mutate({
      templateId: valgtMal,
      ...flytInput,
      title: tittel,
      checklistId: sjekklisteId,
      checklistFieldId: sjekklisteFeltId,
      // Forhåndsposisjon (rad-oppgaver): kun når en tegning er kjent. positionX/Y følger med
      // hvis satt (dokument-fallback kan ha tegning uten punkt).
      ...(forhandsPosisjon?.drawingId
        ? {
            drawingId: forhandsPosisjon.drawingId,
            ...(forhandsPosisjon.positionX != null ? { positionX: forhandsPosisjon.positionX } : {}),
            ...(forhandsPosisjon.positionY != null ? { positionY: forhandsPosisjon.positionY } : {}),
          }
        : {}),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Opprett oppgave fra felt">
      <form onSubmit={handleOpprett} className="flex flex-col gap-4">
        {/* FLYT-LØS fallback: si HVA tilstanden er (mikrotekst-standard) før vi ber om ekstra valg —
            ellers ser skjemaet ut som en tilfeldig annen variant. */}
        {!harSjekklisteFlyt && (
          <>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Denne sjekklisten er ikke knyttet til en dokumentflyt, så du må velge hvilken flyt
              oppgaven skal følge.
            </p>
            <Select
              label="Dokumentflyt"
              value={valgtFlyt}
              onChange={(e) => {
                setValgtFlyt(e.target.value);
                setValgtMal("");
              }}
              options={flytAlternativer}
              placeholder="Velg dokumentflyt"
            />
          </>
        )}

        <Select
          label="Oppgavemal"
          value={valgtMal}
          onChange={(e) => setValgtMal(e.target.value)}
          options={malAlternativer}
          placeholder="Velg mal"
        />

        <p className="text-sm text-gray-500">Tittel: {tittel}</p>

        <Button type="submit" disabled={!kanOpprette} loading={opprettMutation.isPending}>
          Opprett oppgave
        </Button>
      </form>
    </Modal>
  );
}
