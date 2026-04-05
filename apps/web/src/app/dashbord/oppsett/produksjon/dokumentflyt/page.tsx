"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DokumentflytSide() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashbord/oppsett/produksjon/entrepriser");
  }, [router]);

  return null;
}
