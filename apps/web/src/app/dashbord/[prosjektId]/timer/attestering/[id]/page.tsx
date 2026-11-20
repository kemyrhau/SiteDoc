import { redirect } from "next/navigation";
import { attesteringRedirectUrl } from "@/lib/attestering-ruter";

// w10b (plan web-timeføring § 4.10, B29 B): prosjektets detaljside er fjernet — samme dag
// åpnes på /dashbord/attestering/[id].
export default function GammelProsjektAttesteringDetalj({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  redirect(attesteringRedirectUrl(`/dashbord/attestering/${encodeURIComponent(params.id)}`, searchParams));
}
