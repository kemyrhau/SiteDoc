# Rydding: forgiftede vedlegg-URL-er (del C)

Manuelle SQL-skript for å fjerne døde signaturer (`?exp=…&sig=…`) fra
`/uploads/`-URL-er lagret i `checklists.data` / `tasks.data`.

## Hvorfor dette ligger utenfor `prisma/migrations/`

`prisma migrate deploy` kjører alt i migrations-mappa automatisk ved deploy. Denne
ryddingen er en UPDATE mot **kundedata** og skal **ikke** kjøres uten at Kenneth har
sett dry-run-en og godkjent. Derfor bor skriptene her, og kjøres manuelt per miljø.

## Rekkefølge

1. **`DRY-RUN.sql`** — SELECT-only, trygt mot prod. Viser hver forgiftet URL, hva den
   blir (rå sti), og radtallet. Kunderaden (A.Markussen AS, id `f4337dff…`) sorteres
   øverst og flagges. Kjør denne først.
2. Kenneth verifiserer radene (målt prod: 5 checklists + 1 task) og godkjenner.
3. **`rydding.sql`** — UPDATE i en transaksjon. Verifiser radtall + 0-kontroll før
   `COMMIT`. Kjør per miljø (test først, så prod).

## Forholdet til del A

Del A (`apps/api/src/utils/hmac.ts`) heler visningen ved emisjon: en utløpt signatur
re-signeres, så dokumentene viser bildene **uten** at databasen røres. Denne ryddingen
er derfor **opprydding**, ikke redning — den gjør lagret verdi til den rå stien slik at
skrive-vei-vakten (del B) og datatilstanden er konsistent. Verifiserbar kvittering på
del A: A.Markussen-raden `f4337dff…` skal vise bildet igjen på test straks A er deployet,
før noen UPDATE er kjørt.
