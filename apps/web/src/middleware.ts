export { auth as default } from "@/auth";

export const config = {
  matcher: [
    // Beskytt alle ruter unntatt statiske filer og API auth-ruter
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)|api/auth).*)",
  ],
};
