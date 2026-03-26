"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal } from "@sitedoc/ui";
import {
  Plus,
  Building2,
  X,
  FileText,
  User,
  Users,
  Mail,
  UserPlus,
  ChevronDown,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { hentFargeForEntreprise } from "./entreprise-farger";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

export interface DokumentflytMedlemData {
  id: string;
  rolle: string;
  steg: number;
  enterprise: { id: string; name: string; color: string | null } | null;
  projectMember: {
    id: string;
    user: { id: string; name: string | null; email: string };
  } | null;
  group: { id: string; name: string } | null;
}

export interface DokumentflytMalData {
  template: { id: string; name: string; category: string };
}

export interface DokumentflytData {
  id: string;
  name: string;
  enterpriseId: string | null;
  medlemmer: DokumentflytMedlemData[];
  maler: DokumentflytMalData[];
}

export interface EntrepriseItem {
  id: string;
  name: string;
  color: string | null;
}

export interface ProsjektMedlemItem {
  id: string;
  user: { name: string | null; email: string };
}

/* ------------------------------------------------------------------ */
/*  MedlemListe                                                        */
/* ------------------------------------------------------------------ */

export function MedlemListe({
  medlemmer,
  entrepriser,
  onFjern,
}: {
  medlemmer: DokumentflytMedlemData[];
  entrepriser: EntrepriseItem[];
  onFjern: (id: string) => void;
}) {
  if (medlemmer.length === 0) return null;

  return (
    <div className="space-y-1">
      {medlemmer.map((m) => {
        if (m.enterprise) {
          const ent = entrepriser.find((e) => e.id === m.enterprise!.id);
          const fargeIdx = ent ? entrepriser.indexOf(ent) : 0;
          const farge = hentFargeForEntreprise(m.enterprise.color, fargeIdx);
          return (
            <div
              key={m.id}
              className={`group flex items-center gap-1.5 rounded px-1.5 py-1 ${farge.bg}`}
            >
              <Building2 className={`h-3.5 w-3.5 ${farge.tekst}`} />
              <span className={`flex-1 text-[13px] font-medium ${farge.tekst}`}>
                {m.enterprise.name}
              </span>
              <button
                onClick={() => onFjern(m.id)}
                className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/50"
                title="Fjern"
              >
                <X className="h-3 w-3 text-gray-500" />
              </button>
            </div>
          );
        }
        if (m.group) {
          return (
            <div
              key={m.id}
              className="group flex items-center gap-1.5 rounded bg-blue-50 px-1.5 py-1"
            >
              <Users className="h-3.5 w-3.5 text-blue-600" />
              <span className="flex-1 text-[13px] font-medium text-blue-700">
                {m.group.name}
              </span>
              <button
                onClick={() => onFjern(m.id)}
                className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/50"
                title="Fjern"
              >
                <X className="h-3 w-3 text-gray-500" />
              </button>
            </div>
          );
        }
        if (m.projectMember) {
          return (
            <div
              key={m.id}
              className="group flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-gray-50"
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600">
                {(m.projectMember.user.name ?? m.projectMember.user.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] leading-tight text-gray-700">
                  {m.projectMember.user.name ?? m.projectMember.user.email}
                </div>
                <div className="flex items-center gap-1 truncate text-[11px] leading-tight text-gray-400">
                  <Mail className="h-2.5 w-2.5 shrink-0" />
                  {m.projectMember.user.email}
                </div>
              </div>
              <button
                onClick={() => onFjern(m.id)}
                className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100"
                title="Fjern"
              >
                <X className="h-3 w-3 text-gray-500" />
              </button>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LeggTilMedlemDropdown                                               */
/* ------------------------------------------------------------------ */

export function LeggTilMedlemDropdown({
  dokumentflytId,
  prosjektId,
  rolle,
  steg,
  entrepriser,
  medlemmer,
  grupper,
  eksisterende,
  onLagtTil,
  onInviterNy,
}: {
  dokumentflytId: string;
  prosjektId: string;
  rolle: "oppretter" | "svarer";
  steg: number;
  entrepriser: EntrepriseItem[];
  medlemmer: ProsjektMedlemItem[];
  grupper?: Array<{ id: string; name: string }>;
  eksisterende: DokumentflytMedlemData[];
  onLagtTil: () => void;
  onInviterNy?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const leggTilMutation = trpc.dokumentflyt.leggTilMedlem.useMutation({
    onSuccess: () => {
      onLagtTil();
      setOpen(false);
    },
  });

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const eksisterendeEntrepriseIder = new Set(
    eksisterende.filter((m) => m.enterprise).map((m) => m.enterprise!.id),
  );
  const eksisterendeMedlemIder = new Set(
    eksisterende.filter((m) => m.projectMember).map((m) => m.projectMember!.id),
  );
  const eksisterendeGruppeIder = new Set(
    eksisterende.filter((m) => m.group).map((m) => m.group!.id),
  );

  const tilgjengeligeEntrepriser = entrepriser.filter((e) => !eksisterendeEntrepriseIder.has(e.id));
  const tilgjengeligeMedlemmer = medlemmer.filter((m) => !eksisterendeMedlemIder.has(m.id));
  const tilgjengeligeGrupper = (grupper ?? []).filter((g) => !eksisterendeGruppeIder.has(g.id));

  function leggTilEntreprise(enterpriseId: string) {
    leggTilMutation.mutate({ dokumentflytId, projectId: prosjektId, enterpriseId, rolle, steg });
  }

  function leggTilPerson(projectMemberId: string) {
    leggTilMutation.mutate({ dokumentflytId, projectId: prosjektId, projectMemberId, rolle, steg });
  }

  function leggTilGruppe(groupId: string) {
    leggTilMutation.mutate({ dokumentflytId, projectId: prosjektId, groupId, rolle, steg });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="Legg til"
      >
        <Plus className="h-3 w-3" />
        <span>Legg til</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
          {tilgjengeligeEntrepriser.length > 0 && (
            <div className="border-b border-gray-100 px-3 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Entrepriser
              </div>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {tilgjengeligeEntrepriser.map((ent) => (
              <button
                key={ent.id}
                onClick={() => leggTilEntreprise(ent.id)}
                disabled={leggTilMutation.isPending}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                {ent.name}
              </button>
            ))}
          </div>

          {tilgjengeligeGrupper.length > 0 && (
            <div className="border-b border-t border-gray-100 px-3 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Grupper
              </div>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {tilgjengeligeGrupper.map((g) => (
              <button
                key={g.id}
                onClick={() => leggTilGruppe(g.id)}
                disabled={leggTilMutation.isPending}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <Users className="h-3.5 w-3.5 text-blue-500" />
                {g.name}
              </button>
            ))}
          </div>

          {tilgjengeligeMedlemmer.length > 0 && (
            <div className="border-b border-t border-gray-100 px-3 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Personer
              </div>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {tilgjengeligeMedlemmer.map((m) => (
              <button
                key={m.id}
                onClick={() => leggTilPerson(m.id)}
                disabled={leggTilMutation.isPending}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <User className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <div className="truncate">{m.user.name ?? m.user.email}</div>
                  {m.user.name && (
                    <div className="truncate text-[11px] text-gray-400">{m.user.email}</div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100">
            <button
              onClick={() => {
                setOpen(false);
                if (onInviterNy) onInviterNy();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-sitedoc-primary hover:bg-blue-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Inviter ny person
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  InviterNyMedlemModal                                                */
/* ------------------------------------------------------------------ */

export function InviterNyMedlemModal({
  open,
  onClose,
  prosjektId,
  dokumentflytId,
  rolle,
  steg,
  onFerdig,
}: {
  open: boolean;
  onClose: () => void;
  prosjektId: string;
  dokumentflytId: string;
  rolle: "oppretter" | "svarer";
  steg: number;
  onFerdig: () => void;
}) {
  const [epost, setEpost] = useState("");
  const [fornavn, setFornavn] = useState("");
  const [etternavn, setEtternavn] = useState("");
  const [telefon, setTelefon] = useState("");

  const leggTilMedlemMutation = trpc.medlem.leggTil.useMutation();
  const leggTilDfMedlemMutation = trpc.dokumentflyt.leggTilMedlem.useMutation();

  const [forrigeOpen, setForrigeOpen] = useState(false);
  if (open && !forrigeOpen) {
    setEpost("");
    setFornavn("");
    setEtternavn("");
    setTelefon("");
  }
  if (open !== forrigeOpen) setForrigeOpen(open);

  const erSending = leggTilMedlemMutation.isPending || leggTilDfMedlemMutation.isPending;

  async function handleInviter(e: React.FormEvent) {
    e.preventDefault();
    if (!epost.trim() || !fornavn.trim() || !etternavn.trim()) return;

    try {
      const nyttMedlem = await leggTilMedlemMutation.mutateAsync({
        projectId: prosjektId,
        email: epost.trim(),
        firstName: fornavn.trim(),
        lastName: etternavn.trim(),
        phone: telefon.trim() || undefined,
        role: "member",
        enterpriseIds: [],
      });

      if (nyttMedlem) {
        await leggTilDfMedlemMutation.mutateAsync({
          dokumentflytId,
          projectId: prosjektId,
          projectMemberId: nyttMedlem.id,
          rolle,
          steg,
        });
      }

      onFerdig();
      onClose();
    } catch (_err) {
      // Feilen vises via mutation.error
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Inviter ny person">
      <form onSubmit={handleInviter} className="flex flex-col gap-4">
        <p className="text-sm text-gray-500">
          Personen blir lagt til i prosjektet og denne dokumentflyten, og mottar en invitasjon på e-post.
        </p>

        <Input
          label="E-postadresse"
          type="email"
          placeholder="navn@firma.no"
          value={epost}
          onChange={(e) => setEpost(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fornavn"
            value={fornavn}
            onChange={(e) => setFornavn(e.target.value)}
            required
          />
          <Input
            label="Etternavn"
            value={etternavn}
            onChange={(e) => setEtternavn(e.target.value)}
            required
          />
        </div>

        <Input
          label="Telefon (valgfritt)"
          type="tel"
          value={telefon}
          onChange={(e) => setTelefon(e.target.value)}
        />

        {leggTilMedlemMutation.error && (
          <p className="text-sm text-red-600">
            {leggTilMedlemMutation.error.message}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="submit"
            loading={erSending}
            disabled={!epost.trim() || !fornavn.trim() || !etternavn.trim()}
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Inviter og legg til
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers for compact member display                                 */
/* ------------------------------------------------------------------ */

function MedlemmerKompakt({ medlemmer }: { medlemmer: DokumentflytMedlemData[] }) {
  if (medlemmer.length === 0) return <span className="text-gray-300">—</span>;

  return (
    <span className="text-[12px] text-gray-600">
      {medlemmer.map((m, i) => {
        const navn = m.enterprise?.name ?? m.group?.name ?? m.projectMember?.user.name ?? m.projectMember?.user.email ?? "?";
        return (
          <span key={m.id}>
            {i > 0 && ", "}
            {(m.enterprise || m.group) ? (
              <span className="font-medium">{navn}</span>
            ) : (
              <span>{navn}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  DokumentflytInlineKort — kompakt rad, ekspanderer ved klikk        */
/* ------------------------------------------------------------------ */

export function DokumentflytInlineKort({
  dokumentflyt,
  prosjektId,
  entrepriser,
  medlemmer,
  grupper,
  onRediger,
  onSlett,
  onOppdatert,
  onInviterNy,
}: {
  dokumentflyt: DokumentflytData;
  prosjektId: string;
  entrepriser: EntrepriseItem[];
  medlemmer: ProsjektMedlemItem[];
  grupper?: Array<{ id: string; name: string }>;
  onRediger: () => void;
  onSlett: () => void;
  onOppdatert: () => void;
  onInviterNy: (dokumentflytId: string, rolle: "oppretter" | "svarer", steg: number) => void;
}) {
  const [ekspandert, setEkspandert] = useState(false);

  const fjernMedlemMutation = trpc.dokumentflyt.fjernMedlem.useMutation({
    onSuccess: () => onOppdatert(),
  });

  const opprettere = dokumentflyt.medlemmer.filter((m) => m.rolle === "oppretter");
  const svarere = dokumentflyt.medlemmer.filter((m) => m.rolle === "svarer");

  const stegMap = new Map<number, DokumentflytMedlemData[]>();
  for (const s of svarere) {
    const liste = stegMap.get(s.steg) ?? [];
    liste.push(s);
    stegMap.set(s.steg, liste);
  }
  const sorterteSteg = Array.from(stegMap.entries()).sort(([a], [b]) => a - b);

  const malAntall = dokumentflyt.maler.length;

  function fjernMedlem(id: string) {
    fjernMedlemMutation.mutate({ id, projectId: prosjektId });
  }

  return (
    <div className="rounded border border-gray-200 bg-white">
      {/* Kompakt rad */}
      <div
        className="flex cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-gray-50"
        onClick={() => setEkspandert(!ekspandert)}
      >
        {ekspandert ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
        )}

        <span className="min-w-0 shrink-0 text-[13px] font-medium text-gray-700">
          {dokumentflyt.name}
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-gray-400">
          <span className="shrink-0">Opprett/send:</span>
          <MedlemmerKompakt medlemmer={opprettere} />
          <span className="mx-1 shrink-0">→</span>
          <span className="shrink-0">Mottaker:</span>
          <MedlemmerKompakt medlemmer={svarere} />
        </div>

        {malAntall > 0 && (
          <span className="shrink-0 text-[11px] text-gray-400">
            {malAntall} mal{malAntall !== 1 ? "er" : ""}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onRediger}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            title="Rediger"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={onSlett}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
            title="Slett"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Ekspandert: full redigering */}
      {ekspandert && (
        <div className="border-t border-gray-100">
          <div className="flex divide-x divide-gray-100">
            {/* Opprett/send */}
            <div className="flex-1 p-2.5">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Opprett/send
              </div>
              <MedlemListe
                medlemmer={opprettere}
                entrepriser={entrepriser}
                onFjern={fjernMedlem}
              />
              <div className="mt-1">
                <LeggTilMedlemDropdown
                  dokumentflytId={dokumentflyt.id}
                  prosjektId={prosjektId}
                  rolle="oppretter"
                  steg={1}
                  entrepriser={entrepriser}
                  medlemmer={medlemmer}
                  grupper={grupper}
                  eksisterende={opprettere}
                  onLagtTil={onOppdatert}
                  onInviterNy={() => onInviterNy(dokumentflyt.id, "oppretter", 1)}
                />
              </div>
            </div>

            {/* Mottaker */}
            {sorterteSteg.length > 0 ? (
              sorterteSteg.map(([steg, stegMedlemmer]) => (
                <div key={steg} className="flex-1 p-2.5">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Mottaker{steg > 1 ? ` ${steg}` : ""}
                  </div>
                  <MedlemListe
                    medlemmer={stegMedlemmer}
                    entrepriser={entrepriser}
                    onFjern={fjernMedlem}
                  />
                  <div className="mt-1">
                    <LeggTilMedlemDropdown
                      dokumentflytId={dokumentflyt.id}
                      prosjektId={prosjektId}
                      rolle="svarer"
                      steg={steg}
                      entrepriser={entrepriser}
                      medlemmer={medlemmer}
                      grupper={grupper}
                      eksisterende={stegMedlemmer}
                      onLagtTil={onOppdatert}
                      onInviterNy={() => onInviterNy(dokumentflyt.id, "svarer", steg)}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-1 p-2.5">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Mottaker
                </div>
                <span className="text-xs text-gray-300">Ikke konfigurert</span>
                <div className="mt-1">
                  <LeggTilMedlemDropdown
                    dokumentflytId={dokumentflyt.id}
                    prosjektId={prosjektId}
                    rolle="svarer"
                    steg={1}
                    entrepriser={entrepriser}
                    medlemmer={medlemmer}
                    grupper={grupper}
                    eksisterende={[]}
                    onLagtTil={onOppdatert}
                    onInviterNy={() => onInviterNy(dokumentflyt.id, "svarer", 1)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Maler */}
          {dokumentflyt.maler.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-1.5">
              <div className="flex flex-wrap gap-1">
                {dokumentflyt.maler.map((m) => (
                  <span
                    key={m.template.id}
                    className="inline-flex items-center gap-1 rounded bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-500"
                  >
                    <FileText className="h-2.5 w-2.5" />
                    {m.template.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
