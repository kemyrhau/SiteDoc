import { redirect } from "next/navigation";

/**
 * Riving (ordre PR 2 Del B): firmamal-innholdsredigeringen bor nå under Malforvaltning.
 * Redirect bevarer `malId` så en dyp lenke til en bestemt mal fortsatt lander riktig.
 */
export default function MalarkivMalRedirect({ params }: { params: { malId: string } }) {
  redirect(`/dashbord/firma/innstillinger/malforvaltning/${params.malId}`);
}
