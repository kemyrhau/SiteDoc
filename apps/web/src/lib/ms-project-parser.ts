/**
 * MS Project XML-parser
 * Parser fremdriftsplan fra MS Project XML-format (.xml)
 * Bygger oppgave-tre fra OutlineLevel, kobler ressurser via Assignments
 */

export interface MSProjectTask {
  uid: number;
  name: string;
  outlineLevel: number;
  isSummary: boolean;
  start: Date | null;
  finish: Date | null;
  wbs: string | null;
  resourceNames: string[];
  children: MSProjectTask[];
}

export interface MSProjectResource {
  uid: number;
  name: string;
  taskCount: number;
}

export interface MSProjectData {
  projectName: string | null;
  tasks: MSProjectTask[];
  flatTasks: MSProjectTask[];
  resources: MSProjectResource[];
}

// ISO 8601 ukenummer (same logic as UkeVelger)
export function datoTilUkeAar(dato: Date): { uke: number; aar: number } {
  const d = new Date(Date.UTC(dato.getFullYear(), dato.getMonth(), dato.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const aarStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const uke = Math.ceil(((d.getTime() - aarStart.getTime()) / 86400000 + 1) / 7);
  return { uke, aar: d.getUTCFullYear() };
}

export function formaterDato(dato: Date): string {
  const dd = String(dato.getDate()).padStart(2, "0");
  const mm = String(dato.getMonth() + 1).padStart(2, "0");
  const yyyy = dato.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export async function parseMSProjectXML(xmlText: string): Promise<MSProjectData> {
  const { XMLParser } = await import("fast-xml-parser");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (_tagName: string) =>
      ["Task", "Resource", "Assignment", "PredecessorLink"].includes(_tagName),
  });

  const doc = parser.parse(xmlText);

  // Naviger til Project-elementet
  const project = doc.Project ?? doc.project;
  if (!project) {
    throw new Error("Ugyldig fil — fant ikke <Project>-element");
  }

  const projectName: string | null = project.Name ?? project.Title ?? null;

  // Parser ressurser
  const rawResources: Array<Record<string, unknown>> =
    project.Resources?.Resource ?? [];
  const resourceMap = new Map<number, string>();
  for (const r of rawResources) {
    const uid = Number(r.UID ?? 0);
    const name = String(r.Name ?? "");
    // Filtrer bort UID=0 (MS Projects "Unassigned"-sentinel) og tomme navn
    if (uid > 0 && name.trim()) {
      resourceMap.set(uid, name.trim());
    }
  }

  // Parser assignments (TaskUID → ResourceUID[])
  const rawAssignments: Array<Record<string, unknown>> =
    project.Assignments?.Assignment ?? [];
  const taskResourceMap = new Map<number, Set<number>>();
  for (const a of rawAssignments) {
    const taskUID = Number(a.TaskUID ?? 0);
    const resourceUID = Number(a.ResourceUID ?? 0);
    if (taskUID > 0 && resourceUID > 0 && resourceMap.has(resourceUID)) {
      if (!taskResourceMap.has(taskUID)) {
        taskResourceMap.set(taskUID, new Set());
      }
      taskResourceMap.get(taskUID)!.add(resourceUID);
    }
  }

  // Parser oppgaver
  const rawTasks: Array<Record<string, unknown>> =
    project.Tasks?.Task ?? [];

  if (rawTasks.length === 0) {
    throw new Error("Ingen aktiviteter funnet i filen");
  }

  // Bygg flat liste med parsed tasks
  const allParsed: MSProjectTask[] = [];
  for (const t of rawTasks) {
    const uid = Number(t.UID ?? 0);
    if (uid === 0) continue; // Prosjektsammendrag (UID=0)

    const resourceUIDs = taskResourceMap.get(uid) ?? new Set<number>();
    const resourceNames = [...resourceUIDs]
      .map((ruid) => resourceMap.get(ruid))
      .filter((n): n is string => !!n);

    const task: MSProjectTask = {
      uid,
      name: String(t.Name ?? "Uten navn"),
      outlineLevel: Number(t.OutlineLevel ?? 1),
      isSummary: t.Summary === 1 || t.Summary === "1" || t.Summary === true,
      start: t.Start ? new Date(String(t.Start)) : null,
      finish: t.Finish ? new Date(String(t.Finish)) : null,
      wbs: t.WBS ? String(t.WBS) : null,
      resourceNames,
      children: [],
    };

    allParsed.push(task);
  }

  // Bygg tre fra OutlineLevel
  const topLevel: MSProjectTask[] = [];
  const parentStack: MSProjectTask[] = [];

  for (const task of allParsed) {
    const level = task.outlineLevel;

    if (level <= 1) {
      // Toppnivå
      topLevel.push(task);
      parentStack[0] = task;
    } else {
      // Barn av forrige oppgave på nivå (level - 1)
      const parentIndex = level - 2;
      const parent = parentStack[parentIndex];
      if (parent) {
        parent.children.push(task);
        // Sørg for at foreldre er merket som summary
        if (!parent.isSummary) parent.isSummary = true;
      } else {
        // Fallback — legg på toppnivå hvis hierarki er ødelagt
        topLevel.push(task);
      }
      parentStack[level - 1] = task;
    }
  }

  // Flat liste av ikke-sammendrag-oppgaver
  const flatTasks: MSProjectTask[] = allParsed.filter((t) => !t.isSummary);

  // Bygg ressurs-liste med antall
  const resourceCountMap = new Map<number, number>();
  for (const task of flatTasks) {
    const rUIDs = taskResourceMap.get(task.uid);
    if (rUIDs) {
      for (const ruid of rUIDs) {
        resourceCountMap.set(ruid, (resourceCountMap.get(ruid) ?? 0) + 1);
      }
    }
  }

  const resources: MSProjectResource[] = [];
  for (const [uid, name] of resourceMap) {
    resources.push({
      uid,
      name,
      taskCount: resourceCountMap.get(uid) ?? 0,
    });
  }

  return {
    projectName,
    tasks: topLevel,
    flatTasks,
    resources: resources.filter((r) => r.taskCount > 0),
  };
}

/**
 * Hent unike ressurser for valgte oppgaver med korrekt antall
 */
export function hentRessurserForValgteOppgaver(
  flatTasks: MSProjectTask[],
  selectedUIDs: Set<number>,
): MSProjectResource[] {
  const countMap = new Map<string, number>();

  for (const task of flatTasks) {
    if (!selectedUIDs.has(task.uid)) continue;
    for (const name of task.resourceNames) {
      countMap.set(name, (countMap.get(name) ?? 0) + 1);
    }
  }

  const resources: MSProjectResource[] = [];
  let uid = 1;
  for (const [name, count] of countMap) {
    resources.push({ uid: uid++, name, taskCount: count });
  }

  return resources;
}

/**
 * Hent alle UIDs i et underttre (inkl. barn rekursivt)
 */
export function hentAlleBarneUIDs(task: MSProjectTask): number[] {
  const uids: number[] = [];
  function samle(t: MSProjectTask) {
    if (!t.isSummary) uids.push(t.uid);
    for (const barn of t.children) samle(barn);
  }
  samle(task);
  return uids;
}
