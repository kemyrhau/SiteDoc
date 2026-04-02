import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingInnhold } from "@/components/LandingInnhold";

export default async function Hjem() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashbord");
  }

  return <LandingInnhold />;
}
