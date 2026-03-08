# Providers — Bakgrunnskø og app-oppstart

## Provider-hierarki (rekkefølgen er kritisk!)

```
DatabaseProvider → trpc.Provider → QueryClientProvider → NettverkProvider → OpplastingsKoProvider → AuthProvider → ProsjektProvider
```

`DatabaseProvider` MÅ være ytterst — den kjører migreringer og blokkerer rendering til DB er klar.

## OpplastingsKoProvider — Bakgrunnskø

Kjernelogikk for offline bildeopplasting:

1. Bilde tas → lagres lokalt (`documentDirectory/sitedoc-bilder/`) → legges i `opplastings_ko`
2. Køen prosesserer én fil av gangen
3. Eksponentiell backoff: maks 5 forsøk, maks 30s ventetid
4. Ved suksess: server-URL erstatter lokal URL i feltdata, lokal fil slettes
5. Ved nettverksovergang: køen starter automatisk

### Callback-system
- `registrerCallback(id, fn)` lar `useSjekklisteSkjema`/`useOppgaveSkjema` lytte på URL-oppdateringer
- `dokumentType` (`"sjekkliste"` | `"oppgave"`) identifiserer kilde i callback
- Callbacks oppdaterer felt-verdier i sanntid når opplasting fullføres

### Krasj-recovery
- `status = "laster_opp"` resettes til `"venter"` ved app-oppstart
- Hindrer permanente dead-locks i køen

## NettverkProvider

- Sporer online/offline via `@react-native-community/netinfo`
- `erPaaNettet`-state brukes av OpplastingsKo og QueryClient
- Auto-retry ved overgang offline → online

## AuthProvider

- `mobilAuth.verifiser` fornyer sesjonstoken med 30 nye dager
- Offline: cached brukerdata fra SecureStore
- UNAUTHORIZED-feil → automatisk utlogging + redirect

## QueryClient-konfigurasjon

- `networkMode: "offlineFirst"` — queries kjøres lokalt først
- Global retry-handler: UNAUTHORIZED → utlogging
- `focusManager` lytter på AppState for refetch ved app-retur

## Fallgruver

- Legg ALDRI til providers mellom Database og trpc (rekkefølge-avhengighet)
- OpplastingsKo MÅ være etter NettverkProvider (trenger `erPaaNettet`)
- Auth-feil skal IKKE retrires (skiller seg fra nettverksfeil)
