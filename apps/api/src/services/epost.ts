import { Resend } from "resend";
import type { PrismaClient } from "@sitedoc/db";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error(
        "RESEND_API_KEY er ikke satt. Legg til i .env for å aktivere e-postsending.",
      );
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
const FRA_EPOST = process.env.RESEND_FROM_EMAIL ?? "SiteDoc <noreply@sitedoc.no>";

interface InvitasjonsEpostParams {
  til: string;
  invitasjonstoken: string;
  prosjektNavn: string;
  invitertAvNavn: string;
  melding?: string;
}

export async function sendInvitasjonsEpost({
  til,
  invitasjonstoken,
  prosjektNavn,
  invitertAvNavn,
  melding,
}: InvitasjonsEpostParams) {
  const akseptUrl = `${APP_URL}/aksepter-invitasjon?token=${invitasjonstoken}`;

  const meldingSeksjon = melding?.trim()
    ? `<div style="background-color: #f7fafc; border-left: 3px solid #1a365d; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0; font-style: italic;">"${melding.trim()}"</p>
        <p style="color: #718096; font-size: 13px; margin: 4px 0 0;">— ${invitertAvNavn}</p>
      </div>`
    : "";

  const { error } = await getResend().emails.send({
    from: FRA_EPOST,
    to: til,
    subject: `Du er invitert til prosjektet "${prosjektNavn}" på SiteDoc`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
        <h2 style="color: #1a365d; margin-bottom: 8px;">SiteDoc</h2>
        <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
          ${invitertAvNavn} har invitert deg til prosjektet <strong>${prosjektNavn}</strong>.
        </p>
        ${meldingSeksjon}
        <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
          Klikk knappen under for å akseptere invitasjonen og logge inn:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${akseptUrl}" style="display: inline-block; background-color: #1a365d; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Aksepter invitasjon
          </a>
        </div>
        <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">
          Du kan også logge inn direkte på <a href="https://sitedoc.no" style="color: #1a365d; font-weight: 600;">sitedoc.no</a> med din e-postadresse.
        </p>
        <p style="color: #a0aec0; font-size: 13px; line-height: 1.5;">
          Denne invitasjonen utløper om 7 dager. Hvis du ikke kjenner til dette prosjektet, kan du trygt ignorere denne e-posten.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #a0aec0; font-size: 12px;">
          Sendt fra SiteDoc — rapport- og kvalitetsstyring for byggeprosjekter
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Feil ved sending av invitasjons-e-post:", error);
    throw error;
  }
}

interface DokumentVarslingParams {
  til: string[];
  dokumentType: "oppgave" | "sjekkliste";
  dokumentTittel: string;
  dokumentNummer?: string;
  prosjektNavn: string;
  prosjektId: string;
  dokumentId: string;
  avsenderNavn: string;
  kommentar?: string;
  erVideresending?: boolean;
}

export async function sendDokumentVarsling({
  til,
  dokumentType,
  dokumentTittel,
  dokumentNummer,
  prosjektNavn,
  prosjektId,
  dokumentId,
  avsenderNavn,
  kommentar,
  erVideresending,
}: DokumentVarslingParams) {
  if (til.length === 0) return;

  const typeTekst = dokumentType === "oppgave" ? "oppgave" : "sjekkliste";
  const ruteType = dokumentType === "oppgave" ? "oppgaver" : "sjekklister";
  const dokumentUrl = `${APP_URL}/dashbord/${prosjektId}/${ruteType}/${dokumentId}`;
  const tittelVisning = dokumentNummer ? `${dokumentNummer} — ${dokumentTittel}` : dokumentTittel;
  const handling = erVideresending ? "videresendt" : "sendt";

  const kommentarSeksjon = kommentar?.trim()
    ? `<div style="background-color: #f7fafc; border-left: 3px solid #1a365d; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0; font-style: italic;">"${kommentar.trim()}"</p>
        <p style="color: #718096; font-size: 13px; margin: 4px 0 0;">— ${avsenderNavn}</p>
      </div>`
    : "";

  const emne = erVideresending
    ? `${typeTekst.charAt(0).toUpperCase() + typeTekst.slice(1)} videresendt til deg: ${tittelVisning}`
    : `Ny ${typeTekst} mottatt: ${tittelVisning}`;

  try {
    await getResend().emails.send({
      from: FRA_EPOST,
      to: til,
      subject: emne,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #1a365d; margin-bottom: 8px;">SiteDoc</h2>
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
            ${avsenderNavn} har ${handling} en ${typeTekst} til deg i prosjektet <strong>${prosjektNavn}</strong>.
          </p>
          <div style="background-color: #f0f4f8; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #1a365d; font-size: 15px; font-weight: 600; margin: 0;">${tittelVisning}</p>
          </div>
          ${kommentarSeksjon}
          <div style="text-align: center; margin: 32px 0;">
            <a href="${dokumentUrl}" style="display: inline-block; background-color: #1a365d; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Åpne ${typeTekst}
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #a0aec0; font-size: 12px;">
            Sendt fra SiteDoc — rapport- og kvalitetsstyring for byggeprosjekter
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Feil ved sending av dokumentvarsling:", err);
    // Ikke kast feil — varsling skal ikke blokkere statusendring
  }
}

/**
 * Hent e-postadresser for mottaker (bruker eller gruppemedlemmer).
 * Ekskluderer avsender for å unngå varsling til seg selv.
 */
export async function hentMottakerEposter(
  prisma: PrismaClient,
  opts: { recipientUserId?: string | null; recipientGroupId?: string | null; ekskluderUserId: string },
): Promise<string[]> {
  const eposter: string[] = [];

  if (opts.recipientUserId) {
    const bruker = await prisma.user.findUnique({
      where: { id: opts.recipientUserId },
      select: { email: true },
    });
    if (bruker?.email && opts.recipientUserId !== opts.ekskluderUserId) {
      eposter.push(bruker.email);
    }
  } else if (opts.recipientGroupId) {
    const gruppemedlemmer = await prisma.projectGroupMember.findMany({
      where: { groupId: opts.recipientGroupId },
      select: { projectMember: { select: { user: { select: { id: true, email: true } } } } },
    });
    for (const gm of gruppemedlemmer) {
      if (gm.projectMember.user.email && gm.projectMember.user.id !== opts.ekskluderUserId) {
        eposter.push(gm.projectMember.user.email);
      }
    }
  }

  return eposter;
}
