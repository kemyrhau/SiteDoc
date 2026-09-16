import { redirect } from "next/navigation";

/**
 * Riving (ordre PR 2 Del B): firmaarkivet bor nå i Malforvaltning › Firmaarkiv-fanen.
 * Denne ruta beholdes KUN som redirect så gamle lenker (bokmerker, e-post, søketreff)
 * ikke dør. Ingen UI her lenger.
 */
export default function MalarkivRedirect() {
  redirect("/dashbord/firma/innstillinger/malforvaltning");
}
