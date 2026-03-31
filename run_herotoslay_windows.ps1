$ErrorActionPreference = "Stop"

param(
    [string]$RepoUrl = "git@github.com:Ruy41321/HeroToSlay_WebTableSimulator.git",
    [string]$RepoDir = "HeroToSlay_WebTableSimulator",
    [string]$Branch = "",
    [switch]$NoPull,
    [switch]$NoWait
)

$ComposeFile = "HtS_Docker/docker-compose.yml"

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Fail {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

function Test-Command {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Compose {
    param([string[]]$Args)

    $baseArgs = @()
    if ($script:ComposeCmd.Length -gt 1) {
        $baseArgs = $script:ComposeCmd[1..($script:ComposeCmd.Length - 1)]
    }

    & $script:ComposeCmd[0] @baseArgs @Args
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose command failed: $($Args -join ' ')"
    }
}

Write-Host "[1/4] Checking prerequisites..."

if (-not (Test-Command "docker")) {
    Fail "'docker' not found. Please install it and try again."
}

if (Test-Command "docker-compose") {
    Write-Host "[OK] Found docker-compose (standalone)."
    $ComposeCmd = @("docker-compose", "-f", $ComposeFile)
}
else {
    & docker compose version *>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Found docker compose (plugin)."
        $ComposeCmd = @("docker", "compose", "-f", $ComposeFile)
    }
    else {
        Fail "Neither 'docker-compose' nor 'docker compose' is available."
    }
}

$HasGit = Test-Command "git"

Write-Host "[2/4] Downloading/updating repository..."
if (Test-Path $RepoDir) {
    Write-Host "[INFO] Directory '$RepoDir' already exists."

    if ($HasGit) {
        if (Test-Path (Join-Path $RepoDir ".git")) {
            if (-not $NoPull) {
                if ($Branch -ne "") {
                    Write-Host "[INFO] Updating branch '$Branch'..."
                    try {
                        & git -C $RepoDir fetch origin
                        & git -C $RepoDir checkout $Branch
                        & git -C $RepoDir pull --ff-only origin $Branch
                        if ($LASTEXITCODE -ne 0) {
                            throw "branch update failed"
                        }
                    }
                    catch {
                        Write-Warn "Branch update failed. Continuing startup anyway."
                    }
                }
                else {
                    Write-Host "[INFO] Running git pull to update repository..."
                    try {
                        & git -C $RepoDir pull --ff-only
                        if ($LASTEXITCODE -ne 0) {
                            throw "git pull failed"
                        }
                    }
                    catch {
                        Write-Warn "git pull failed. Continuing startup anyway."
                    }
                }
            }
            else {
                Write-Host "[INFO] Existing repository: update disabled (--NoPull)."
            }
        }
        else {
            Write-Warn "Directory exists but has no .git folder. Skipping update."
        }
    }
    else {
        Write-Warn "git is not installed: cannot run git pull for updates. Continuing startup anyway."
        if ($Branch -ne "") {
            Write-Warn "Requested branch ('$Branch') but git is unavailable: using local files as-is."
        }
    }
}
else {
    if (-not $HasGit) {
        Fail "git is not installed and directory '$RepoDir' is missing: cannot clone repository."
    }

    Write-Host "[INFO] Cloning repository..."
    if ($Branch -ne "") {
        & git clone --branch $Branch --single-branch $RepoUrl $RepoDir
    }
    else {
        & git clone $RepoUrl $RepoDir
    }

    if ($LASTEXITCODE -ne 0) {
        Fail "git clone failed."
    }
}

Write-Host "[3/4] Starting project..."
Push-Location $RepoDir
try {
    # Windows flow: no make available, run docker compose equivalent of make rebuild.
    try {
        Invoke-Compose @("stop", "simulator")
    }
    catch {
        Write-Warn "Could not stop simulator (it may not be running). Continuing."
    }

    Invoke-Compose @("--profile", "test", "down", "--remove-orphans")
    Invoke-Compose @("build", "simulator")
    Invoke-Compose @("--profile", "test", "build", "test")
    Invoke-Compose @("up", "-d", "simulator")
}
finally {
    Pop-Location
}

Write-Host "[4/4] Done."
Write-Host "The server is available at 'localhost:80'."

if (-not $NoWait) {
    Read-Host "Press ENTER to close"
}
