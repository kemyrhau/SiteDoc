"use client";

/**
 * OpprettKontaktModal — forent søkemodal (vei B, fabel 2026-09-09).
 *
 * ÉN modal, ett søkefelt. Søket FILTRERER ALDRI til tomhet: det går mot alle
 * kontakter i prosjektet + firmaets folk, og hver treff-rad bærer sin egen tilstand:
 *   - allerede i målet (gruppe/prosjekt) → nedtonet, «Er alt medlem» / «Er alt kontakt»
 *   - kontakt utenfor målet             → «Legg til» (én binding)
 *   - ingen treff                        → «Inviter {tekst} med e-post …» åpner feltene
 *
 * Kontekst styrer KUN tittel + forhåndsvalg (låst gruppe). Felt, søkelogikk og
 * radtilstander er identiske i begge kontekster. Erstatter toggle-modellen
 * (ny-person/fra-firma) som produserte tom-liste-bugen: to lister med motsatt
 * filter i samme modal.
 *
 * Hele registreringen går gjennom ÉN atomisk prosedyre (`medlem.registrer`,
 * registreringsmodell fase 1): finn/opprett person + prosjektmedlem + faggruppe +
 * valgfri brukergruppe. Fra-kontaktene sender `userId` → eksakt oppslag (B.7).
 * Flyt-plassering bor IKKE her lenger (fabel §3 / § 4-vedtak) — den legges til fra
 * personkortet.
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import { Plus, Search, UserPlus } from "lucide-react";

const FARGE_DOT: Record<string, string> = {
  red: "bg-red-500", orange: "bg-orange-500", amber: "bg-amber-500",
  yellow: "bg-yellow-500", lime: "bg-lime-500", green: "bg-green-500",
  emerald: "bg-emerald-500", teal: "bg-teal-500", cyan: "bg-cyan-500",
  sky: "bg-sky-500", blue: "bg-blue-500", indigo: "bg-indigo-500",
  violet: "bg-violet-500", purple: "bg-purple-500", fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500", rose: "bg-rose-500", slate: "bg-slate-500",
};

export interface FaggruppeForModal {
  id: string;
  name: string;
  color: string | null;
}

/**
 * Én søkbar kandidat — union av prosjektets kontakter og firmaets ledige folk.
 * `userId` mates til `medlem.registrer` for eksakt oppslag. `alleredeITarget` avgjør
 * radtilstanden: true → nedtonet «er alt med», false → «Legg til».
 */
export interface KandidatForModal {
  userId: string;
  navn: string | null;
  epost: string;
  alleredeITarget: boolean;
}

const EPOST_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OpprettKontaktModal({
  open,
  onClose,
  prosjektId,
  kontekst,
  kandidater,
  faggrupper,
  gruppeId,
  gruppeNavn,
  tittel,
  onFerdig,
}: {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  // «gruppe» = legg til medlem i en brukergruppe (gruppe forhåndsvalgt + låst).
  // «kontakt» = ny kontakt i prosjektet.
  kontekst: "gruppe" | "kontakt";
  kandidater: KandidatForModal[];
  faggrupper: FaggruppeForModal[];
  // Gruppe-kontekst: målgruppen bindingen skal lande i (låst fra konteksten).
  gruppeId?: string;
  gruppeNavn?: string;
  // Overstyr modal-tittelen (f.eks. «Legg til medlem i {gruppe}»).
  tittel?: string;
  // Navn + projectMemberId på den nettopp registrerte personen sendes med, slik at
  // forslagsstripa kan navngi den og åpne personkortet. Undefined hvis ukjent.
  onFerdig: (navn?: string, projectMemberId?: string) => void;
}) {
  const { t } = useTranslation();

  const [sok, setSok] = useState("");
  const [inviterAapen, setInviterAapen] = useState(false);
  const [navn, setNavn] = useState("");
  const [epost, setEpost] = useState("");
  const [faggruppeId, setFaggruppeId] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [aktivUserId, setAktivUserId] = useState<string | null>(null);

  // Nullstill ved åpning.
  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open !== forrigeOpen) {
    setForrigeOpen(open);
    if (open) {
      setSok("");
      setInviterAapen(false);
      setNavn("");
      setEpost("");
      setFaggruppeId("");
      setFeil(null);
      setAktivUserId(null);
    }
  }

  // Admin-status kjent FØR skriving: gruppe-plassering er admin-gatet server-side, så
  // vi må avvise ikke-admin i gruppe-kontekst før noe skrives — ellers halv tilstand.
  const { data: minTilgang } = trpc.gruppe.hentMinTilgang.useQuery(
    { projectId: prosjektId },
    { enabled: open },
  );
  const erAdmin = minTilgang?.erAdmin ?? false;

  const registrerMutation = trpc.medlem.registrer.useMutation();
  const sender = registrerMutation.isPending;

  const sokTrim = sok.trim();
  const sokLower = sokTrim.toLowerCase();

  // Søket narrows lista, men filtrerer aldri til tomhet: matchende rader vises alltid
  // med sin egen tilstand. Tomt søk → hele unionen.
  const treff = useMemo(() => {
    if (!sokLower) return kandidater;
    return kandidater.filter(
      (k) =>
        (k.navn ?? "").toLowerCase().includes(sokLower) ||
        k.epost.toLowerCase().includes(sokLower),
    );
  }, [kandidater, sokLower]);

  const gruppeKontekst = kontekst === "gruppe";
  const altMedLabel = gruppeKontekst ? t("kontaktside.radErAltMedlem") : t("kontaktside.radErAltKontakt");

  async function bind(args: {
    userId?: string;
    email: string;
    firstName: string;
    lastName: string;
    faggruppeIder?: string[];
    visNavn?: string;
  }) {
    setFeil(null);
    // Gruppe-binding krever full admin (som gruppe.leggTilMedlem). Avvis før skriving.
    if (gruppeKontekst && !erAdmin) {
      setFeil(t("kontaktside.kunAdminGruppe"));
      return;
    }
    try {
      const resultat = await registrerMutation.mutateAsync({
        projectId: prosjektId,
        userId: args.userId,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        role: "member",
        faggruppeIder: args.faggruppeIder ?? [],
        gruppeIder: gruppeKontekst && gruppeId ? [gruppeId] : [],
        flytBindinger: [],
      });
      onFerdig(args.visNavn, resultat?.id);
      onClose();
    } catch (e) {
      setFeil((e as Error).message);
    }
  }

  function leggTilKandidat(k: KandidatForModal) {
    setAktivUserId(k.userId);
    const deler = (k.navn ?? k.epost).trim().split(/\s+/);
    void bind({
      userId: k.userId,
      email: k.epost,
      firstName: deler[0] || k.epost,
      lastName: deler.slice(1).join(" ") || "-",
      visNavn: k.navn ?? undefined,
    });
  }

  function aapneInviter() {
    // Forhåndsutfyll fra søketeksten: e-post-lignende → e-post, ellers → navn.
    if (EPOST_RE.test(sokTrim)) {
      setEpost(sokTrim);
      setNavn("");
    } else {
      setNavn(sokTrim);
      setEpost("");
    }
    setFaggruppeId("");
    setInviterAapen(true);
  }

  function inviterMedEpost() {
    if (!navn.trim() || !epost.trim()) return;
    const deler = navn.trim().split(/\s+/);
    void bind({
      email: epost.trim(),
      firstName: deler[0] || navn.trim(),
      lastName: deler.slice(1).join(" ") || "-",
      faggruppeIder: faggruppeId ? [faggruppeId] : [],
      visNavn: navn.trim(),
    });
  }

  const kanInvitere = navn.trim() !== "" && EPOST_RE.test(epost.trim()) && !sender;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tittel ?? (gruppeKontekst ? t("kontaktside.leggTilMedlem") : t("kontaktside.nyKontakt"))}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-500">{t("kontaktside.forentHint")}</p>

        {/* Ett søkefelt — over prosjektets kontakter + firmaets folk */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={sok}
            onChange={(e) => {
              setSok(e.target.value);
              if (inviterAapen) setInviterAapen(false);
            }}
            placeholder={t("kontaktside.sokPlaceholder")}
            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        {/* Treff-liste — hver rad bærer sin egen tilstand */}
        {!inviterAapen && (
          <div className="flex max-h-64 flex-col divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
            {treff.map((k) => {
              const laster = sender && aktivUserId === k.userId;
              return (
                <div
                  key={k.userId}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
                    k.alleredeITarget ? "bg-gray-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`truncate ${k.alleredeITarget ? "text-gray-400" : "text-gray-800"}`}>
                      {k.navn ?? k.epost}
                    </div>
                    {k.navn && (
                      <div className="truncate text-xs text-gray-400">{k.epost}</div>
                    )}
                  </div>
                  {k.alleredeITarget ? (
                    <span className="shrink-0 text-xs text-gray-400">{altMedLabel}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => leggTilKandidat(k)}
                      disabled={sender || (gruppeKontekst && !erAdmin)}
                      className="shrink-0 rounded-md bg-sitedoc-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                    >
                      {laster ? `${t("handling.leggTil")}…` : t("handling.leggTil")}
                    </button>
                  )}
                </div>
              );
            })}

            {/* Ingen treff → inviter med e-post */}
            {sokTrim !== "" && treff.length === 0 && (
              <button
                type="button"
                onClick={aapneInviter}
                className="flex items-center gap-2 px-3 py-2.5 text-left text-sm text-sitedoc-primary hover:bg-blue-50"
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                {t("kontaktside.inviterMedEpost", { tekst: sokTrim })}
              </button>
            )}

            {kandidater.length === 0 && sokTrim === "" && (
              <div className="px-3 py-6 text-center text-xs text-gray-400">
                {t("kontaktside.forentTom")}
              </div>
            )}
          </div>
        )}

        {/* Alltid en vei til å invitere en ny person, uansett treff */}
        {!inviterAapen && (
          <button
            type="button"
            onClick={aapneInviter}
            className="self-start text-xs font-semibold text-sitedoc-primary hover:underline"
          >
            {t("kontaktside.inviterNyPerson")}
          </button>
        )}

        {/* Inviter-felt (åpnes ved «ingen treff» / «inviter ny person») */}
        {inviterAapen && (
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              {t("kontaktside.inviterNyPerson")}
            </span>
            <Input label={t("kontaktside.navn")} value={navn} onChange={(e) => setNavn(e.target.value)} />
            <Input
              label={t("kontaktside.epost")}
              type="email"
              placeholder="navn@firma.no"
              value={epost}
              onChange={(e) => setEpost(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">
                {t("kontaktside.velgFaggruppe")} <span className="font-normal text-gray-400">({t("kontaktside.valgfritt")})</span>
              </span>
              <div className="flex items-center gap-2">
                {faggruppeId && (
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      FARGE_DOT[faggrupper.find((f) => f.id === faggruppeId)?.color ?? ""] ?? "bg-gray-400"
                    }`}
                  />
                )}
                <select
                  value={faggruppeId}
                  onChange={(e) => setFaggruppeId(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                >
                  <option value="">{t("kontaktside.ingenFaggruppe")}</option>
                  {faggrupper.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Låst brukergruppe fra konteksten */}
        {gruppeKontekst && gruppeId && (
          <div className="flex flex-col gap-1 border-t border-gray-100 pt-3">
            <span className="text-xs font-medium text-gray-600">{t("kontaktside.tilgangsgruppe")}</span>
            <span className="inline-flex w-fit items-center rounded-md bg-blue-50 px-2.5 py-1.5 text-sm font-medium text-blue-700">
              {gruppeNavn ?? "—"}
            </span>
          </div>
        )}

        {feil && <p className="text-sm text-sitedoc-error">{feil}</p>}

        {inviterAapen && (
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setInviterAapen(false)}>
              {t("handling.avbryt")}
            </Button>
            <Button type="button" onClick={inviterMedEpost} loading={sender} disabled={!kanInvitere}>
              <Plus className="mr-1 h-4 w-4" />
              {gruppeKontekst ? t("handling.leggTil") : t("handling.opprett")}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
