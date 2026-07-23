"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Contact, Mail, Phone, Users } from "lucide-react";
import { Spinner, SearchInput } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";

/**
 * P31 Kontakter — read-only lesevisning (K6-splitt). Personkatalog gruppert
 * per faggruppe: navn, rolle, telefon (tel:) og e-post (mailto:). Gjenbruker
 * samme queries som dokumentflyt-siden (faggruppe + medlem) — ingen CRUD.
 * Redigering av faggrupper/kontakter skjer i Innstillinger → Dokumentflyt.
 */

interface Faggruppe {
  id: string;
  name: string;
  color: string | null;
}

interface ProsjektMedlem {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
  faggruppeKoblinger: Array<{ faggruppe: { id: string; name: string } }>;
}

const FARGE_MAP: Record<string, string> = {
  red: "bg-red-500", orange: "bg-orange-500", amber: "bg-amber-500",
  yellow: "bg-yellow-500", lime: "bg-lime-500", green: "bg-green-500",
  emerald: "bg-emerald-500", teal: "bg-teal-500", cyan: "bg-cyan-500",
  sky: "bg-sky-500", blue: "bg-blue-500", indigo: "bg-indigo-500",
  violet: "bg-violet-500", purple: "bg-purple-500", fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500", rose: "bg-rose-500", slate: "bg-slate-500",
};

function FargePrikk({ farge }: { farge: string | null }) {
  const bg = farge ? FARGE_MAP[farge] ?? "bg-gray-400" : "bg-gray-400";
  return <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${bg}`} />;
}

type Seksjon = { id: string; navn: string; farge: string | null; kontakter: ProsjektMedlem[] };

export default function KontakterLesevisning() {
  useToppbarFiltre({ byggeplass: false });
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;
  const [sok, setSok] = useState("");

  const { data: faggrupper, isLoading: e1 } = trpc.faggruppe.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const { data: medlemmer, isLoading: e2 } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const erLaster = e1 || e2;

  // Grupper medlemmer per faggruppe; samle uten-faggruppe til slutt så ingen
  // kontakt skjules.
  const seksjoner = useMemo<Seksjon[]>(() => {
    const fg = (faggrupper as Faggruppe[] | undefined) ?? [];
    const alle = (medlemmer as ProsjektMedlem[] | undefined) ?? [];
    const perFaggruppe = new Map<string, ProsjektMedlem[]>();
    const utenFaggruppe: ProsjektMedlem[] = [];

    for (const m of alle) {
      if (m.faggruppeKoblinger.length === 0) {
        utenFaggruppe.push(m);
        continue;
      }
      for (const k of m.faggruppeKoblinger) {
        const liste = perFaggruppe.get(k.faggruppe.id) ?? [];
        liste.push(m);
        perFaggruppe.set(k.faggruppe.id, liste);
      }
    }

    const res: Seksjon[] = fg
      .map((f) => ({ id: f.id, navn: f.name, farge: f.color, kontakter: perFaggruppe.get(f.id) ?? [] }))
      .filter((s) => s.kontakter.length > 0);

    if (utenFaggruppe.length > 0) {
      res.push({ id: "__uten__", navn: t("kontakter.utenFaggruppe"), farge: null, kontakter: utenFaggruppe });
    }
    return res;
  }, [faggrupper, medlemmer, t]);

  // Filtrer på navn/e-post/telefon på tvers av seksjoner.
  const filtrert = useMemo<Seksjon[]>(() => {
    const q = sok.trim().toLowerCase();
    if (!q) return seksjoner;
    return seksjoner
      .map((s) => ({
        ...s,
        kontakter: s.kontakter.filter((m) =>
          (m.user.name ?? "").toLowerCase().includes(q) ||
          m.user.email.toLowerCase().includes(q) ||
          (m.user.phone ?? "").toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.kontakter.length > 0);
  }, [seksjoner, sok]);

  function rolleLabel(role: string): string {
    return role === "admin" ? t("kontakter.rolleAdmin") : t("kontakter.rolleMedlem");
  }

  if (!prosjektId) {
    return <p className="p-6 text-sm text-gray-400">{t("kontakter.velgProsjekt")}</p>;
  }

  return (
    <div className="max-w-4xl p-6">
      <SonetonetSidehode sone="prosjekt" className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
              <Contact className="h-6 w-6 text-sitedoc-primary" />
              {t("kontakter.tittel")}
            </h1>
            <p className="mt-1 text-sm text-gray-600">{t("kontakter.beskrivelse")}</p>
          </div>
          <HjelpKnapp>
            <HjelpFane tittel={t("hjelp.kontakter.tittel")}>
              <p>{t("hjelp.kontakter.tekst")}</p>
            </HjelpFane>
          </HjelpKnapp>
        </div>
      </SonetonetSidehode>

      <div className="mb-4 max-w-md">
        <SearchInput verdi={sok} onChange={setSok} placeholder={t("kontakter.sokPlaceholder")} />
      </div>

      {erLaster ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filtrert.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {sok.trim() ? t("kontakter.ingenTreff") : t("kontakter.ingenKontakter")}
        </p>
      ) : (
        <div className="space-y-6">
          {filtrert.map((seksjon) => (
            <section key={seksjon.id}>
              <div className="mb-2 flex items-center gap-2">
                <FargePrikk farge={seksjon.farge} />
                <h2 className="text-sm font-semibold text-gray-900">{seksjon.navn}</h2>
                <span className="text-xs text-gray-400">
                  {seksjon.kontakter.length} {t("kontakter.personerSuffix")}
                </span>
              </div>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {seksjon.kontakter.map((m) => (
                  <li key={`${seksjon.id}-${m.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                    <div className="flex min-w-[160px] flex-1 items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-gray-300" />
                      <span className="text-sm font-medium text-gray-900">
                        {m.user.name ?? m.user.email}
                      </span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                        {rolleLabel(m.role)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {m.user.phone ? (
                        <a
                          href={`tel:${m.user.phone.replace(/\s/g, "")}`}
                          className="inline-flex items-center gap-1.5 text-sitedoc-secondary hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {m.user.phone}
                        </a>
                      ) : null}
                      <a
                        href={`mailto:${m.user.email}`}
                        className="inline-flex items-center gap-1.5 text-sitedoc-secondary hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {m.user.email}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
