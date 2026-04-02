# Hero To Slay Simulator

## Disclaimer
This repository is an unofficial fan project, created for educational/personal purposes.
It is not affiliated with, sponsored by, or approved by the creators/publishers of Hero To Slay.

## License and assets
The project source code is released under the MIT license (see `LICENSE`).
The original game's graphic assets (cards, illustrations, names, logos, etc.) are not covered by the code MIT license and remain the property of their respective owners.

For details and asset usage guidelines, see `LICENSE-ASSETS.md`.

Preview placeholder:

![Hero To Slay Preview](Preview.png)

## Concept
Hero To Slay Simulator is a real-time multiplayer virtual tabletop for games from 2 to 4 players, with spectator support.

The project reproduces the physical tabletop dynamics with:
- shared lobby
- central decks and player areas
- card drag and drop on the board
- action flow with optional approval (Approval Mode)
- event log and approved actions history

## What it includes
- Node.js + Express + Socket.IO backend
- Vue 3 frontend (CDN, no frontend build step)
- Full test suite (unit + integration) with Jest
- Docker runtime orchestrated via Makefile
- Automatic card indexing from `Assets/` into `Srcs/cards.json`

## Repository structure
- `Assets/`: card images and backgrounds
- `Doc/`: technical documentation
- `HtS_Docker/`: Dockerfile and docker-compose
- `Srcs/`: server/client code + indexer
- `test/`: unit and integration tests
- `Makefile`: operational commands
- `run_herotoslay.sh`: quick start on Linux/macOS
- `run_herotoslay_windows.bat`: quick start on Windows (double click)

## Requirements
For the standard workflow via Makefile:
- Docker
- Docker Compose plugin (`docker compose`) or `docker-compose`
- Make

For the Linux/macOS quick script `run_herotoslay.sh`:
- Docker
- Docker Compose plugin (`docker compose`) or `docker-compose`
- Git only if the repo folder does not exist yet (clone) or if you want to update with pull
- Optional Make: if not present, the script automatically uses the equivalent Docker Compose commands
- configured GitHub SSH access (the script uses `git@github.com:...` URL by default)

For the Windows quick script `run_herotoslay_windows.bat`:
- Docker Desktop (with `docker` available)
- Docker Compose plugin (`docker compose`) or `docker-compose`
- Git only if the repo folder does not exist yet (clone) or if you want to update with pull
- no dependency on Make

## Mandatory card assets (important)
To play correctly you must also include the card graphic assets in the `Assets/Cards` directory.
Without card images, the simulator cannot correctly populate the catalog and gameplay is incomplete/non-functional.

Quick mini guide:
1. Place the card image files in the correct subfolders:
	- `Assets/Cards/Heroes`
	- `Assets/Cards/Deck`
	- `Assets/Cards/Monsters`
2. Also place the card back files (mandatory) in the `Assets/Cards` root with these exact names:
	- `Assets/Cards/hero_card_back.png`
	- `Assets/Cards/main_hero_back.png`
	- `Assets/Cards/monster_card_back.png`
3. Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`.
4. You can keep thematic subfolders (e.g. hero classes, spells, items): the indexer scans recursively.
5. After copying/updating assets, regenerate the catalog with:

```bash
make index
```

6. Then start the project normally:

```bash
make start
```

7. Or run the quick script to perform setup and startup in one step:

```bash
./run_herotoslay.sh # Linux/macOS
.\run_herotoslay_windows.bat # Windows
```

Note: the correct path in the project is `Assets/Cards` (plural).

## Add new backgrounds
You can add custom backgrounds for the game table.

Quick mini guide:
1. Copy images into the `Assets/Miscellaneous` folder.
2. You can also use subfolders (scanning is recursive).
3. Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`.
4. Regenerate indexes with:

```bash
make index
```

5. Start or restart the project:

```bash
make start
```

How it works technically:
- Cards are indexed in `Srcs/cards.json`.
- Backgrounds are indexed in `Srcs/public/backgrounds.json` starting from `Assets/Miscellaneous`.
- In-game you can then cycle through available backgrounds from the interface.

## Project startup (recommended method in the current repo)
1. Build Docker images:

```bash
make setup
```

2. Generate/update the card index and available backgrounds:

```bash
make index
```

The command generates:
- `Srcs/cards.json` (card catalog)
- `Srcs/public/backgrounds.json` (background list from `Assets/Miscellaneous`)

3. Start the simulator:

```bash
make start
```

4. Open in your browser:

```text
http://localhost:80
```

## Useful commands
App lifecycle:

```bash
make start
make stop
make restart
make rebuild
make logs
make clean
```

Testing in Docker:

```bash
make test
make test-unit
make test-integration
make test-coverage
```

Full target list:

```bash
make help
```

## Quick setup with automatic scripts

Both scripts:
- check main prerequisites (`docker`, compose)
- clone the repo if it does not exist
- if the repo exists, they try to update it (unless `--no-pull` is used)
- start the project
- verify that the `simulator` service is actually running

### Linux/macOS: run_herotoslay.sh
Usage:

```bash
chmod +x run_herotoslay.sh
./run_herotoslay.sh
```

Useful options:
- `--no-pull`: does not update existing repo
- `--branch <name>`: use a specific branch
- `--repo-dir <dir>`: target local folder
- `--repo-url <url>`: repository URL
- `--no-wait`: do not wait for ENTER at the end
- `--help`: show help

### Windows: run_herotoslay_windows.bat
Double-click usage:
- run `run_herotoslay_windows.bat` directly

Usage from `cmd` terminal:

```bat
run_herotoslay_windows.bat
```

Useful options (same as Linux version):
- `--no-pull`
- `--branch <name>`
- `--repo-dir <dir>`
- `--repo-url <url>`
- `--no-wait`
- `--help` / `-h`

Windows notes:
- in case of error the script prints the message and waits for input before closing
- no separate PowerShell required: it is a single standalone `.bat` file

Important Linux/macOS note:
- the script clones into a directory called `HeroToSlay_WebTableSimulator` (unless changed with `--repo-dir`)
- it uses SSH remote by default, so a valid GitHub key is required (or use `--repo-url` HTTPS)

## Gameplay operations (summary)
- join lobby with a nickname
- start match (minimum 2 players)
- use right click on cards/piles for contextual actions
- enable/disable Approval Mode from the top bar
- use integrated 2d6 roll
- spectator mode available from the lobby

## Detailed technical documentation
For a complete codebase analysis:
- `Doc/Documentazione_Progetto.md`

## Quick troubleshooting
- `cards.json` error: run `make index`
- Port 80 already in use: stop processes/containers and rerun `make start`
- Compose issues: check `docker compose version`
- Linux quick script fails on clone: check GitHub SSH access or use `--repo-url` HTTPS
- Windows quick script fails on clone: check `git --version` and network permissions
