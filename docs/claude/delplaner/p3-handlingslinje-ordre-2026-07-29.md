# P3-ordre — handlingslinje: primær + split-▾ (fabel → fiks-Opus, via cowork, 2026-07-29)

> Kenneth-godkjent skisse 2026-07-29 (`Handlingslinje Redesign.dc.html` 1a/1b). Grunnlag: effektivitets-audit §8B + fiks-plan P3. Forutsetning: **P1-bugfiksen (Send fjernet fra `received`) er landet først** — menyinnholdet under bygger på statusmaskinen ETTER P1.

## 1. Regelen
Én primær handling (dagens `erPrimaer`) + split-▾ på primærknappen med ALLE øvrige lovlige handlinger. Ingen flate sekundærknapper. Unntak: «+ kommentar» beholdes flat (notat, ikke statushandling); ingen split når null øvrige handlinger finnes.

## 2. Oppdraget (web `DokumentHandlingsmeny.tsx`)
1. **Generaliser split-betingelsen** fra `draftSend && videresendValg.length > 1` (`:542,581`) til «primær finnes && ≥1 øvrig lovlig handling».
2. **Flytt sekundær-bøtta** (`:331-342`) inn i split-menyen. Menyrekkefølge: framover-handlinger → destruktive (Avvis m/rødfarge) → Videresend… → Admin-overstyringer. Avvis beholder påkrevd-begrunnelse-dialogen; Videresend beholder person-velgeren (`:681-727`).
3. Draft-send m/>1 mottaker: mottakervalg + Slett i samme meny (skissens Utkast-rad).
4. Ikke-eier: alt deaktivert bak ▾ m/forklaring (som i dag) — primærknapp dempet «—»-tilstand per skissen.
5. **Delt kilde:** menyinnholdet leses fra `hentStatusHandlinger` — ingen UI-egen handlingsliste. Mobil `DokumentHandlingsmeny` røres IKKE i denne ordren (egen sak V5b/P5).

## 3. Testfasit
Audit §8B-matrisa (post-P1): received×admin = Besvar + ▾{Godkjenn, Avvis, Videresend, Admin} = 2 flate elementer (+kommentar); received×godkjenner = Godkjenn uten split; draft = Send m/split; ikke-eier = deaktivert ▾. Oppdater/utvid `dokument-handlingsmeny`-testene mot matrisa.

## 4. Ufravikelig
i18n alle nye strenger · ingen endring i statusmaskin/server (P1 eier den) · gjenbruk eksisterende dropdown-komponent (ikke ny meny-variant) · klikk-budsjett: verste fall 6 → 2 flate elementer, rapporteres ved levering.

## 5. Gate
Nå-sjekk (kort: bekreft P1 landet + linjenumre) → kode → build + tester grønne → skjermbilder per matrise-rad (min. received×admin, received×godkjenner, draft, ikke-eier) → fabel task-walkthrough-gate → dok-sync → cowork-merge.
