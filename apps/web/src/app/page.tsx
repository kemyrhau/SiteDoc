import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Hjem() {
  const session = await auth();

  // Innloggede brukere sendes til dashbordet
  if (session?.user) {
    redirect("/dashbord");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-siteflow-primary">
          SiteFlow
        </h1>
        <p className="mb-8 text-lg text-gray-600">
          Rapport- og kvalitetsstyringssystem for byggeprosjekter
        </p>
        <a
          href="/logg-inn"
          className="rounded-lg bg-siteflow-primary px-6 py-3 text-white hover:bg-blue-700"
        >
          Logg inn
        </a>
      </div>
    </main>
  );
}
