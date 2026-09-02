/**
 * Prosjekttilgang-evaluator (registreringsmodell fase 3, 2026-09-02).
 *
 * Fase 2 la til OrganizationMember.prosjektTilgang ("alle" | "avdeling" | "manuell",
 * NULL = arv OrganizationSetting.prosjektTilgangDefault) — men INGENTING evaluerte
 * feltet (skjemakommentaren sa det selv: «LAGRES i fase 2, EVALUERES IKKE»).
 * Konsekvens: hver ansatt måtte legges til manuelt i hvert prosjekt før han kunne
 * føre timer. Denne funksjonen er evaluatoren — ÉN delt kilde for begge hendelsene:
 *
 *   A. Nytt prosjekt (prosjekt.opprett)  → alle aktive ansatte med regel "alle".
 *   B. Ny ansatt (organisasjon.inviterBruker) → personen inn i firmaets prosjekter,
 *      hvis hans regel er "alle".
 *
 * Én funksjon, to retninger: kalleren bestemmer akse (prosjekter × kandidater),
 * evaluatoren avgjør hvem som faktisk skal med. To kopier ville driftet fra
 * hverandre, og dette er tilgang til prosjektets DOKUMENTER — ikke bare timeføring.
 *
 * FENCES (registreringsmodell-ordre 2026-09-02):
 *  1. role = "member", ALDRI kanAttestere/erFirmaansvarlig/admin. sikreProsjektmedlemmer
 *     setter kun role — vi sender aldri kapabiliteter herfra.
 *  2. Deaktiverte ansatte provisjoneres ALDRI. sikreProsjektmedlemmer validerer HVER
 *     userId mot aktivAnsattIFirmaWhere (status="aktiv" + canLogin) → fanget gratis.
 *     Kandidatspørringen her bruker samme where, så deaktiverte faller ut to ganger.
 *  3. Uoppfordret automatikk overskriver aldri en menneskelig handling. Evaluatoren
 *     BARE legger til (sikreProsjektmedlemmer er idempotent, sletter aldri) og fyres
 *     kun ved de to opprettelses-hendelsene — den reconciler ALDRI et eksisterende
 *     (prosjekt, person)-par på en senere kjøring. Fjerner noen en person manuelt fra
 *     et prosjekt, blir han ikke dratt inn igjen, fordi ingenting rekjører over paret.
 *  4. "manuell" forblir firmadefault (Kenneth-vedtak, schema.prisma:360-368). Ikke
 *     endret her.
 *  5. Standalone-prosjekt (organizationId = null) har intet firma og ingen regel →
 *     no-op, ingenting krasjer.
 *
 * BLOKKERT: "avdeling" — Project har ingen avdelingId (kun OrganizationMember +
 * Oppmotested). Behandles som "manuell" (ingen provisjonering) og telles i
 * avdelingBehandletSomManuell så kalleren kan si det eksplisitt i kvitteringen.
 * Ikke funnet opp en prosjekt-avdeling.
 */
import { type Prisma, type PrismaClient } from "@sitedoc/db";
import { aktivAnsattIFirmaWhere, sikreProsjektmedlemmer } from "./ansatt";

type TxClient = Prisma.TransactionClient;

export interface ProvisjonerResultat {
  /** Antall nye ProjectMember-rader opprettet (summert over prosjektene). */
  lagtTil: number;
  /** Antall kandidater hvis effektive regel var "avdeling" — behandlet som "manuell". */
  avdelingBehandletSomManuell: number;
}

/**
 * 🔴 KALLES KUN VED OPPRETTELSE (nytt prosjekt / ny ansatt). Aldri periodisk,
 * aldri fra en synk- eller reparasjonsrutine, aldri fra en «synkroniser
 * medlemmer»-knapp. Fencen mot å dra inn manuelt fjernede personer hviler på
 * FRAVÆR AV REKJØRING over et eksisterende (prosjekt, person)-par — funksjonen
 * selv har INGEN tombstone og vil legge dem inn igjen hvis den kalles på nytt.
 * Konsekvensen ved brudd: personer noen bevisst fjernet fra et prosjekt får
 * dokumentinnsyn tilbake. Trenger noen en rekjøring, må den fencen (en tombstone
 * / «fjernet manuelt»-markør på ProjectMember) bygges FØRST.
 *
 * Provisjoner prosjektmedlemskap etter firmaets prosjekttilgang-regel.
 *
 * @param organizationId eier-firma. null = standalone → no-op (fence 5).
 * @param projectIds     prosjektene som skal fylles. A: [det nye]. B: alle firmaets.
 * @param kandidatUserIds begrens til disse brukerne. undefined = alle aktive ansatte
 *                        i firmaet (retning A). Én userId (retning B) = kun den personen.
 *
 * Kun kandidater med effektiv regel "alle" provisjoneres. Effektiv regel =
 * member.prosjektTilgang ?? firmadefault. Delegerer selve skrivingen til
 * sikreProsjektmedlemmer (idempotent, validerer aktiv ansettelse, role="member").
 */
export async function provisjonerProsjektmedlemskap(
  tx: TxClient,
  params: {
    organizationId: string | null;
    projectIds: string[];
    kandidatUserIds?: string[];
  },
): Promise<ProvisjonerResultat> {
  const resultat: ProvisjonerResultat = { lagtTil: 0, avdelingBehandletSomManuell: 0 };

  // Fence 5: standalone-prosjekt uten firma har ingen regel.
  if (!params.organizationId) return resultat;
  if (params.projectIds.length === 0) return resultat;

  const setting = await tx.organizationSetting.findUnique({
    where: { organizationId: params.organizationId },
    select: { prosjektTilgangDefault: true },
  });
  // Skjemadefault er "manuell" (fence 4). Mangler settings-rad → samme sikre default.
  const firmadefault = setting?.prosjektTilgangDefault ?? "manuell";

  // Kandidater: aktive, brukbare ansatte i firmaet (fence 2), evt. begrenset til
  // en oppgitt delmengde (retning B: den nye personen).
  const kandidater = await tx.organizationMember.findMany({
    where: {
      ...aktivAnsattIFirmaWhere(params.organizationId),
      ...(params.kandidatUserIds ? { userId: { in: params.kandidatUserIds } } : {}),
    },
    select: { userId: true, prosjektTilgang: true },
  });

  const medUserIds: string[] = [];
  for (const k of kandidater) {
    const regel = k.prosjektTilgang ?? firmadefault;
    if (regel === "alle") {
      medUserIds.push(k.userId);
    } else if (regel === "avdeling") {
      // BLOKKERT til Project.avdelingId finnes — behandles som "manuell".
      resultat.avdelingBehandletSomManuell += 1;
    }
    // "manuell" (og alt annet ukjent) → ingen automatisk provisjonering.
  }

  if (medUserIds.length === 0) return resultat;

  for (const projectId of params.projectIds) {
    const r = await sikreProsjektmedlemmer(tx, {
      projectId,
      organizationId: params.organizationId,
      userIds: medUserIds,
      role: "member",
    });
    resultat.lagtTil += r.lagtTil;
  }

  return resultat;
}

/**
 * Retning B (ny ansatt onboardes) — provisjoner den nye personen inn i firmaets
 * eksisterende prosjekter etter samme regel som retning A. Glue rundt den delte
 * evaluatoren: henter firmaets prosjekter og kaller provisjonerProsjektmedlemskap
 * med personen som eneste kandidat.
 *
 * Wrapper i $transaction fordi inviterBruker ellers gjør ikke-transaksjonelle
 * skrivinger — provisjoneringen skal være atomisk for seg. Effektiv regel "alle"
 * → medlem i alle firmaets prosjekter; "manuell"/"avdeling" → ingen (default er
 * "manuell", så en vanlig invitasjon legger ingen inn — bevisst, fence 4).
 */
export async function provisjonerNyAnsattIProsjekter(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
): Promise<ProvisjonerResultat> {
  const prosjekter = await prisma.project.findMany({
    where: { primaryOrganizationId: organizationId },
    select: { id: true },
  });
  if (prosjekter.length === 0) {
    return { lagtTil: 0, avdelingBehandletSomManuell: 0 };
  }

  return prisma.$transaction((tx) =>
    provisjonerProsjektmedlemskap(tx, {
      organizationId,
      projectIds: prosjekter.map((p) => p.id),
      kandidatUserIds: [userId],
    }),
  );
}
