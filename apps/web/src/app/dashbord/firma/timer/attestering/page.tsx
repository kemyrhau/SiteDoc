import { redirect } from "next/navigation";
import { attesteringRedirectUrl } from "@/lib/attestering-ruter";

// w10b (S3): attesteringen flyttet til /dashbord/attestering — gamle lenker og bokmerker
// sendes dit med visning/uke/fane i behold.
export default function GammelFirmaAttestering({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  redirect(attesteringRedirectUrl("/dashbord/attestering", searchParams));
}
