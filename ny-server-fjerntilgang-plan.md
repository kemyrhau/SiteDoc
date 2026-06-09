# OPUS-INSTRUKS — Uovervåket fjerntilgang til ny server (192.168.1.209)

> Spor: **NY-SERVER**. Les `parallell-arbeid-lock.md` før delte ressurser røres.
> **Utførelsesmodell (vedtatt 2026-06-08): Kenneth utfører alt fra Mac via `ssh server-ny`; kontroll-Claude planlegger og verifiserer.** Ingen agent kjører på serveren.
> Plan med ord før kode — ingenting endres før Kenneth har godkjent hvert steg.
> Sist oppdatert: 2026-06-08

---

## Mål (Kenneths krav, ordrett intensjon)

Etter strømbrudd skal serveren **uten Kenneths medvirkning**:

1. **slå seg på igjen**,
2. **låse opp den krypterte disken** automatisk,
3. **koble seg på nett og bli nåbar for fjernadministrasjon**.

Diskkryptering (LUKS) **beholdes**. «Nåbar» her = nåbar fra Kenneths egne enheter
overalt (admin/SSH/drift). Offentlig eksponering av selve appene er **ikke** med —
det er prod-migrering (cloudflared) og tas som egen oppgave.

## Valgt arkitektur (kontroll-Claude besluttet, begrunnet)

| Lag | Valg | Hvorfor dette og ikke alternativene |
|-----|------|-------------------------------------|
| Disk-opplåsing | **TPM2 auto-unlock** (`systemd-cryptenroll`) | Eneste løsning som gir «uten medvirkning» *og* beholder kryptering. Manuell/Dropbear krever passphrase ved hver boot; ukryptert bryter K-3. |
| Strøm-tilbake | **UEFI «Restore on AC Power Loss = On»** | Uten dette slår ikke maskinen seg på igjen fysisk etter strømbrudd. |
| Fjernadministrasjon | **Tailscale + Tailscale SSH** | Auto-start ved boot, ringer ut (ingen port-forward), virker bak NAT, isolert fra delt Cloudflare/DNS. Lukker K-4 (ingen passord/root-SSH på internett). |
| Dropbear | **Pensjoneres** (evt. ren fallback) | Overflødig når TPM låser opp automatisk. Unngår eksponert pre-boot-SSH. |

> **Engangs-handlinger fra Kenneth (ikke løpende medvirkning):** sette UEFI-innstillingen,
> og autentisere Tailscale-noden første gang. Begge gjøres én gang.

---

## Fase 0 — Kartlegging (Opus, KUN lesing, ingen endringer)

Verifiser antakelsene mot faktisk tilstand. Samles i ett SSH-kall. Krev `fil/utdata`-sitater,
ikke oppsummering.

- **TPM til stede?** `systemd-cryptenroll --tpm2-device=list` + `ls -l /sys/class/tpm/` +
  `test -e /dev/tpmrm0 && echo tpmrm0-finnes`. Bekreft **TPM 2.0** (ikke 1.2).
- **Secure Boot på?** `mokutil --sb-state` — avgjør om PCR 7-binding er meningsfull.
- **LUKS-tilstand:** `lsblk -f`, `cat /etc/crypttab`, `sudo cryptsetup luksDump <device>` —
  bekreft at root er LUKS2, hvilke key-slots som er i bruk, og at det finnes en
  passphrase-slot vi kan beholde som recovery.
- **OS/systemd:** `cat /etc/os-release` + `systemd --version` (TPM-enroll krever systemd ≥ 248;
  Ubuntu 22.04+ ok) + `cryptsetup --version` (TPM2-token-støtte).
- **Nett:** `ip -br a`, `ip route` — interface-navn, gateway, at .209 er fast.
- **SSH-tilstand (for K-4-herding):** `sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'`.
- **Mac-nøkkel inne?** `ls -la ~/.ssh/authorized_keys` (etter `ssh-copy-id`).

### ⚠️ STOPP-PUNKTER (rapporter til Kenneth, ikke gjett videre)

- **Ingen TPM 2.0:** da kolliderer «uten medvirkning» med «kryptert». Opus stopper og
  legger frem rangerte fallbacks (network-bound unlock via Tang/Clevis mot en alltid-på
  LAN-enhet · keyfile på adskilt media · akseptere ukryptert) — **Kenneth velger.**
- **Kun én LUKS key-slot / usikker recovery:** ikke rør slots før recovery-passphrase
  og **header-backup** er bekreftet.

### RESULTAT — Fase 0 verifisert 2026-06-08 (kjørt av Kenneth fra Mac)

- **OS:** Ubuntu 24.04.4 LTS, systemd 255, cryptsetup 2.7.0 — moderne, ingen hindringer. ✅
- **Disk:** `nvme0n1p3` = LUKS2 (UUID `85f9be93-5ce4-4646-a32e-a74d4b559534`) → `dm_crypt-0` → LVM (`ubuntu-vg/ubuntu-lv`) → ext4 root. crypttab: `dm_crypt-0 UUID=85f9… none luks`. ✅
- **Nett:** `eno1` 192.168.1.209/24, gateway 192.168.1.254. ✅
- **sudo krever passord** (ikke passordløst — bedre enn gamle Kenspill K-6). ✅
- **SSH:** `permitrootlogin without-password`, `passwordauthentication yes` → herdes i egen runde (K-4).
- **TPM:** Først fraværende. **Intel PTT aktivert i UEFI 2026-06-08** → TPM 2.0 nå aktiv (`/dev/tpmrm0`, `tpm_version_major=2`). Etter `apt install tpm2-tools` viser `systemd-cryptenroll --tpm2-device=list` enheten (`MSFT0101:00 tpm_crb`). **Hard-stopp løst — TPM-auto-unlock gjennomførbar.** ✅
- **Secure Boot:** av (relevant for PCR-valg i Fase 1).

---

## Fase 1 — TPM auto-unlock

**Hva:** Forsegle LUKS-nøkkelen i TPM2 så disken låses opp automatisk ved boot.
**Hvorfor:** Oppfyller kravet om opplåsing uten menneske, med kryptering intakt.
**Kobling:** Forutsetter Fase 0 (TPM bekreftet). Recovery-passphrase MÅ bestå.
**Begrensning:** Beskytter mot disk-tyveri/kloning, ikke mot tyveri av hele maskinen
(den booter seg selv). Akseptert for en boks som står fast hjemme.

1. **Header-backup FØRST:** `sudo cryptsetup luksHeaderBackup <device> --header-backup-file <fil>` —
   lagres trygt utenfor maskinen. (Uten dette kan en feil gjøre disken ugjenopprettelig.)
2. **Bekreft at passphrase-slot beholdes** som recovery — TPM legges i en **ny** slot,
   passphrasen slettes **aldri**.
3. **Enroll TPM:** `sudo systemd-cryptenroll --tpm2-device=auto --tpm2-pcrs=7 <device>`
   (PCR 7 = Secure Boot-tilstand; Opus rangerer PCR-valg ut fra Fase 0 — uten Secure Boot
   er PCR 7 lite verdt og enklere binding vurderes, med tydelig avveining).
4. **`/etc/crypttab`:** legg `tpm2-device=auto` i options-kolonnen for device-et.
5. `sudo update-initramfs -u`.

> **Kjent avveining å dokumentere:** firmware-/kjerne-oppdateringer kan endre PCR-verdier og
> bryte auto-unlock → da faller den tilbake på passphrase. Derfor beholdes recovery-passphrasen,
> og den skal være dokumentert (Kenneth oppbevarer den — Claude rører den aldri).

### IMPLEMENTERT 2026-06-08 — mekanisme byttet til clevis

**Viktig korreksjon:** `systemd-cryptenroll --tpm2-device` fungerer IKKE med Ubuntu 24.04 sitt standard initramfs (initramfs-tools). `update-initramfs` ga `WARNING: ignoring unknown option 'tpm2-device'`, og initramfs manglet TPM-støtte. Riktig mekanisme på Ubuntu er **clevis**.

Faktisk utført, verifisert:
1. Intel PTT aktivert i UEFI → TPM 2.0 aktiv. `apt install tpm2-tools`.
2. `apt install clevis clevis-luks clevis-tpm2 clevis-initramfs`.
3. `clevis luks bind -d /dev/nvme0n1p3 tpm2 "{}"` → clevis-TPM i **slot 3**, ingen PCR-binding.
4. crypttab tilbake til ren `dm_crypt-0 UUID=… none luks` (clevis bruker ikke crypttab-opsjonen).
5. `tpm_crb` er innebygd i kjernen (`CONFIG_TCG_CRB=y`) → TPM tilgjengelig tidlig i boot uten ekstra modul-inkludering.
6. `update-initramfs -u` → clevis-hooks + libtss2 i initramfs.
7. **Reboot-test bestått:** disken låste opp uten passphrase, serveren oppe + SSH-nåbar.

**LUKS-slots nå:** 0/1 = passphrase (recovery, beholdes), 2 = gammel `systemd-cryptenroll`-TPM (overflødig — skal wipes), 3 = clevis-TPM (aktiv auto-unlock).

**Gjenstår:** wipe slot 2; UEFI «Restore on AC Power Loss = On» (Fase 2); Tailscale (Fase 3); ekte strømbrudd-test (Fase 4).

---

## Fase 2 — UEFI auto-power-on (Kenneths hånd)

Sett **«Restore on AC Power Loss» = Power On** (navn varierer: «AC Back», «After Power Loss»)
i UEFI/BIOS. Krever fysisk konsoll ved oppstart. Opus beskriver hvor innstillingen typisk
ligger for maskinens firmware; Kenneth utfører.

---

## Fase 3 — Tailscale (fjernadministrasjon)

**Hva:** Installer Tailscale, slå på Tailscale SSH, sørg for auto-start.
**Hvorfor:** Gjør serveren nåbar uten port-forward, automatisk ved boot.
**Kobling:** Etter at dette virker, herdes OpenSSH (K-4).
**Begrensning:** Tredjeparts koordineringstjeneste; trafikk er peer-to-peer/eget relé.

1. Installer offisiell pakke; `tailscaled`-servicen auto-startes (systemd) → kobler til ved boot.
2. `sudo tailscale up --ssh` — Kenneth autentiserer noden **én gang** (hans hånd).
   Alternativt forhåndsgenerert auth-key (Kenneth lager; Claude rører ikke nøkkelen).
3. **Deaktiver key-expiry** for denne noden i Tailscale admin-konsoll, så den ikke faller
   av tailnet etter ~6 mnd (⚠️ Kenneth-handling i konsollen).
4. **Verifiser Tailscale SSH virker** fra Mac før neste steg.
5. **K-4-herding (først NÅR Tailscale SSH er bekreftet — ikke lås deg ute):**
   `PasswordAuthentication no`, `PermitRootLogin no` i sshd, reload.

> ⚠️ **Kryss-app/lock-fila:** Tailscale på ny, isolert konto/enhet → minimal kryss-app-risiko.
> Ingen endring av delt Cloudflare/DNS/OAuth/ngrok i denne planen → ingen eksklusiv lås kreves.
> Hvis noe likevel skulle røre delt infra: STOPP, lås + Kenneth-godkjenning.

---

## Fase 4 — Verifisering (akseptansetesten — det viktigste)

Rekkefølge, med fysisk konsoll tilgjengelig som fallback:

1. **Reboot-test:** `sudo reboot` → disken skal låse opp **uten prompt**, maskinen komme opp,
   Tailscale-noden bli «online», og Mac nå serveren over tailnet **uten noen handling**.
2. **Ekte strømbrudd-test (selve kravet):** kutt strømmen fysisk (trekk støpsel / bryt uttak) →
   maskinen skal slå seg på selv, låse opp, koble på tailnet, og bli nåbar — alt uten medvirkning.
3. **Idempotens:** gjenta strøm-syklus én gang til → samme resultat (varig, ikke engangstilstand).
4. **Recovery intakt:** bekreft at LUKS-passphrasen fortsatt låser opp manuelt (fallback ved PCR-endring).

Godkjent kun når punkt 2 lykkes uten at Kenneth rører noe.

---

## Det Opus IKKE gjør i denne planen

- Ingen offentlig eksponering av SiteDoc-appene (cloudflared/prod-migrering) — egen oppgave.
- Ingen migrering av SiteDoc-stacken (PostgreSQL, PM2, env) — egen oppgave.
- Ingen endring av Genexis-ruter, delt Cloudflare/DNS/OAuth, eller dagens server (Kenspill).
- Claude rører aldri nøkkel-/passphrase-/auth-key-verdier (jf. lock-fila + CLAUDE.md § sikkerhet).

## Avhengighet før start

SSH-nøkkeltilgang for Mac mot .209 (`ssh-copy-id kemyrhau@192.168.1.209`, kjøres av Kenneth).
Ingen fase kan kjøres før dette og Kenneths godkjenning av planen foreligger.

---

## STATUS — FULLFØRT 2026-06-08 ✅

Hele kjeden bevist ende-til-ende med ekte strømbrudd-test:

- **Fase 1 — disk auto-unlock:** clevis + TPM2 (Intel PTT aktivert i UEFI). Slot 0/1 = passphrase (recovery), slot 3 = clevis-TPM. `tpm_crb` innebygd i kjernen. ✅
- **Fase 2 — UEFI «Restore on AC Power Loss = Power On»:** satt. Maskinen slår seg på selv etter strømtap. ✅
- **Fase 3 — Tailscale fjerntilgang:** node `sitedoc` = `100.76.248.15`, auto-start enabled, key-expiry disabled. `--ssh` aktiv. `server-ny`-alias på Mac peker på tailnet-IP. Nåbar fra utsiden av hjemmenettet bekreftet. ✅
  - **K-4 herding:** `/etc/ssh/sshd_config.d/00-hardening.conf` → `PasswordAuthentication no`, `PermitRootLogin no`, `KbdInteractiveAuthentication no` (sorterer før `50-cloud-init.conf` → vinner). Effektiv config bekreftet. ✅
- **Fase 4 — ekte strømbrudd-test:** strøm trukket → maskin på av seg selv → disk auto-låst → tailnet → `ssh server-ny 'uptime'` svarte. ✅

**SSH-nøkler ryddet:** kun `server_ny` (fp `27hmi…`) i serverens authorized_keys. Stray `id_ed25519` + Opus-artefakter fjernet. LUKS-header-backup ligger trygt på Mac (`~/luks-header-server-ny-20260608.img`).

**Recovery-beredskap:** LUKS-passphrase (slot 0/1) virker som fallback; lokal konsoll + tastatur bekreftet responsiv for manuell opplåsing hvis TPM svikter (f.eks. ved firmware-endring).

## Neste fase (egen plan)

Docker + databaser i containere + migrere sitedoc/sendfil/tromsosalsaklubb (fil-til-database blir værende). Staged, én app om gangen, lavest-risiko først, sitedoc sist. Cross-app/shared-infra (DNS/OAuth/cloudflared) krever lås + godkjenning per steg. Egen migreringsplan skrives før noe røres.
