import { redirect } from "next/navigation";
import { attesteringRedirectUrl } from "@/lib/attestering-ruter";

// w10b (plan web-timeføring § 4.10, B29 B): prosjektets attestering er fjernet — prosjektlederen
// attesterer på /dashbord/attestering med sitt omfang. Prosjektet tas ikke med som filter.
export default function GammelProsjektAttestering({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  redirect(attesteringRedirectUrl("/dashbord/attestering", searchParams));
}
