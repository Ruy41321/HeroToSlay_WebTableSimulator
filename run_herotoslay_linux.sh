#!/usr/bin/env bash

set -euo pipefail

REPO_URL="https://github.com/Ruy41321/HeroToSlay_WebTableSimulator.git"
REPO_DIR="HeroToSlay_WebTableSimulator"
COMPOSE_FILE="HtS_Docker/docker-compose.yml"
PULL_IF_EXISTS=1
TARGET_BRANCH=""
WAIT_ON_EXIT=1

warn() {
    echo "[WARNING] $1"
}

error() {
    echo "[ERROR] $1"
    exit 1
}

check_required_command() {
    local cmd="$1"
    local label="$2"
    if ! command -v "$cmd" >/dev/null 2>&1; then
                error "'$label' not found. Please install it and try again."
    fi
}

print_help() {
    cat <<EOF
Uso: $0 [opzioni]

Opzioni:
    --no-pull            If repo exists, skip git pull
    --branch <name>      Branch to clone/update
    --repo-dir <dir>     Local repository directory (default: $REPO_DIR)
    --repo-url <url>     Repository URL to clone (default: $REPO_URL)
    --no-wait            Do not wait for ENTER before exiting
    -h, --help           Show this help
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --no-pull)
            PULL_IF_EXISTS=0
            shift
            ;;
        --branch)
            shift
            if [ "$#" -eq 0 ]; then
                error "Missing value for --branch"
            fi
            TARGET_BRANCH="$1"
            shift
            ;;
        --repo-dir)
            shift
            if [ "$#" -eq 0 ]; then
                error "Missing value for --repo-dir"
            fi
            REPO_DIR="$1"
            shift
            ;;
        --repo-url)
            shift
            if [ "$#" -eq 0 ]; then
                error "Missing value for --repo-url"
            fi
            REPO_URL="$1"
            shift
            ;;
        --no-wait)
            WAIT_ON_EXIT=0
            shift
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

echo "[1/4] Checking prerequisites..."
check_required_command docker "docker"

if command -v docker-compose >/dev/null 2>&1; then
    echo "[OK] Found docker-compose (standalone)."
    COMPOSE_CMD=(docker-compose -f "$COMPOSE_FILE")
elif docker compose version >/dev/null 2>&1; then
    echo "[OK] Found docker compose (plugin)."
    COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE")
else
    error "Neither 'docker-compose' nor 'docker compose' is available."
fi

HAS_GIT=1
if ! command -v git >/dev/null 2>&1; then
    HAS_GIT=0
fi

HAS_MAKE=1
if ! command -v make >/dev/null 2>&1; then
    HAS_MAKE=0
    warn "'make' not found. Using direct docker compose commands equivalent to 'make rebuild'."
fi

run_compose() {
    "${COMPOSE_CMD[@]}" "$@"
}

echo "[2/4] Downloading/updating repository..."
if [ -d "$REPO_DIR" ]; then
    echo "[INFO] Directory '$REPO_DIR' already exists."

    if [ "$HAS_GIT" -eq 1 ]; then
        if [ -d "$REPO_DIR/.git" ]; then
            if [ "$PULL_IF_EXISTS" -eq 1 ]; then
                if [ -n "$TARGET_BRANCH" ]; then
                    echo "[INFO] Updating branch '$TARGET_BRANCH'..."
                    if ! git -C "$REPO_DIR" fetch origin \
                        || ! git -C "$REPO_DIR" checkout "$TARGET_BRANCH" \
                        || ! git -C "$REPO_DIR" pull --ff-only origin "$TARGET_BRANCH"; then
                        warn "Branch update failed. Continuing startup anyway."
                    fi
                else
                    echo "[INFO] Running git pull to update repository..."
                    if ! git -C "$REPO_DIR" pull --ff-only; then
                        warn "git pull failed. Continuing startup anyway."
                    fi
                fi
            else
                echo "[INFO] Existing repository: update disabled (--no-pull)."
            fi
        else
            warn "Directory exists but has no .git folder. Skipping update."
        fi
    else
        warn "git is not installed: cannot run git pull for updates. Continuing startup anyway."
        if [ -n "$TARGET_BRANCH" ]; then
            warn "Requested branch ('$TARGET_BRANCH') but git is unavailable: using local files as-is."
        fi
    fi
else
    if [ "$HAS_GIT" -eq 0 ]; then
        error "git is not installed and directory '$REPO_DIR' is missing: cannot clone repository."
    fi

    echo "[INFO] Cloning repository..."
    if [ -n "$TARGET_BRANCH" ]; then
        git clone --branch "$TARGET_BRANCH" --single-branch "$REPO_URL" "$REPO_DIR"
    else
        git clone "$REPO_URL" "$REPO_DIR"
    fi
fi

echo "[3/4] Starting project..."
(
    cd "$REPO_DIR"

    if [ "$HAS_MAKE" -eq 1 ]; then
        make rebuild
    else
        # Equivalente di: make rebuild -> stop clean setup start
        run_compose stop simulator || true
        run_compose --profile test down --remove-orphans
        run_compose build simulator
        run_compose --profile test build test
        run_compose up -d simulator
    fi
)

echo "[4/4] Done."
echo "The server is available at 'localhost:80'."
if [ "$WAIT_ON_EXIT" -eq 1 ]; then
    read -r -p "Press ENTER to close... " _
fi