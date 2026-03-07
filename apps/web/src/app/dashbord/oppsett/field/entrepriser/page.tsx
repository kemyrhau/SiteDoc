"use client";

import { useState } from "react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Input,
  Select,
  Modal,
  Spinner,
  EmptyState,
  SearchInput,
} from "@sitedoc/ui";
import {
  Plus,
  Eye,
  Printer,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  Workflow as WorkflowIcon,
  ArrowRight,
  CheckCircle2,
  Circle,
  Users,
  FileText,
  X,
  AlertTriangle,
} from "lucide-react";
import { ENTERPRISE_INDUSTRIES, ENTERPRISE_COLORS } from "@sitedoc/shared";

/* ------------------------------------------------------------------ */
/*  Fargepalett for entrepriser (delt modul)                            */
/* ------------------------------------------------------------------ */

import {
  hentFargeForEntreprise,
  nesteAutoFarge,
  FARGE_MAP,
} from "../_components/entreprise-farger";

/* ------------------------------------------------------------------ */
/*  Fargevelger-komponent                                              */
/* ------------------------------------------------------------------ */

function FargeVelger({
  valgt,
  onChange,
}: {
  valgt: string;
  onChange: (farge: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ENTERPRISE_COLORS.map((farge) => {
        const fargeData = FARGE_MAP[farge];
        return (
          <button
            key={farge}
            type="button"
            onClick={() => onChange(farge)}
            className={`h-6 w-6 rounded-full ${fargeData?.bg ?? "bg-gray-400"} ${
              valgt === farge ? "ring-2 ring-offset-2 ring-gray-400" : ""
            }`}
            title={farge}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hjelpefunksjon for svarer-farge                                    */
/* ------------------------------------------------------------------ */

function hentEntrepriseFargeIndeks(
  entrepriseId: string,
  alleEntrepriser: EntrepriseData[],
): number {
  const idx = alleEntrepriser.findIndex((e) => e.id === entrepriseId);
  return idx >= 0 ? idx : 0;
}

/* ------------------------------------------------------------------ */
/*  Treprikk-meny (gjenbrukbar)                                       */
/* ------------------------------------------------------------------ */

function TreprikkMeny({
  handlinger,
  className = "",
}: {
  handlinger: Array<{
    label: string;
    ikon: React.ReactNode;
    onClick: () => void;
    fare?: boolean;
  }>;
  className?: string;
}) {
  const [apen, setApen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setApen(!apen);
        }}
        className="rounded p-1 text-gray-400 hover:bg-black/10 hover:text-gray-600"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {apen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setApen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {handlinger.map((h) => (
              <button
                key={h.label}
                onClick={() => {
                  setApen(false);
                  h.onClick();
                }}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm ${
                  h.fare
                    ? "text-red-600 hover:bg-red-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {h.ikon}
                {h.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Arbeidsforløp-rad (to-kolonne med pil)                             */
/* ------------------------------------------------------------------ */

interface ArbeidsforlopData {
  id: string;
  name: string;
  responderEnterpriseId: string | null;
  responderEnterprise: { id: string; name: string } | null;
  templates: Array<{
    template: { id: string; name: string; category: string };
  }>;
}

function ArbeidsforlopRad({
  arbeidsforlop,
  onRediger,
  onSlett,
}: {
  arbeidsforlop: ArbeidsforlopData;
  onRediger: (af: ArbeidsforlopData) => void;
  onSlett: (id: string) => void;
}) {
  const [ekspandert, setEkspandert] = useState(false);

  const oppgaveMaler = arbeidsforlop.templates.filter(
    (t) => t.template.category === "oppgave",
  );
  const sjekklisteMaler = arbeidsforlop.templates.filter(
    (t) => t.template.category === "sjekkliste",
  );

  const oppsummering = [
    oppgaveMaler.length > 0 ? `${oppgaveMaler.length} oppg.` : null,
    sjekklisteMaler.length > 0 ? `${sjekklisteMaler.length} sjekk.` : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <div>
      <div className="flex items-center gap-1 px-4 py-1.5">
        <button
          onClick={() => setEkspandert(!ekspandert)}
          className="flex flex-1 items-center gap-1.5 text-left"
        >
          {ekspandert ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          )}
          <WorkflowIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate text-sm font-medium text-gray-700">
            {arbeidsforlop.name}
          </span>
          {oppsummering && (
            <span className="ml-1 shrink-0 text-xs text-gray-400">
              ({oppsummering})
            </span>
          )}
        </button>
        <TreprikkMeny
          handlinger={[
            {
              label: "Rediger arbeidsforløp",
              ikon: <Pencil className="h-4 w-4 text-gray-400" />,
              onClick: () => onRediger(arbeidsforlop),
            },
            {
              label: "Slett arbeidsforløp",
              ikon: <Trash2 className="h-4 w-4 text-red-400" />,
              onClick: () => onSlett(arbeidsforlop.id),
              fare: true,
            },
          ]}
        />
      </div>

      {/* Ekspandert: maler */}
      {ekspandert && (
        <div className="mb-1 ml-10 mr-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          {oppgaveMaler.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-gray-600">Oppgavetyper</p>
              <ul className="mt-1 space-y-0.5">
                {oppgaveMaler.map((t) => (
                  <li key={t.template.id} className="text-xs text-gray-500">
                    {t.template.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sjekklisteMaler.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600">Sjekklistetyper</p>
              <ul className="mt-1 space-y-0.5">
                {sjekklisteMaler.map((t) => (
                  <li key={t.template.id} className="text-xs text-gray-500">
                    {t.template.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {arbeidsforlop.templates.length === 0 && (
            <p className="text-xs text-gray-400">Ingen maler tilknyttet</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Entreprise-gruppe (to-kolonne: Oppretter / Svarer)                 */
/* ------------------------------------------------------------------ */

interface EntrepriseMedlem {
  id: string;
  navn: string;
  epost: string;
}

interface EntrepriseData {
  id: string;
  name: string;
  enterpriseNumber: string | null;
  organizationNumber: string | null;
  color: string | null;
  industry: string | null;
  companyName: string | null;
  fargeIndeks: number;
  medlemmer: EntrepriseMedlem[];
}

interface ProsjektMedlemItem {
  id: string;
  user: { name: string | null; email: string };
}

/* ------------------------------------------------------------------ */
/*  MedlemKolonne — vertikal medlemsliste for én kolonne               */
/* ------------------------------------------------------------------ */

function MedlemKolonne({
  tittel,
  entreprise,
  alleMedlemmer,
  onLeggTil,
  onFjern,
  leseModus = false,
}: {
  tittel: string;
  entreprise: EntrepriseData | null;
  alleMedlemmer: ProsjektMedlemItem[];
  onLeggTil?: (projectMemberId: string) => void;
  onFjern?: (projectMemberId: string) => void;
  leseModus?: boolean;
}) {
  const [visVelger, setVisVelger] = useState(false);
  const medlemmer = entreprise?.medlemmer ?? [];

  // Filtrer ut medlemmer som allerede er i entreprisen
  const eksisterendeEposter = new Set(
    medlemmer.map((m) => m.epost.toLowerCase()),
  );
  const tilgjengelige = alleMedlemmer.filter(
    (m) => !eksisterendeEposter.has(m.user.email.toLowerCase()),
  );

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-1.5 flex items-center gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {tittel}
        </span>
        {entreprise && entreprise.name && (
          <span className="truncate text-[11px] text-gray-400">
            — {entreprise.name}
          </span>
        )}
      </div>

      <div className="space-y-0.5">
        {medlemmer.map((m) => (
          <div
            key={m.id}
            className="group flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-gray-50"
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600">
              {m.navn.charAt(0).toUpperCase()}
            </div>
            <span className="truncate text-[13px] text-gray-700" title={m.epost}>
              {m.navn}
            </span>
            {!leseModus && onFjern && (
              <button
                onClick={() => onFjern(m.id)}
                className="ml-auto hidden shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-red-500 group-hover:block"
                title="Fjern fra entreprise"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {medlemmer.length === 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-400">
            {!leseModus && <AlertTriangle className="h-3 w-3 text-amber-400" />}
            Ingen medlemmer
          </div>
        )}

        {/* Legg til-knapp */}
        {!leseModus && onLeggTil && (
          <>
            {visVelger ? (
              <div className="px-1.5">
                <select
                  autoFocus
                  className="w-full rounded border border-gray-300 px-2 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onLeggTil(e.target.value);
                    setVisVelger(false);
                  }}
                  onBlur={() => setVisVelger(false)}
                >
                  <option value="" disabled>Velg medlem...</option>
                  {tilgjengelige.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.user.name ?? m.user.email}
                    </option>
                  ))}
                  {tilgjengelige.length === 0 && (
                    <option value="" disabled>Ingen tilgjengelige</option>
                  )}
                </select>
              </div>
            ) : (
              <button
                onClick={() => setVisVelger(true)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-50 hover:text-blue-500"
              >
                <Plus className="h-3 w-3" />
                Legg til
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EntrepriseGruppeKomponent — to-kolonne kort                        */
/* ------------------------------------------------------------------ */

function EntrepriseGruppeKomponent({
  entreprise,
  arbeidsforloper,
  alleEntrepriser,
  alleMedlemmer,
  onRedigerEntreprise,
  onSlettEntreprise,
  onLeggTilArbeidsforlop,
  onRedigerArbeidsforlop,
  onSlettArbeidsforlop,
  onLeggTilMedlem,
  onFjernMedlem,
}: {
  entreprise: EntrepriseData;
  arbeidsforloper: ArbeidsforlopData[];
  alleEntrepriser: EntrepriseData[];
  alleMedlemmer: ProsjektMedlemItem[];
  onRedigerEntreprise: (id: string) => void;
  onSlettEntreprise: (id: string) => void;
  onLeggTilArbeidsforlop: (enterpriseId: string) => void;
  onRedigerArbeidsforlop: (af: ArbeidsforlopData, entrepriseNavn: string) => void;
  onSlettArbeidsforlop: (id: string) => void;
  onLeggTilMedlem: (enterpriseId: string, projectMemberId: string) => void;
  onFjernMedlem: (enterpriseId: string, projectMemberId: string) => void;
}) {
  const [ekspandert, setEkspandert] = useState(true);
  const farge = hentFargeForEntreprise(entreprise.color, entreprise.fargeIndeks);

  // Dalux-format: "NUMMER Navn, Firma"
  const headerTekst = [
    entreprise.enterpriseNumber,
    entreprise.name,
  ].filter(Boolean).join(" ")
    + (entreprise.companyName ? `, ${entreprise.companyName}` : "");

  // Finn unike svarer-entrepriser fra arbeidsforløp
  const svarerEntrepriseIder = new Set<string>();
  for (const af of arbeidsforloper) {
    if (af.responderEnterpriseId && af.responderEnterpriseId !== entreprise.id) {
      svarerEntrepriseIder.add(af.responderEnterpriseId);
    }
  }
  // Hovedsvarer: den første unike svarer-entreprisen (eller oppretter selv)
  const svarerEntrepriser = Array.from(svarerEntrepriseIder)
    .map((id) => alleEntrepriser.find((e) => e.id === id))
    .filter(Boolean) as EntrepriseData[];

  // Hvis ingen arbeidsforløp eller alle peker på seg selv → svarer = oppretter
  const harEksternSvarer = svarerEntrepriser.length > 0;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Entreprise-header — fargekodet, full bredde */}
      <div className={`flex items-center ${farge.bg} ${farge.border} border-b`}>
        <button
          onClick={() => setEkspandert(!ekspandert)}
          className="flex flex-1 items-center gap-2 px-4 py-2.5 text-left"
        >
          {ekspandert ? (
            <ChevronDown className={`h-4 w-4 ${farge.tekst}`} />
          ) : (
            <ChevronRight className={`h-4 w-4 ${farge.tekst}`} />
          )}
          <span className={`text-sm font-semibold ${farge.tekst}`}>
            {headerTekst}
          </span>
          {entreprise.industry && (
            <span className={`text-xs ${farge.tekst} opacity-70`}>
              · {entreprise.industry}
            </span>
          )}
        </button>

        <div className="mr-2">
          <TreprikkMeny
            className="[&>button]:text-white [&>button]:hover:bg-white/20"
            handlinger={[
              {
                label: "Legg til arbeidsforløp",
                ikon: <Plus className="h-4 w-4 text-gray-400" />,
                onClick: () => onLeggTilArbeidsforlop(entreprise.id),
              },
              {
                label: "Rediger entreprise",
                ikon: <Pencil className="h-4 w-4 text-gray-400" />,
                onClick: () => onRedigerEntreprise(entreprise.id),
              },
              {
                label: "Slett entreprise",
                ikon: <Trash2 className="h-4 w-4 text-red-400" />,
                onClick: () => onSlettEntreprise(entreprise.id),
                fare: true,
              },
            ]}
          />
        </div>
      </div>

      {ekspandert && (
        <div>
          {/* Fire kolonner: Oppretter / Svarer / Svarer 2 / Svarer 3 */}
          <div className="flex divide-x divide-gray-100">
            {/* Oppretter-kolonne */}
            <div className="flex-1 p-3">
              <MedlemKolonne
                tittel="Oppretter"
                entreprise={entreprise}
                alleMedlemmer={alleMedlemmer}
                onLeggTil={(pmId) => onLeggTilMedlem(entreprise.id, pmId)}
                onFjern={(pmId) => onFjernMedlem(entreprise.id, pmId)}
              />
            </div>

            {/* Svarer-kolonne */}
            <div className="flex-1 p-3">
              {harEksternSvarer ? (
                <div className="space-y-3">
                  {svarerEntrepriser.map((svarerEnt) => (
                    <MedlemKolonne
                      key={svarerEnt.id}
                      tittel="Svarer"
                      entreprise={svarerEnt}
                      alleMedlemmer={alleMedlemmer}
                      onLeggTil={(pmId) => onLeggTilMedlem(svarerEnt.id, pmId)}
                      onFjern={(pmId) => onFjernMedlem(svarerEnt.id, pmId)}
                    />
                  ))}
                </div>
              ) : (
                <MedlemKolonne
                  tittel="Svarer"
                  entreprise={entreprise}
                  alleMedlemmer={alleMedlemmer}
                  onLeggTil={(pmId) => onLeggTilMedlem(entreprise.id, pmId)}
                  onFjern={(pmId) => onFjernMedlem(entreprise.id, pmId)}
                />
              )}
            </div>

            {/* Svarer 2 — placeholder */}
            <div className="flex-1 p-3">
              <div className="mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
                  Svarer 2
                </span>
              </div>
              <p className="px-1.5 text-xs text-gray-300">Kommer</p>
            </div>

            {/* Svarer 3 — placeholder */}
            <div className="flex-1 p-3">
              <div className="mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
                  Svarer 3
                </span>
              </div>
              <p className="px-1.5 text-xs text-gray-300">Kommer</p>
            </div>
          </div>

          {/* Arbeidsforløp-seksjon */}
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Arbeidsforløp
              </span>
              <button
                onClick={() => onLeggTilArbeidsforlop(entreprise.id)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-3 w-3" />
                Legg til
              </button>
            </div>
            {arbeidsforloper.length > 0 ? (
              <div className="space-y-0.5">
                {arbeidsforloper.map((af) => (
                  <ArbeidsforlopRad
                    key={af.id}
                    arbeidsforlop={af}
                    onRediger={(data) =>
                      onRedigerArbeidsforlop(data, entreprise.name)
                    }
                    onSlett={onSlettArbeidsforlop}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Ingen arbeidsforløp konfigurert
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rediger arbeidsforløp modal                                        */
/* ------------------------------------------------------------------ */

function RedigerArbeidsforlopModal({
  open,
  onClose,
  entrepriseNavn,
  arbeidsforlopId,
  initialNavn,
  initialTemplateIds,
  initialResponderEnterpriseId,
  maler,
  entrepriser,
  erLagrer,
  onLagre,
}: {
  open: boolean;
  onClose: () => void;
  entrepriseNavn: string;
  arbeidsforlopId: string | null;
  initialNavn: string;
  initialTemplateIds: string[];
  initialResponderEnterpriseId: string | null;
  maler: Array<{ id: string; name: string; category: string }>;
  entrepriser: Array<{ id: string; name: string }>;
  erLagrer: boolean;
  onLagre: (data: {
    navn: string;
    templateIds: string[];
    responderEnterpriseId: string | null;
  }) => void;
}) {
  const [navn, setNavn] = useState(initialNavn);
  const [valgte, setValgte] = useState<Set<string>>(
    new Set(initialTemplateIds),
  );
  const [svarerEntrepriseId, setSvarerEntrepriseId] = useState<string>(
    initialResponderEnterpriseId ?? "",
  );

  // Synkroniser ved åpning
  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open && !forrigeOpen) {
    setNavn(initialNavn);
    setValgte(new Set(initialTemplateIds));
    setSvarerEntrepriseId(initialResponderEnterpriseId ?? "");
  }
  if (open !== forrigeOpen) setForrigeOpen(open);

  const oppgaveMaler = maler.filter((m) => m.category === "oppgave");
  const sjekklisteMaler = maler.filter((m) => m.category === "sjekkliste");

  function toggleMal(id: string) {
    setValgte((prev) => {
      const neste = new Set(prev);
      if (neste.has(id)) {
        neste.delete(id);
      } else {
        neste.add(id);
      }
      return neste;
    });
  }

  const svarerOptions = [
    { value: "", label: "Samme entreprise" },
    ...entrepriser.map((e) => ({ value: e.id, label: e.name })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={arbeidsforlopId ? "Rediger arbeidsforløp" : "Nytt arbeidsforløp"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!navn.trim()) return;
          onLagre({
            navn: navn.trim(),
            templateIds: Array.from(valgte),
            responderEnterpriseId: svarerEntrepriseId || null,
          });
        }}
        className="flex flex-col gap-4"
      >
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">Oppretter-entreprise:</span>{" "}
          {entrepriseNavn}
        </div>

        <Input
          label="Navn på arbeidsforløp"
          placeholder="F.eks. Uavhengig Kontroll"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          required
        />

        <Select
          label="Svarer-entreprise"
          options={svarerOptions}
          value={svarerEntrepriseId}
          onChange={(e) => setSvarerEntrepriseId(e.target.value)}
        />

        {/* To-kolonne avhukingsliste */}
        <div className="grid grid-cols-2 gap-6">
          {/* Oppgavetyper */}
          <div>
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                checked={
                  oppgaveMaler.length > 0 &&
                  oppgaveMaler.every((m) => valgte.has(m.id))
                }
                onChange={() => {
                  const alleValgt = oppgaveMaler.every((m) => valgte.has(m.id));
                  setValgte((prev) => {
                    const neste = new Set(prev);
                    for (const m of oppgaveMaler) {
                      if (alleValgt) neste.delete(m.id);
                      else neste.add(m.id);
                    }
                    return neste;
                  });
                }}
              />
              <span className="text-sm font-semibold text-gray-900">
                Oppgavetype
              </span>
            </label>
            <div className="space-y-1.5">
              {oppgaveMaler.map((mal) => (
                <label
                  key={mal.id}
                  className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                    checked={valgte.has(mal.id)}
                    onChange={() => toggleMal(mal.id)}
                  />
                  <span className="text-sm text-gray-700">{mal.name}</span>
                </label>
              ))}
              {oppgaveMaler.length === 0 && (
                <p className="text-xs text-gray-400">Ingen oppgavemaler</p>
              )}
            </div>
          </div>

          {/* Sjekklistetyper */}
          <div>
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                checked={
                  sjekklisteMaler.length > 0 &&
                  sjekklisteMaler.every((m) => valgte.has(m.id))
                }
                onChange={() => {
                  const alleValgt = sjekklisteMaler.every((m) =>
                    valgte.has(m.id),
                  );
                  setValgte((prev) => {
                    const neste = new Set(prev);
                    for (const m of sjekklisteMaler) {
                      if (alleValgt) neste.delete(m.id);
                      else neste.add(m.id);
                    }
                    return neste;
                  });
                }}
              />
              <span className="text-sm font-semibold text-gray-900">
                Sjekklistetype
              </span>
            </label>
            <div className="space-y-1.5">
              {sjekklisteMaler.map((mal) => (
                <label
                  key={mal.id}
                  className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary accent-sitedoc-primary"
                    checked={valgte.has(mal.id)}
                    onChange={() => toggleMal(mal.id)}
                  />
                  <span className="text-sm text-gray-700">{mal.name}</span>
                </label>
              ))}
              {sjekklisteMaler.length === 0 && (
                <p className="text-xs text-gray-400">Ingen sjekklistemaler</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" loading={erLagrer}>
            OK
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Entreprise-veiviser (multi-step wizard)                            */
/* ------------------------------------------------------------------ */

type VeiviserMetode = "kopier" | "mal" | "importer" | "tom";

function EntrepriseVeiviser({
  open,
  onClose,
  prosjektId,
  entrepriser,
  prosjekter,
  onOpprettet,
}: {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  entrepriser: EntrepriseData[];
  prosjekter: Array<{ id: string; name: string; projectNumber: string }>;
  onOpprettet: () => void;
}) {
  const [steg, setSteg] = useState(1);
  const [metode, setMetode] = useState<VeiviserMetode>("tom");

  // Steg 1 — Kopier fra nåværende
  const [kopierEntrepriseId, setKopierEntrepriseId] = useState("");

  // Steg 2b — Importer fra annet prosjekt
  const [importProsjektId, setImportProsjektId] = useState("");
  const [importEntrepriseId, setImportEntrepriseId] = useState("");

  // Steg 2c — Opprett tom
  const [nyNavn, setNyNavn] = useState("");
  const [nyNummer, setNyNummer] = useState("");
  const [nyBransje, setNyBransje] = useState("");
  const [nyFirma, setNyFirma] = useState("");

  // Medlemmer-steg
  const [valgteMedlemmer, setValgteMedlemmer] = useState<Set<string>>(new Set());

  // Lazy-loaded entrepriser for import-prosjektet
  const { data: importEntrepriser } =
    trpc.entreprise.hentForProsjekt.useQuery(
      { projectId: importProsjektId },
      { enabled: !!importProsjektId && metode === "importer" },
    );

  // Hent prosjektmedlemmer for medlemsvalg-steget
  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const utils = trpc.useUtils();

  const opprettMutation = trpc.entreprise.opprett.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.arbeidsforlop.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      onOpprettet();
      lukkOgNullstill();
    },
  });

  const kopierMutation = trpc.entreprise.kopier.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.arbeidsforlop.hentForProsjekt.invalidate({ projectId: prosjektId });
      utils.medlem.hentForProsjekt.invalidate({ projectId: prosjektId });
      onOpprettet();
      lukkOgNullstill();
    },
  });

  function lukkOgNullstill() {
    setSteg(1);
    setMetode("tom");
    setKopierEntrepriseId("");
    setImportProsjektId("");
    setImportEntrepriseId("");
    setNyNavn("");
    setNyNummer("");
    setNyBransje("");
    setNyFirma("");
    setValgteMedlemmer(new Set());
    onClose();
  }

  const erLagrer = opprettMutation.isPending || kopierMutation.isPending;
  const andreProsjekter = prosjekter.filter((p) => p.id !== prosjektId);
  const harAndreProsjekter = andreProsjekter.length > 0;
  const harEntrepriser = entrepriser.length > 0;

  // Siste steg-nummer avhenger av metode
  // kopier: steg 1 (metode+valg) → steg 2 (medlemmer) → submit
  // importer: steg 1 (metode) → steg 2 (velg prosjekt+entreprise) → steg 3 (medlemmer) → submit
  // tom: steg 1 (metode) → steg 2 (detaljer) → steg 3 (medlemmer) → submit
  const _sisteSteg =
    metode === "kopier" ? 2 : 3;

  const erPaMedlemSteg =
    (metode === "kopier" && steg === 2) ||
    ((metode === "tom" || metode === "importer") && steg === 3);

  // Synkroniser state ved åpning
  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open && !forrigeOpen) {
    setSteg(1);
    setMetode("tom");
    setKopierEntrepriseId("");
    setImportProsjektId("");
    setImportEntrepriseId("");
    setNyNavn("");
    setNyNummer("");
    setNyBransje("");
    setNyFirma("");
    setValgteMedlemmer(new Set());
  }
  if (open !== forrigeOpen) setForrigeOpen(open);

  function handleNeste() {
    // Hvis vi er på medlemssteget → submit
    if (erPaMedlemSteg) {
      const memberIds = Array.from(valgteMedlemmer);
      if (metode === "tom") {
        opprettMutation.mutate({
          name: nyNavn.trim(),
          projectId: prosjektId,
          enterpriseNumber: nyNummer.trim() || undefined,
          color: nesteAutoFarge(entrepriser.map((e) => e.color)),
          industry: nyBransje.trim() || undefined,
          companyName: nyFirma.trim() || undefined,
          memberIds,
        });
      } else if (metode === "kopier") {
        kopierMutation.mutate({
          sourceEnterpriseId: kopierEntrepriseId,
          targetProjectId: prosjektId,
          memberIds,
        });
      } else if (metode === "importer") {
        kopierMutation.mutate({
          sourceEnterpriseId: importEntrepriseId,
          targetProjectId: prosjektId,
          memberIds,
        });
      }
      return;
    }

    if (steg === 1) {
      if (metode === "kopier" && kopierEntrepriseId) {
        // Gå til medlemsvalg (steg 2)
        setSteg(2);
        return;
      }
      setSteg(2);
      return;
    }

    if (steg === 2) {
      if (metode === "importer" && importEntrepriseId) {
        // Gå til medlemsvalg (steg 3)
        setSteg(3);
        return;
      }
      if (metode === "tom" && nyNavn.trim()) {
        // Gå til medlemsvalg (steg 3)
        setSteg(3);
        return;
      }
    }
  }

  function handleForrige() {
    if (erPaMedlemSteg) {
      setSteg(metode === "kopier" ? 1 : 2);
    } else if (steg === 2) {
      setSteg(1);
    }
  }

  const kanGaVidere = (() => {
    if (erPaMedlemSteg) return true; // Medlemsvalg er valgfritt
    if (steg === 1) {
      if (metode === "kopier") return !!kopierEntrepriseId;
      if (metode === "mal") return false;
      if (metode === "importer") return harAndreProsjekter;
      return true; // tom
    }
    if (steg === 2) {
      if (metode === "importer") return !!importEntrepriseId;
      if (metode === "tom") return !!nyNavn.trim();
    }
    return false;
  })();

  const knappTekst = (() => {
    if (erPaMedlemSteg) {
      if (metode === "tom") return "Opprett";
      if (metode === "kopier") return "Kopier";
      return "Importer";
    }
    return "Neste";
  })();

  function toggleMedlem(id: string) {
    setValgteMedlemmer((prev) => {
      const neste = new Set(prev);
      if (neste.has(id)) neste.delete(id);
      else neste.add(id);
      return neste;
    });
  }

  return (
    <Modal
      open={open}
      onClose={lukkOgNullstill}
      title="Legg til entreprise"
    >
      <div className="flex flex-col gap-5">
        {steg === 1 && (
          <>
            <p className="text-sm text-gray-600">
              Velg hvordan du vil legge til en entreprise:
            </p>
            <div className="flex flex-col gap-2">
              {/* Kopier fra nåværende prosjekt */}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  metode === "kopier" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                } ${!harEntrepriser ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="metode"
                  value="kopier"
                  checked={metode === "kopier"}
                  onChange={() => setMetode("kopier")}
                  disabled={!harEntrepriser}
                  className="mt-0.5 accent-sitedoc-primary"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    Kopier entreprise fra nåværende prosjekt
                  </span>
                  {metode === "kopier" && harEntrepriser && (
                    <div className="mt-2">
                      <Select
                        options={[
                          { value: "", label: "Velg entreprise..." },
                          ...entrepriser.map((e) => ({ value: e.id, label: e.name })),
                        ]}
                        value={kopierEntrepriseId}
                        onChange={(e) => setKopierEntrepriseId(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </label>

              {/* Fra prosjektstandard (disabled) */}
              <label className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-gray-200 p-3 opacity-50">
                <input
                  type="radio"
                  name="metode"
                  disabled
                  className="mt-0.5 accent-sitedoc-primary"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Opprett entreprise fra en mal i en prosjektstandard
                  </span>
                  <span className="ml-1 text-xs text-gray-400">(kommer)</span>
                </div>
              </label>

              {/* Importer fra annet prosjekt */}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  metode === "importer" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                } ${!harAndreProsjekter ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="metode"
                  value="importer"
                  checked={metode === "importer"}
                  onChange={() => setMetode("importer")}
                  disabled={!harAndreProsjekter}
                  className="mt-0.5 accent-sitedoc-primary"
                />
                <span className="text-sm font-medium text-gray-900">
                  Importer fra annet prosjekt
                </span>
              </label>

              {/* Opprett tom */}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  metode === "tom" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="metode"
                  value="tom"
                  checked={metode === "tom"}
                  onChange={() => setMetode("tom")}
                  className="mt-0.5 accent-sitedoc-primary"
                />
                <span className="text-sm font-medium text-gray-900">
                  Opprett tom entreprise
                </span>
              </label>
            </div>
          </>
        )}

        {/* Steg 2b — Importer fra annet prosjekt */}
        {steg === 2 && metode === "importer" && (
          <>
            <Select
              label="Velg prosjekt"
              options={[
                { value: "", label: "Velg prosjekt..." },
                ...andreProsjekter.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.projectNumber})`,
                })),
              ]}
              value={importProsjektId}
              onChange={(e) => {
                setImportProsjektId(e.target.value);
                setImportEntrepriseId("");
              }}
            />

            {importProsjektId && (
              <Select
                label="Velg entreprise"
                options={[
                  { value: "", label: "Velg entreprise..." },
                  ...(importEntrepriser?.map((e) => ({
                    value: e.id,
                    label: e.name,
                  })) ?? []),
                ]}
                value={importEntrepriseId}
                onChange={(e) => setImportEntrepriseId(e.target.value)}
              />
            )}
          </>
        )}

        {/* Steg 2c — Opprett tom entreprise */}
        {steg === 2 && metode === "tom" && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Entreprise <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={nyNummer}
                  onChange={(e) => setNyNummer(e.target.value)}
                  placeholder="Nr."
                  className="w-[60px] rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={nyNavn}
                  onChange={(e) => setNyNavn(e.target.value)}
                  placeholder="F.eks. Tømrer"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Bransje</label>
              <input
                list="bransje-liste-ny"
                placeholder="Velg eller skriv inn bransje..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={nyBransje}
                onChange={(e) => setNyBransje(e.target.value)}
              />
              <datalist id="bransje-liste-ny">
                {ENTERPRISE_INDUSTRIES.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            <Input
              label="Firma"
              placeholder="Firmanavn"
              value={nyFirma}
              onChange={(e) => setNyFirma(e.target.value)}
            />
          </>
        )}

        {/* Medlemsvalg-steg (siste steg for alle metoder) */}
        {erPaMedlemSteg && (
          <>
            <p className="text-sm text-gray-600">
              Velg hvilke prosjektmedlemmer som skal tilknyttes entreprisen:
            </p>
            {medlemmer && medlemmer.length > 0 ? (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-3">
                {medlemmer.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 accent-sitedoc-primary"
                      checked={valgteMedlemmer.has(m.id)}
                      onChange={() => toggleMedlem(m.id)}
                    />
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {m.user.name ?? m.user.email}
                      </span>
                      {m.user.name && (
                        <span className="text-xs text-gray-400">
                          {m.user.email}
                        </span>
                      )}
                    </div>
                    {m.enterprises?.length > 0 && (
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {m.enterprises.map((me: { enterprise: { name: string } }) => me.enterprise.name).join(", ")}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Ingen prosjektmedlemmer funnet. Du kan legge til medlemmer senere.
              </p>
            )}
          </>
        )}

        {/* Knapper */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            type="button"
            onClick={lukkOgNullstill}
          >
            Avbryt
          </Button>
          {steg > 1 && (
            <Button
              variant="secondary"
              type="button"
              onClick={handleForrige}
            >
              Forrige
            </Button>
          )}
          <Button
            onClick={handleNeste}
            loading={erLagrer}
            disabled={!kanGaVidere}
          >
            {knappTekst}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function EntrepriserSide() {
  const { prosjektId, prosjekter } = useProsjekt();
  const utils = trpc.useUtils();

  // Søk
  const [sok, setSok] = useState("");

  // Entreprise-veiviser
  const [visVeiviser, setVisVeiviser] = useState(false);

  // Rediger entreprise-modal
  const [redigerEntrepriseId, setRedigerEntrepriseId] = useState<string | null>(null);
  const [redigerNavn, setRedigerNavn] = useState("");
  const [redigerNummer, setRedigerNummer] = useState("");
  const [redigerOrgNummer, setRedigerOrgNummer] = useState("");
  const [redigerFarge, setRedigerFarge] = useState("");
  const [redigerBransje, setRedigerBransje] = useState("");
  const [redigerFirma, setRedigerFirma] = useState("");
  const [slettEntrepriseId, setSlettEntrepriseId] = useState<string | null>(null);

  // Arbeidsforløp-modal
  const [afModalOpen, setAfModalOpen] = useState(false);
  const [afEntrepriseId, setAfEntrepriseId] = useState<string | null>(null);
  const [afEntrepriseNavn, setAfEntrepriseNavn] = useState("");
  const [afId, setAfId] = useState<string | null>(null);
  const [afInitialNavn, setAfInitialNavn] = useState("");
  const [afInitialTemplateIds, setAfInitialTemplateIds] = useState<string[]>([]);
  const [afInitialResponderEnterpriseId, setAfInitialResponderEnterpriseId] =
    useState<string | null>(null);
  const [slettAfId, setSlettAfId] = useState<string | null>(null);

  // Data
  const { data: entrepriser, isLoading } =
    trpc.entreprise.hentForProsjekt.useQuery(
      { projectId: prosjektId! },
      { enabled: !!prosjektId },
    );

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Hent alle arbeidsforløp for prosjektet i én query
  const { data: alleArbeidsforlop } =
    trpc.arbeidsforlop.hentForProsjekt.useQuery(
      { projectId: prosjektId! },
      { enabled: !!prosjektId },
    );

  // Hent medlemmer for veiledning
  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Bygg map: entrepriseId -> arbeidsforløp[]
  const arbeidsforlopMap = new Map<string, ArbeidsforlopData[]>();
  if (alleArbeidsforlop) {
    for (const af of alleArbeidsforlop) {
      const eid = af.enterpriseId;
      const liste = arbeidsforlopMap.get(eid) ?? [];
      liste.push(af as ArbeidsforlopData);
      arbeidsforlopMap.set(eid, liste);
    }
  }

  // Mutasjoner — entreprise
  const oppdaterEntrepriseMutation = trpc.entreprise.oppdater.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setRedigerEntrepriseId(null);
    },
  });

  const slettEntrepriseMutation = trpc.entreprise.slett.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId! });
      utils.arbeidsforlop.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setSlettEntrepriseId(null);
    },
  });

  // Mutasjoner — arbeidsforløp
  const opprettAfMutation = trpc.arbeidsforlop.opprett.useMutation({
    onSuccess: () => {
      utils.arbeidsforlop.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setAfModalOpen(false);
    },
  });

  const oppdaterAfMutation = trpc.arbeidsforlop.oppdater.useMutation({
    onSuccess: () => {
      utils.arbeidsforlop.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setAfModalOpen(false);
    },
  });

  const slettAfMutation = trpc.arbeidsforlop.slett.useMutation({
    onSuccess: () => {
      utils.arbeidsforlop.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setSlettAfId(null);
    },
  });

  // Mutasjoner — medlemmer i entreprise
  const tilknyttEntrepriseMutation = trpc.medlem.tilknyttEntreprise.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  const fjernFraEntrepriseMutation = trpc.medlem.fjernFraEntreprise.useMutation({
    onSuccess: () => {
      utils.entreprise.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  // Handlinger
  function handleRedigerEntreprise(id: string) {
    const ent = entrepriser?.find((e) => e.id === id);
    if (!ent) return;
    setRedigerEntrepriseId(id);
    setRedigerNavn(ent.name);
    setRedigerNummer(ent.enterpriseNumber ?? "");
    setRedigerOrgNummer(ent.organizationNumber ?? "");
    setRedigerFarge(ent.color ?? "");
    setRedigerBransje(ent.industry ?? "");
    setRedigerFirma(ent.companyName ?? "");
  }

  function handleLeggTilArbeidsforlop(enterpriseId: string) {
    const ent = entrepriser?.find((e) => e.id === enterpriseId);
    setAfEntrepriseId(enterpriseId);
    setAfEntrepriseNavn(ent?.name ?? "");
    setAfId(null);
    setAfInitialNavn("");
    setAfInitialTemplateIds([]);
    setAfInitialResponderEnterpriseId(null);
    setAfModalOpen(true);
  }

  function handleRedigerArbeidsforlop(
    af: ArbeidsforlopData,
    entrepriseNavn: string,
  ) {
    // Finn entrepriseId for dette arbeidsforløpet
    for (const [eid, afs] of arbeidsforlopMap) {
      if (afs.some((a) => a.id === af.id)) {
        setAfEntrepriseId(eid);
        break;
      }
    }
    setAfEntrepriseNavn(entrepriseNavn);
    setAfId(af.id);
    setAfInitialNavn(af.name);
    setAfInitialTemplateIds(af.templates.map((t) => t.template.id));
    setAfInitialResponderEnterpriseId(af.responderEnterpriseId);
    setAfModalOpen(true);
  }

  function handleLagreArbeidsforlop(data: {
    navn: string;
    templateIds: string[];
    responderEnterpriseId: string | null;
  }) {
    if (afId) {
      oppdaterAfMutation.mutate({
        id: afId,
        name: data.navn,
        templateIds: data.templateIds,
        responderEnterpriseId: data.responderEnterpriseId,
      });
    } else if (afEntrepriseId) {
      opprettAfMutation.mutate({
        enterpriseId: afEntrepriseId,
        name: data.navn,
        templateIds: data.templateIds,
        responderEnterpriseId: data.responderEnterpriseId,
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Entreprise-data med fargeindeks
  const entrepriseData: EntrepriseData[] =
    entrepriser?.map((e, i) => ({
      id: e.id,
      name: e.name,
      enterpriseNumber: e.enterpriseNumber ?? null,
      organizationNumber: e.organizationNumber ?? null,
      color: e.color ?? null,
      industry: e.industry ?? null,
      companyName: e.companyName ?? null,
      fargeIndeks: i,
      medlemmer: ((e as unknown as { memberEnterprises?: Array<{ projectMember: { id: string; user: { name: string | null; email: string } } }> }).memberEnterprises ?? []).map((me) => ({
        id: me.projectMember.id,
        navn: me.projectMember.user.name ?? me.projectMember.user.email,
        epost: me.projectMember.user.email,
      })),
    })) ?? [];

  // Søkefiltrering
  const filtrert = sok
    ? entrepriseData.filter((e) => {
        const soketekst = sok.toLowerCase();
        if (e.name.toLowerCase().includes(soketekst)) return true;
        if (e.companyName?.toLowerCase().includes(soketekst)) return true;
        const afs = arbeidsforlopMap.get(e.id) ?? [];
        return afs.some((af) => af.name.toLowerCase().includes(soketekst));
      })
    : entrepriseData;

  // Mal-data for modal (id, name, category)
  type MalItem = { id: string; name: string; category: string };
  const malListe: MalItem[] =
    (maler as Array<{ id: string; name: string; category?: string }> | undefined)?.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category ?? "sjekkliste",
    })) ?? [];

  // Entreprise-liste for modal dropdown
  const entrepriseListe = entrepriseData.map((e) => ({
    id: e.id,
    name: e.name,
  }));

  return (
    <div>
      {/* Verktøylinje */}
      <div className="mb-4 flex items-center gap-3">
        <Button size="sm" onClick={() => setVisVeiviser(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Legg til entreprise
        </Button>
        <Button variant="ghost" size="sm">
          <Eye className="mr-1.5 h-4 w-4" />
          Vis detaljer
        </Button>
        <Button variant="ghost" size="sm">
          <Printer className="mr-1.5 h-4 w-4" />
          Skriv ut
        </Button>
      </div>

      {/* Veiledning — vis når oppsett ikke er komplett */}
      {(() => {
        const harFlereBrukere = (medlemmer?.length ?? 0) > 1;
        const malListen = maler as Array<{ id: string; category?: string }> | undefined;
        const harOppgavemal = malListen?.some((m) => m.category === "oppgave") ?? false;
        const harSjekklistemal = malListen?.some((m) => m.category === "sjekkliste") ?? false;
        const harBeggemaler = harOppgavemal && harSjekklistemal;
        const harEntrepriser = entrepriseData.length > 0;
        const harArbeidsforlop = (alleArbeidsforlop?.length ?? 0) > 0;
        const harMalerTilknyttet = alleArbeidsforlop?.some(
          (af) => (af as { templates?: unknown[] }).templates?.length
        ) ?? false;
        const alleKomplett = harFlereBrukere && harBeggemaler && harEntrepriser && harArbeidsforlop && harMalerTilknyttet;

        if (alleKomplett) return null;

        const steg = [
          {
            ferdig: harEntrepriser,
            tekst: "Opprett entrepriser",
          },
          {
            ferdig: harBeggemaler,
            tekst: `Opprett maler (${harOppgavemal ? "oppgave \u2713" : "oppgave mangler"}, ${harSjekklistemal ? "sjekkliste \u2713" : "sjekkliste mangler"})`,
          },
          {
            ferdig: harArbeidsforlop && harMalerTilknyttet,
            tekst: "Knytt maler til arbeidsforløp",
          },
          {
            ferdig: harFlereBrukere,
            tekst: "Inviter brukere og knytt til entrepriser",
          },
        ];

        return (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-amber-900">
              Før feltarbeid kan starte
            </h3>
            <p className="mb-3 text-xs text-amber-700">
              Disse punktene må være på plass. Rekkefølgen er valgfri.
            </p>
            <ul className="space-y-1.5">
              {steg.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {s.ferdig ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-amber-400" />
                  )}
                  <span className={s.ferdig ? "text-gray-500 line-through" : "text-gray-800"}>
                    {s.tekst}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Søk */}
      <div className="mb-4 flex items-center gap-3">
        <SearchInput
          verdi={sok}
          onChange={setSok}
          placeholder="Søk"
          className="w-72"
        />
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <Plus className="h-3.5 w-3.5" />
          Tilføy filter
        </button>
      </div>

      {/* Entreprise-grupper */}
      {filtrert.length === 0 ? (
        <EmptyState
          title="Ingen entrepriser"
          description="Legg til entrepriser for å konfigurere dokumentflyt mellom oppretter og svarer."
          action={
            <Button onClick={() => setVisVeiviser(true)}>
              Legg til entreprise
            </Button>
          }
        />
      ) : (
        <div>
          {filtrert.map((ent) => (
            <EntrepriseGruppeKomponent
              key={ent.id}
              entreprise={ent}
              arbeidsforloper={arbeidsforlopMap.get(ent.id) ?? []}
              alleEntrepriser={entrepriseData}
              alleMedlemmer={(medlemmer as ProsjektMedlemItem[] | undefined) ?? []}
              onRedigerEntreprise={handleRedigerEntreprise}
              onSlettEntreprise={setSlettEntrepriseId}
              onLeggTilArbeidsforlop={handleLeggTilArbeidsforlop}
              onRedigerArbeidsforlop={handleRedigerArbeidsforlop}
              onSlettArbeidsforlop={setSlettAfId}
              onLeggTilMedlem={(enterpriseId, projectMemberId) =>
                tilknyttEntrepriseMutation.mutate({
                  projectMemberId,
                  enterpriseId,
                  projectId: prosjektId!,
                })
              }
              onFjernMedlem={(enterpriseId, projectMemberId) =>
                fjernFraEntrepriseMutation.mutate({
                  projectMemberId,
                  enterpriseId,
                  projectId: prosjektId!,
                })
              }
            />
          ))}
        </div>
      )}

      {/* Entreprise-veiviser */}
      <EntrepriseVeiviser
        open={visVeiviser}
        onClose={() => setVisVeiviser(false)}
        prosjektId={prosjektId!}
        entrepriser={entrepriseData}
        prosjekter={prosjekter}
        onOpprettet={() => {}}
      />

      {/* Rediger entreprise modal */}
      <Modal
        open={redigerEntrepriseId !== null}
        onClose={() => setRedigerEntrepriseId(null)}
        title="Rediger entreprise"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!redigerEntrepriseId || !redigerNavn.trim()) return;
            oppdaterEntrepriseMutation.mutate({
              id: redigerEntrepriseId,
              name: redigerNavn.trim(),
              enterpriseNumber: redigerNummer.trim() || undefined,
              organizationNumber: redigerOrgNummer.trim() || undefined,
              color: redigerFarge || undefined,
              industry: redigerBransje.trim() || undefined,
              companyName: redigerFirma.trim() || undefined,
            });
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Entreprise <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <FargeVelger valgt={redigerFarge} onChange={setRedigerFarge} />
              <input
                type="text"
                value={redigerNummer}
                onChange={(e) => setRedigerNummer(e.target.value)}
                placeholder="Nr."
                className="w-[60px] rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text"
                value={redigerNavn}
                onChange={(e) => setRedigerNavn(e.target.value)}
                placeholder="Navn"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Bransje</label>
            <input
              list="bransje-liste-rediger"
              placeholder="Velg eller skriv inn bransje..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={redigerBransje}
              onChange={(e) => setRedigerBransje(e.target.value)}
            />
            <datalist id="bransje-liste-rediger">
              {ENTERPRISE_INDUSTRIES.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          <Input
            label="Firma"
            placeholder="Firmanavn"
            value={redigerFirma}
            onChange={(e) => setRedigerFirma(e.target.value)}
          />

          <Input
            label="Organisasjonsnummer"
            placeholder="Valgfritt"
            value={redigerOrgNummer}
            onChange={(e) => setRedigerOrgNummer(e.target.value)}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              loading={oppdaterEntrepriseMutation.isPending}
            >
              Lagre
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRedigerEntrepriseId(null)}
            >
              Avbryt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Slett entreprise bekreftelse */}
      <Modal
        open={slettEntrepriseId !== null}
        onClose={() => setSlettEntrepriseId(null)}
        title="Slett entreprise"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Er du sikker på at du vil slette denne entreprisen? Alle tilknyttede
            arbeidsforløp vil også bli fjernet.
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="danger"
              loading={slettEntrepriseMutation.isPending}
              onClick={() => {
                if (!slettEntrepriseId) return;
                slettEntrepriseMutation.mutate({ id: slettEntrepriseId });
              }}
            >
              Slett
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSlettEntrepriseId(null)}
            >
              Avbryt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rediger/Opprett arbeidsforløp modal */}
      <RedigerArbeidsforlopModal
        open={afModalOpen}
        onClose={() => setAfModalOpen(false)}
        entrepriseNavn={afEntrepriseNavn}
        arbeidsforlopId={afId}
        initialNavn={afInitialNavn}
        initialTemplateIds={afInitialTemplateIds}
        initialResponderEnterpriseId={afInitialResponderEnterpriseId}
        maler={malListe}
        entrepriser={entrepriseListe}
        erLagrer={opprettAfMutation.isPending || oppdaterAfMutation.isPending}
        onLagre={handleLagreArbeidsforlop}
      />

      {/* Slett arbeidsforløp bekreftelse */}
      <Modal
        open={slettAfId !== null}
        onClose={() => setSlettAfId(null)}
        title="Slett arbeidsforløp"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Er du sikker på at du vil slette dette arbeidsforløpet?
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="danger"
              loading={slettAfMutation.isPending}
              onClick={() => {
                if (!slettAfId) return;
                slettAfMutation.mutate({ id: slettAfId });
              }}
            >
              Slett
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSlettAfId(null)}
            >
              Avbryt
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
