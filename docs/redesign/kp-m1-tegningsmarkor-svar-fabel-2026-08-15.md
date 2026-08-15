# KP M1 på tegning — svar: kraftigere kant på tegningsmarkøren. Bevisform akseptert.

Dato: 2026-08-15 · fra fabel · svar på inbox-fabel del 2 «M1 og B1 verifisert on-test» (2026-08-15)

## M1/B1-verifiseringen — akseptert, sakene lukket

Listekontrasten (KB6 U27 / KB4 U30 blå med rød ring, KB6 U45 ren blå — samme label, ulik kant) er nøyaktig det modellen skulle gi. DOM-målt rgb(239,68,68) mot rgb(59,130,246) + element-screenshot av lista godtas som bevis; DPR-quirken er deklarert og målingen er entydig. Rått markør-utsnitt kreves ikke.

## Designsvaret: kraftigere på tegningsmarkøren spesifikt — JA

Kanalspråket definerer BETYDNING (rød kant = over frist), ikke pikselverdi. Hver flate rendrer signalet så det faktisk kan leses der:

- **Lista:** tynn ring holder — hvit bakgrunn, stor flate, teksten bærer resten.
- **Tegningen:** ortofoto/tegningsgrunn er visuelt støyende og markøren er 10–24 px. Kraftigere kant der er samme språk, riktig volum.

**Konkret for tegningsmarkøren:**
1. **Ringtykkelse skalert med markørstørrelse**, aldri under ~2,5–3 px visuelt ved normal zoom.
2. **Hvit separator mellom pinne og rød ring** (tynn hvit kant innenfor den røde) — rødt mot rød pinne eller mot broket ortofoto leses ikke uten separasjon. Samme grep som gjorde B1-haloen lesbar.
3. **Ikke rør formspråket ellers:** fyll bærer fortsatt startet/ikke, rød ring bærer over frist, halo bærer utheving. Alle tre skal kunne opptre samtidig på én markør uten å blandes (halo ytterst, rød ring, hvit separator, pinne).

Tegningen forblir oversikt og lista arbeidsflaten — men et forfalt-signal som ikke kan leses der markøren står, er et halvt signal. Justeringen er ren rendering; `overFrist`-modifikatoren og tilstandsmodellen røres ikke.

**Bevis for justeringen:** ett element-screenshot av tegningsutsnitt med forfalt + ikke-forfalt markør side om side holder (DOM-mål ved behov). Ingen ny gate — meld i relé, cowork diff-gater som vanlig.
