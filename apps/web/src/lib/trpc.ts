"use client";

import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import type { AppRouter } from "@sitedoc/api/src/trpc/router";

export const trpc = createTRPCReact<AppRouter>();

export function hentTrpcUrl() {
  if (typeof window !== "undefined") {
    return "/api/trpc";
  }
  return `http://localhost:${process.env.API_PORT ?? 3001}/trpc`;
}

export function opprettTrpcKlient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: hentTrpcUrl(),
      }),
    ],
  });
}
