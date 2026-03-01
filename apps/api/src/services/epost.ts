import { Resend } from "resend";

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
const FRA_EPOST = process.env.RESEND_FROM_EMAIL ?? "SiteFlow <noreply@siteflow.no>";

interface InvitasjonsEpostParams {
  til: string;
  invitasjonstoken: string;
  prosjektNavn: string;
  invitertAvNavn: string;
}

export async function sendInvitasjonsEpost({
  til,
  invitasjonstoken,
  prosjektNavn,
  invitertAvNavn,
}: InvitasjonsEpostParams) {
  const akseptUrl = `${APP_URL}/aksepter-invitasjon?token=${invitasjonstoken}`;

  const { error } = await getResend().emails.send({
    from: FRA_EPOST,
    to: til,
    subject: `Du er invitert til prosjektet "${prosjektNavn}" på SiteFlow`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
        <h2 style="color: #1a365d; margin-bottom: 8px;">SiteFlow</h2>
        <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
          ${invitertAvNavn} har invitert deg til prosjektet <strong>${prosjektNavn}</strong>.
        </p>
        <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
          Klikk knappen under for å akseptere invitasjonen og logge inn:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${akseptUrl}" style="display: inline-block; background-color: #1a365d; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Aksepter invitasjon
          </a>
        </div>
        <p style="color: #a0aec0; font-size: 13px; line-height: 1.5;">
          Denne invitasjonen utløper om 7 dager. Hvis du ikke kjenner til dette prosjektet, kan du trygt ignorere denne e-posten.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #a0aec0; font-size: 12px;">
          Sendt fra SiteFlow — rapport- og kvalitetsstyring for byggeprosjekter
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Feil ved sending av invitasjons-e-post:", error);
    throw error;
  }
}
