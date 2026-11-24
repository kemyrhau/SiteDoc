import { redirect } from "next/navigation";
import { attesteringRedirectUrl } from "@/lib/attestering-ruter";

// w10b (S3): detaljen flyttet til /dashbord/attestering/[id] — retur-konteksten
// (fraVisning/fraUke/fraFane) følger med.
export default function GammelFirmaAttesteringDetalj({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  redirect(attesteringRedirectUrl(`/dashbord/attestering/${encodeURIComponent(params.id)}`, searchParams));
}
