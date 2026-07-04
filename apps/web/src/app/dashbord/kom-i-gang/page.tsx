"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { Card, Button } from "@sitedoc/ui";
import { CheckCircle, Building2, Users, ClipboardCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useFirma } from "@/kontekst/firma-kontekst";

const FUNKSJONER = [
  {
    ikon: Building2,
    tittel: "Prosjektstyring",
    beskrivelse: "Opprett og administrer byggeprosjekter med full oversikt",
  },
  {
    ikon: ClipboardCheck,
    tittel: "Sjekklister og oppgaver",
    beskrivelse: "Strukturerte maler med 23 felttyper og dokumentflyt",
  },
  {
    ikon: Users,
    tittel: "Samarbeid",
    beskrivelse: "Inviter brukere, tildel roller og styr tilgang per faggruppe",
  },
];

export default function KomIGangSide() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();
  const { valgtFirma, erSitedocAdmin, kanAdministrereFirma, isLoading: firmaLaster } =
    useFirma();

  // Sitedoc_admin er ikke målgruppe for «kom-i-gang» (siden heter «kom i gang»
  // og prøveperiode-framing passer ikke for superadmin som onboarder kunder).
  // Med valgt firma → /nytt-prosjekt (har info-banner for sitedoc_admin fra Steg 2d).
  // Uten valgt firma → /admin/firmaer for å velge eller opprette firma først.
  useEffect(() => {
    if (firmaLaster) return;
    if (!erSitedocAdmin) return;
    if (valgtFirma) {
      router.replace("/dashbord/nytt-prosjekt");
    } else {
      router.replace("/dashbord/admin/firmaer");
    }
  }, [erSitedocAdmin, valgtFirma, firmaLaster, router]);

  // _data: unknown unngår TS2589 «Type instantiation excessively deep» som
  // utløses av Zod-required-felter på opprettTestprosjekt (CLAUDE.md § tRPC
  // TS2589-fallgruven, samme mønster som nytt-prosjekt/page.tsx).
  const opprettMutation = trpc.prosjekt.opprettTestprosjekt.useMutation({
    onSuccess: (_data: unknown) => {
      const prosjekt = _data as { id: string };
      router.push(`/dashbord/${prosjekt.id}`);
    },
  });

  return (
    <main className="flex-1 overflow-auto bg-gray-50">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Velkommen til SiteDoc
          </h1>
          <p className="mt-2 text-gray-500">
            {session?.user?.name
              ? `Hei, ${session.user.name}!`
              : "Hei!"}{" "}
            Kom i gang med ditt første prosjekt.
          </p>
        </div>

        <div className="mb-8 grid gap-4">
          {FUNKSJONER.map((f) => (
            <Card key={f.tittel} className="flex flex-row items-start gap-4">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <f.ikon className="h-5 w-5 text-sitedoc-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{f.tittel}</h3>
                <p className="text-sm text-gray-500">{f.beskrivelse}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* 2026-05-23: firma påkrevd ved opprett. Vis amber-varsel hvis
            ingen firma er valgt i topbaren — gjenbruker i18n-nøkkelen fra
            nytt-prosjekt-flyten. */}
        {!valgtFirma && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="text-amber-900">
              {t("nyttProsjekt.ingenFirma")}
            </div>
          </div>
        )}

        <Card className="text-center">
          <div className="mb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Gratis prøveperiode
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Prøv SiteDoc gratis i 30 dager med ferdigoppsatte maler og moduler.
            </p>
          </div>
          <Button
            onClick={() =>
              valgtFirma?.id &&
              kanAdministrereFirma &&
              opprettMutation.mutate({ organizationId: valgtFirma.id })
            }
            loading={opprettMutation.isPending}
            disabled={!valgtFirma?.id || !kanAdministrereFirma}
            className="w-full"
          >
            Start gratis prøveperiode
          </Button>
          {/* Sak #5: opprett-evne holdes admin-only selv om valgtFirma er
              populert for innsyn. */}
          {valgtFirma && !kanAdministrereFirma && (
            <p className="mt-2 text-sm text-gray-500">
              Du har ikke tilgang til å opprette prosjekt.
            </p>
          )}
          {opprettMutation.error && (
            <p className="mt-2 text-sm text-sitedoc-error">
              {opprettMutation.error.message}
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
