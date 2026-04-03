import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

// Hjelpefunksjon for å finne PSI med prosjekt + bygning (null = prosjektnivå)
function psiWhere(projectId: string, buildingId?: string | null) {
  return {
    projectId_buildingId: {
      projectId,
      buildingId: buildingId ?? null,
    },
  } as const;
}

export const psiRouter = router({
  // Hent alle PSI-er for prosjektet (prosjektnivå + per bygning)
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.psi.findMany({
        where: { projectId: input.projectId },
        include: {
          template: { select: { id: true, name: true, prefix: true } },
          building: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Hent én PSI med mal-objekter (for gjennomføring)
  hentMedObjekter: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({
        where: { id: input.psiId },
        include: {
          template: { include: { objects: { orderBy: { sortOrder: "asc" } } } },
          building: { select: { id: true, name: true } },
        },
      });
      await verifiserProsjektmedlem(ctx.userId, psi.projectId);
      return psi;
    }),

  // Opprett PSI (admin) — auto-oppretter mal med 8 seksjoner
  opprett: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      buildingId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: input.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN", message: "Kun admin kan opprette PSI" });

      // Hent bygningsnavn for malnavn
      let bygningNavn = "";
      if (input.buildingId) {
        const bygning = await ctx.prisma.building.findUnique({ where: { id: input.buildingId }, select: { name: true } });
        bygningNavn = bygning?.name ? ` — ${bygning.name}` : "";
      }

      // Auto-opprett mal med 8 PSI-seksjoner
      const mal = await ctx.prisma.reportTemplate.create({
        data: {
          projectId: input.projectId,
          name: `Sikkerhetsinstruks${bygningNavn}`,
          prefix: "PSI",
          category: "psi",
          version: 1,
        },
      });

      // Ferdig strukturerte PSI-seksjoner med standardinnhold og subtile hint
      const seksjoner: Array<{ type: string; label: string; config?: object }[]> = [
        [
          { type: "heading", label: "1. Velkommen og prosjektinfo" },
          { type: "info_text", label: "Prosjektinfo", config: { content: `Velkommen til denne byggeplassen. Denne sikkerhetsinstruksen gir deg oversikt over de viktigste sikkerhetsreglene og rutinene du må kjenne til før arbeidet starter.

Prosjekt: Tverrlia Borettslag
Adresse: Eksempelveien 12, 0123 Oslo
Byggherre: Boligbyggelaget AS
Hovedentreprenør: Bygg & Anlegg AS

Koordinator utførelse (KU): Kari Nordmann, 900 00 000
HMS-ansvarlig: Ola Hansen, 900 00 001
Verneombud: Per Nilsen, 900 00 002

Ved spørsmål om HMS, kontakt HMS-ansvarlig eller din nærmeste leder.` } },
        ],
        [
          { type: "heading", label: "2. Nødprosedyrer" },
          { type: "info_text", label: "Nødprosedyrer", config: { content: `Ved nødsituasjon:
• Brann: Ring 110
• Politi: Ring 112
• Ambulanse: Ring 113

Byggeplassens nødnummer: 900 00 003
Møteplass ved evakuering: Ved hovedporten, markert med grønt skilt

Førstehjelpsutstyr finnes ved: Brakkeriggen, 2. etasje inngangsparti
Hjertestarter (AED) finnes ved: Brakkeriggen, ved resepsjonen
Brannslukker finnes ved: Hvert etasjeplan og i brakkeriggen

Evakueringsrutene er merket med grønne skilt. Gjør deg kjent med nærmeste nødutgang fra ditt arbeidsområde.` } },
          { type: "info_image", label: "Evakueringskart", config: { imageUrl: "", caption: "Evakueringskart med møteplass og nødutganger" } },
        ],
        [
          { type: "heading", label: "3. Påkrevd verneutstyr" },
          { type: "info_text", label: "Verneutstyr", config: { content: `Følgende verneutstyr er alltid påkrevd på byggeplassen:
• Hjelm (EN 397)
• Vernesko med tåbeskyttelse (EN ISO 20345 S3)
• Refleksvest / synlighetsklær (EN ISO 20471)
• Vernebriller ved fare for sprut eller partikler

Aktivitetsbasert verneutstyr:
• Hørselsvern ved støynivå over 85 dB
• Fallsikring ved arbeid over 2 meter
• Åndedrettsvern ved støv, gass eller røyk
• Ansiktsskjerm ved sveising og kapping
• Hansker tilpasset arbeidsoppgaven

Mangler du verneutstyr? Kontakt din arbeidsleder eller HMS-ansvarlig.` } },
        ],
        [
          { type: "heading", label: "4. Rigg og adkomst" },
          { type: "info_text", label: "Rigg og adkomst", config: { content: `Adkomst og ferdsel:
• Bruk kun godkjente adkomstveier — følg skilting og sperringer
• Fartsgrense på riggområdet: 20 km/t
• Parkering kun på anviste plasser

Inngang for personell: Hovedport, østsiden
Vareleveranse: Vestporten, etter avtale med anleggsleder
Besøkende: Alle besøkende skal registreres ved hovedport og ha følge

Riggplan og oversiktskart er tilgjengelig ved hovedinngang og i brakkeriggen.` } },
          { type: "info_image", label: "Riggplan", config: { imageUrl: "", caption: "Riggplan med adkomst, parkering og leveringssone" } },
        ],
        [
          { type: "heading", label: "5. Sikkerhetsregler" },
          { type: "info_text", label: "Sikkerhetsregler", config: { content: `Generelle sikkerhetsregler:
• Rusmidler er strengt forbudt på byggeplassen
• Rydd etter deg — god orden er god sikkerhet
• Sikre arbeidsområdet med sperring ved fare for andre
• Meld fra om alle avvik, nestenulykker og farlige forhold
• Arbeid i høyden krever alltid fallsikringsplan
• Varme arbeider krever godkjent SJA og brannvakthold
• Gravearbeid krever påvisning av kabler og rør
• Ikke fjern andres sperring eller sikring uten tillatelse

Arbeidstid: 07:00 – 16:00 (støyende arbeid 08:00 – 17:00)
Avviksmelding: Meld avvik til din arbeidsleder eller bruk SiteDoc

Full HMS-plan og SHA-plan er tilgjengelig hos HMS-ansvarlig og i prosjektets dokumentmappe.` } },
        ],
        [
          { type: "heading", label: "6. Risikoforhold på denne byggeplassen" },
          { type: "info_text", label: "Risikoforhold", config: { content: `Gjør deg kjent med følgende risikoforhold som gjelder dette prosjektet:

• Kranløft i sone A — sperret sone, opphold under last forbudt
• Åpne sjakter i kjeller — sikret med rekkverk, ikke fjern sperring
• Tungtrafikk på riggvei — hold avstand til anleggsmaskiner
• Rivingsarbeid i bygg B — støv og asbest, eget saneringsfelt

Risikovurderinger (SJA) for ditt arbeidsområde finnes i prosjektets HMS-dokumentasjon. Spør din arbeidsleder om du er usikker på risikoen i ditt arbeidsområde.` } },
          { type: "info_image", label: "Risikoområder", config: { imageUrl: "", caption: "Oversikt over risikoområder og sperrede soner" } },
        ],
        [
          { type: "heading", label: "7. Byggeplassomvisning" },
          { type: "info_text", label: "Videointro", config: { content: "Se videoen under for en visuell gjennomgang av byggeplassen, nødutganger og viktige sikkerhetsforhold." } },
          { type: "video", label: "Sikkerhetsvideo", config: { url: "" } },
        ],
        [
          { type: "heading", label: "8. Kontrollspørsmål" },
          { type: "quiz", label: "Møteplass", config: { question: "Hvor er møteplassen ved evakuering?", options: ["I kantina", "Ved hovedporten", "Se evakueringskart for din bygning"], correctIndex: 2 } },
          { type: "quiz", label: "Avvik", config: { question: "Hva gjør du hvis du oppdager en farlig situasjon?", options: ["Ignorerer det — ikke mitt ansvar", "Melder avvik til arbeidsleder eller i SiteDoc", "Venter til noen andre reagerer"], correctIndex: 1 } },
          { type: "quiz", label: "Verneutstyr", config: { question: "Hvilket verneutstyr er alltid påkrevd?", options: ["Bare hjelm", "Hjelm, vernesko, refleksvest og vernebriller", "Det bestemmer jeg selv ut fra situasjonen"], correctIndex: 1 } },
          { type: "signature", label: "Signatur" },
        ],
      ];

      let sortOrder = 0;
      for (const seksjon of seksjoner) {
        for (const obj of seksjon) {
          await ctx.prisma.reportObject.create({
            data: {
              templateId: mal.id,
              type: obj.type,
              label: obj.label,
              config: obj.config ?? {},
              required: obj.type === "signature" || obj.type === "quiz",
              sortOrder: sortOrder++,
            },
          });
        }
      }

      const psi = await ctx.prisma.psi.create({
        data: {
          projectId: input.projectId,
          buildingId: input.buildingId ?? null,
          templateId: mal.id,
          version: 1,
        },
        include: {
          template: { select: { id: true, name: true, prefix: true } },
          building: { select: { id: true, name: true } },
        },
      });

      return { ...psi, templateId: mal.id };
    }),

  // Bump versjon — krev ny signering
  bumpVersjon: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: psi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.psi.update({
        where: { id: input.psiId },
        data: { version: psi.version + 1 },
      });
    }),

  // Bytt mal (bumper versjon — ny mal = ny signering)
  byttMal: protectedProcedure
    .input(z.object({
      psiId: z.string().uuid(),
      templateId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: psi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.psi.update({
        where: { id: input.psiId },
        data: { templateId: input.templateId, version: psi.version + 1 },
      });
    }),

  // Deaktiver PSI (soft delete — malen bevares)
  deaktiver: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: psi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.prisma.psi.update({ where: { id: input.psiId }, data: { active: false } });
    }),

  // Reaktiver PSI
  reaktiver: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: psi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.prisma.psi.update({ where: { id: input.psiId }, data: { active: true } });
    }),

  // Oppdater gjeste-beskjed (regler for gjester uten HMS-kort)
  oppdaterGjesteBeskjed: protectedProcedure
    .input(z.object({ psiId: z.string().uuid(), guestMessage: z.string().max(2000).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: psi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.prisma.psi.update({ where: { id: input.psiId }, data: { guestMessage: input.guestMessage } });
    }),

  // Dashboard: hent alle signaturer for én PSI
  hentSignaturer: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: psi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });

      const signaturer = await ctx.prisma.psiSignatur.findMany({
        where: { psiId: input.psiId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { startedAt: "desc" },
      });

      return {
        signaturer: signaturer.map((s) => ({
          id: s.id,
          brukerNavn: s.user?.name ?? s.guestName ?? "Ukjent",
          brukerEpost: s.user?.email ?? null,
          firma: s.guestCompany ?? null,
          erGjest: !s.userId,
          signertVersjon: s.psiVersion,
          gjeldende: s.psiVersion === psi.version,
          fullfort: !!s.completedAt,
          fullfortDato: s.completedAt,
          startetDato: s.startedAt,
          progresjon: s.progress,
          spraak: s.language,
          hmsKortNr: s.hmsKortNr ?? null,
          harIkkeHmsKort: s.harIkkeHmsKort,
        })),
        versjon: psi.version,
      };
    }),

  // Min status: har jeg signert?
  hentMinStatus: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      await verifiserProsjektmedlem(ctx.userId, psi.projectId);

      const signatur = await ctx.prisma.psiSignatur.findUnique({
        where: { psiId_userId: { psiId: input.psiId, userId: ctx.userId } },
      });

      return {
        signert: !!signatur?.completedAt,
        utdatert: signatur ? signatur.psiVersion < psi.version : false,
        versjon: psi.version,
        progresjon: signatur?.progress ?? 0,
      };
    }),

  // Start gjennomføring
  startGjennomforing: protectedProcedure
    .input(z.object({ psiId: z.string().uuid(), language: z.string().default("nb") }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({
        where: { id: input.psiId },
        include: { template: { include: { objects: { orderBy: { sortOrder: "asc" } } } } },
      });
      await verifiserProsjektmedlem(ctx.userId, psi.projectId);

      let signatur = await ctx.prisma.psiSignatur.findUnique({
        where: { psiId_userId: { psiId: input.psiId, userId: ctx.userId } },
      });

      if (!signatur || signatur.psiVersion < psi.version) {
        if (signatur) await ctx.prisma.psiSignatur.delete({ where: { id: signatur.id } });
        signatur = await ctx.prisma.psiSignatur.create({
          data: { psiId: input.psiId, psiVersion: psi.version, userId: ctx.userId, language: input.language },
        });
      }

      return { signaturId: signatur.id, psiVersjon: psi.version, progresjon: signatur.progress, template: psi.template };
    }),

  // Oppdater progresjon
  oppdaterProgresjon: protectedProcedure
    .input(z.object({ signaturId: z.string().uuid(), progress: z.number().int().min(0), data: z.record(z.unknown()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({ where: { id: input.signaturId } });
      if (signatur.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Allerede fullført" });
      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: { progress: input.progress, ...(input.data ? { data: input.data as object } : {}) },
      });
    }),

  // Fullfør med signatur + HMS-kortnummer
  fullfør: protectedProcedure
    .input(z.object({
      signaturId: z.string().uuid(),
      signatureData: z.string().min(1),
      hmsKortNr: z.string().regex(/^\d{7}$/, "HMS-kortnummer må være 7 siffer").optional(),
      data: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({ where: { id: input.signaturId } });
      if (signatur.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Allerede fullført" });
      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: {
          signatureData: input.signatureData,
          completedAt: new Date(),
          ...(input.hmsKortNr ? { hmsKortNr: input.hmsKortNr } : {}),
          ...(input.data ? { data: input.data as object } : {}),
        },
      });
    }),

  // Gjest: start (inkl. HMS-kort eller "har ikke HMS-kort")
  guestStart: publicProcedure
    .input(z.object({
      psiId: z.string().uuid(),
      name: z.string().min(1).max(200),
      company: z.string().min(1).max(200),
      phone: z.string().max(30).optional(),
      hmsKortNr: z.string().regex(/^\d{7}$/, "HMS-kortnummer må være 7 siffer").optional(),
      harIkkeHmsKort: z.boolean().default(false),
      language: z.string().default("nb"),
    }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({
        where: { id: input.psiId },
        include: { template: { include: { objects: { orderBy: { sortOrder: "asc" } } } } },
      });
      const signatur = await ctx.prisma.psiSignatur.create({
        data: {
          psiId: input.psiId,
          psiVersion: psi.version,
          guestName: input.name,
          guestCompany: input.company,
          guestPhone: input.phone,
          hmsKortNr: input.hmsKortNr ?? null,
          harIkkeHmsKort: input.harIkkeHmsKort,
          language: input.language,
        },
      });
      return { signaturId: signatur.id, psiVersjon: psi.version, template: psi.template, guestMessage: psi.guestMessage };
    }),

  // Gjest: oppdater progresjon
  guestOppdaterProgresjon: publicProcedure
    .input(z.object({ signaturId: z.string().uuid(), progress: z.number().int().min(0), data: z.record(z.unknown()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({ where: { id: input.signaturId } });
      if (signatur.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Ikke en gjest-signatur" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST" });
      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: { progress: input.progress, ...(input.data ? { data: input.data as object } : {}) },
      });
    }),

  // Gjest: fullfør
  guestFullfør: publicProcedure
    .input(z.object({
      signaturId: z.string().uuid(),
      signatureData: z.string().min(1),
      hmsKortNr: z.string().regex(/^\d{7}$/, "HMS-kortnummer må være 7 siffer").optional(),
      harIkkeHmsKort: z.boolean().optional(),
      data: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({ where: { id: input.signaturId } });
      if (signatur.userId) throw new TRPCError({ code: "FORBIDDEN" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST" });
      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: {
          signatureData: input.signatureData,
          completedAt: new Date(),
          ...(input.hmsKortNr ? { hmsKortNr: input.hmsKortNr } : {}),
          ...(input.harIkkeHmsKort !== undefined ? { harIkkeHmsKort: input.harIkkeHmsKort } : {}),
          ...(input.data ? { data: input.data as object } : {}),
        },
      });
    }),

  // Offentlig: hent PSI-er for prosjekt (gjestesiden — bygningsvalg + guestMessage)
  hentForProsjektPublic: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.psi.findMany({
        where: { projectId: input.projectId, active: true },
        select: {
          id: true,
          version: true,
          guestMessage: true,
          building: { select: { id: true, name: true } },
          template: { select: { id: true, name: true, prefix: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Kopier PSI til annen bygning (deep copy av mal + rapportobjekter)
  kopier: protectedProcedure
    .input(z.object({
      psiId: z.string().uuid(),
      targetBuildingId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const kildePsi = await ctx.prisma.psi.findUniqueOrThrow({
        where: { id: input.psiId },
        include: {
          template: { include: { objects: { orderBy: { sortOrder: "asc" } } } },
          building: { select: { name: true } },
        },
      });

      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: kildePsi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });

      // Sjekk at målbygning ikke allerede har PSI
      const eksisterende = await ctx.prisma.psi.findUnique({
        where: { projectId_buildingId: { projectId: kildePsi.projectId, buildingId: input.targetBuildingId } },
      });
      if (eksisterende) throw new TRPCError({ code: "CONFLICT", message: "Bygningen har allerede en PSI" });

      // Hent målbygnings navn
      const målBygning = await ctx.prisma.building.findUniqueOrThrow({
        where: { id: input.targetBuildingId },
        select: { name: true },
      });

      // Deep copy av mal
      const nyMal = await ctx.prisma.reportTemplate.create({
        data: {
          projectId: kildePsi.projectId,
          name: `${kildePsi.template.name} — ${målBygning.name}`,
          prefix: kildePsi.template.prefix,
          category: "psi",
          version: 1,
        },
      });

      // Kopier rapportobjekter (flat — bevar parent_id-mapping)
      const idMapping = new Map<string, string>();
      for (const obj of kildePsi.template.objects) {
        const nyttObj = await ctx.prisma.reportObject.create({
          data: {
            templateId: nyMal.id,
            type: obj.type,
            label: obj.label,
            config: obj.config as object ?? {},
            required: obj.required,
            sortOrder: obj.sortOrder,
            parentId: obj.parentId ? idMapping.get(obj.parentId) ?? null : null,
          },
        });
        idMapping.set(obj.id, nyttObj.id);
      }

      // Opprett PSI for målbygning
      return ctx.prisma.psi.create({
        data: {
          projectId: kildePsi.projectId,
          buildingId: input.targetBuildingId,
          templateId: nyMal.id,
          version: 1,
        },
        include: {
          template: { select: { id: true, name: true, prefix: true } },
          building: { select: { id: true, name: true } },
        },
      });
    }),
});
