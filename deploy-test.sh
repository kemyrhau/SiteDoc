#!/bin/bash
# SiteDoc TEST deploy-script — UTGÅTT.
#
# Det gamle test-miljøet (PM2 sitedoc-test-* på gammel WSL-server via `ssh sitedoc`)
# er avviklet sammen med migreringen 2026-06-10. Et permanent test-miljø på ny server
# (Docker, test.sitedoc.no) er IKKE re-etablert ennå — test-DB `sitedoc_test` finnes i
# postgres-containeren, men det kjører ingen egen test-web/-api-container.
#
# Se docs/claude/infrastruktur.md → «Test-miljø». Oppdater dette skriptet til
# rsync + docker compose (egen test-compose) når test-stacken settes opp.

echo "⚠️  deploy-test.sh er utgått: test-miljøet er ikke re-etablert på ny server."
echo "   Se docs/claude/infrastruktur.md → Test-miljø."
exit 1
