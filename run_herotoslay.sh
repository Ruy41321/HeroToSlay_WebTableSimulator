#!/usr/bin/env bash

set -euo pipefail

REPO_URL="git@github.com:Ruy41321/HeroToSlay_WebTableSimulator.git"
REPO_DIR="HeroToSlay_WebTableSimulator"

check_command() {
    local cmd="$1"
    local label="$2"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "[ERRORE] '$label' non trovato. Installalo e riprova."
        exit 1
    fi
}

echo "[1/4] Verifica prerequisiti..."
check_command make "make"
check_command docker "docker"

if command -v docker-compose >/dev/null 2>&1; then
    echo "[OK] Trovato docker-compose (standalone)."
elif docker compose version >/dev/null 2>&1; then
    echo "[OK] Trovato docker compose (plugin)."
else
    echo "[ERRORE] Né 'docker-compose' né 'docker compose' risultano disponibili."
    exit 1
fi

echo "[2/4] Download/aggiornamento repository..."
if [ -d "$REPO_DIR/.git" ]; then
    echo "[INFO] Repo già presente in '$REPO_DIR': eseguo pull."
    git -C "$REPO_DIR" pull --ff-only
else
    git clone "$REPO_URL" "$REPO_DIR"
fi

echo "[3/4] Avvio progetto con make..."
(
    cd "$REPO_DIR"
    make rebuild
)

echo "[4/4] Completato."
read -r -p "Premi INVIO per chiudere... " _
