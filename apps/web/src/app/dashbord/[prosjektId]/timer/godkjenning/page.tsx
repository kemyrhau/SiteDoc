import { redirect } from "next/navigation";

export default function GodkjenningRedirect({
  params,
}: {
  params: { prosjektId: string };
}) {
  redirect(`/dashbord/${params.prosjektId}/timer/attestering`);
}
