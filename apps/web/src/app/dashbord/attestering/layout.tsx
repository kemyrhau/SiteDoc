"use client";

import { Suspense, type ReactNode } from "react";
import { Spinner } from "@sitedoc/ui";

// w10b (S3): attesteringen står utenfor firma-layouten, som har firma-admin-gaten. Tilgangen
// avgjøres på siden av `kanAttestereFirma` (firma-admin: alle; prosjektleder: sine prosjekter).
// Sidene leser `useSearchParams()` (`?firma=`, uke, visning) — det krever en Suspense-grense
// under `next build`-prerender; firma-layouten ga den før flyttingen.
export default function AttesteringLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 overflow-auto bg-gray-50 p-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        }
      >
        {children}
      </Suspense>
    </main>
  );
}
