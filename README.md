# Hero To Slay Simulator

## Disclaimer
Questo repository e un fan project non ufficiale, creato a scopo didattico/personale.
Non e affiliato, sponsorizzato o approvato dai creatori/editori di Hero To Slay.

Preview placeholder:

![Hero To Slay Preview](Preview.png)

Placeholder media tag: #file:bg.jpg

## Concept
Hero To Slay Simulator e un tavolo virtuale multiplayer real-time per partite da 2 a 4 giocatori, con supporto spettatori.

Il progetto riproduce la dinamica da tavolo fisico con:
- lobby condivisa
- deck centrali e aree giocatore
- drag and drop carte sul board
- action flow con approvazione opzionale (Approval Mode)
- log eventi e storico azioni approvate

## Cosa include
- Backend Node.js + Express + Socket.IO
- Frontend Vue 3 (CDN, nessun build step frontend)
- Suite test completa (unit + integration) con Jest
- Runtime Docker con orchestrazione via Makefile
- Indicizzazione automatica delle carte da `Assets/` in `Srcs/cards.json`

## Struttura repository
- `Assets/`: immagini carte e sfondi
- `Doc/`: documentazione tecnica
- `HtS_Docker/`: Dockerfile e docker-compose
- `Srcs/`: codice server/client + indexer
- `test/`: test unitari e integrazione
- `Makefile`: comandi operativi
- `run_herotoslay.sh`: avvio rapido Linux/macOS
- `run_herotoslay_windows.bat`: avvio rapido Windows (doppio click)

## Requisiti
Per workflow standard via Makefile:
- Docker
- Docker Compose plugin (`docker compose`) oppure `docker-compose`
- Make

Per script rapido Linux/macOS `run_herotoslay.sh`:
- Docker
- Docker Compose plugin (`docker compose`) oppure `docker-compose`
- Git solo se la cartella repo non esiste ancora (clone) o se vuoi aggiornare con pull
- Make opzionale: se non presente, lo script usa automaticamente i comandi Docker Compose equivalenti
- accesso SSH GitHub configurato (lo script usa URL `git@github.com:...` di default)

Per script rapido Windows `run_herotoslay_windows.bat`:
- Docker Desktop (con `docker` disponibile)
- Docker Compose plugin (`docker compose`) oppure `docker-compose`
- Git solo se la cartella repo non esiste ancora (clone) o se vuoi aggiornare con pull
- nessuna dipendenza da Make

## Asset carte obbligatori (importante)
Per giocare correttamente devi includere anche gli asset grafici delle carte nella directory `Assets/Cards`.
Senza le immagini carte il simulatore non riesce a popolare correttamente il catalogo e il gameplay risulta incompleto/non funzionante.

Mini guida rapida:
1. Inserisci i file immagine delle carte nelle sottocartelle corrette:
	- `Assets/Cards/Heroes`
	- `Assets/Cards/Deck`
	- `Assets/Cards/Monsters`
2. Inserisci anche i file di retro carte (obbligatori) nella root `Assets/Cards` con questi nomi esatti:
	- `Assets/Cards/hero_card_back.png`
	- `Assets/Cards/main_hero_back.png`
	- `Assets/Cards/monster_card_back.png`
3. Formati supportati: `.png`, `.jpg`, `.jpeg`, `.webp`.
4. Mantieni pure eventuali sottocartelle tematiche (es. classi eroe, magie, oggetti): l'indicizzatore scansiona in modo ricorsivo.
5. Dopo aver copiato/aggiornato gli asset, rigenera il catalogo con:

```bash
make index
```

6. Avvia poi il progetto normalmente:

```bash
make start
```

7. Oppure esegui lo script rapido per fare setup e avvio in un solo passaggio:

```bash
./run_herotoslay.sh # Linux/macOS
.\run_herotoslay_windows.bat # Windows
```

Nota: il percorso corretto nel progetto e `Assets/Cards` (plurale).

## Aggiungere nuovi background
Puoi aggiungere background personalizzati per il tavolo di gioco.

Mini guida rapida:
1. Copia le immagini nella cartella `Assets/Miscellaneous`.
2. Puoi usare anche sottocartelle (la scansione e ricorsiva).
3. Formati supportati: `.png`, `.jpg`, `.jpeg`, `.webp`.
4. Rigenera gli indici con:

```bash
make index
```

5. Avvia o riavvia il progetto:

```bash
make start
```

Come funziona tecnicamente:
- Le carte vengono indicizzate in `Srcs/cards.json`.
- I background vengono indicizzati in `Srcs/public/backgrounds.json` a partire da `Assets/Miscellaneous`.
- In gioco puoi poi ciclare i background disponibili dall'interfaccia.

## Avvio progetto (metodo consigliato nel repo corrente)
1. Build immagini Docker:

```bash
make setup
```

2. Genera/aggiorna indice carte e backgrounds disponibili:

```bash
make index
```

Il comando genera:
- `Srcs/cards.json` (catalogo carte)
- `Srcs/public/backgrounds.json` (lista background da `Assets/Miscellaneous`)

3. Avvia il simulatore:

```bash
make start
```

4. Apri nel browser:

```text
http://localhost:80
```

## Comandi utili
Lifecycle app:

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

Elenco completo target:

```bash
make help
```

## Setup rapido con script automatici

Entrambi gli script:
- verificano prerequisiti principali (`docker`, compose)
- clonano la repo se non esiste
- se la repo esiste, provano ad aggiornarla (salvo opzione `--no-pull`)
- avviano il progetto
- verificano che il servizio `simulator` risulti effettivamente in esecuzione

### Linux/macOS: run_herotoslay.sh
Uso:

```bash
chmod +x run_herotoslay.sh
./run_herotoslay.sh
```

Opzioni utili:
- `--no-pull`: non aggiorna repo esistente
- `--branch <name>`: usa una branch specifica
- `--repo-dir <dir>`: cartella locale target
- `--repo-url <url>`: URL repository
- `--no-wait`: non attende ENTER a fine esecuzione
- `--help`: mostra help

### Windows: run_herotoslay_windows.bat
Uso da doppio click:
- esegui direttamente `run_herotoslay_windows.bat`

Uso da terminale `cmd`:

```bat
run_herotoslay_windows.bat
```

Opzioni utili (identiche alla versione Linux):
- `--no-pull`
- `--branch <name>`
- `--repo-dir <dir>`
- `--repo-url <url>`
- `--no-wait`
- `--help` / `-h`

Note Windows:
- in caso di errore lo script stampa il messaggio e aspetta un input prima di chiudersi
- non richiede PowerShell separato: e un solo file `.bat` standalone

Nota importante Linux/macOS:
- lo script clona in una directory chiamata `HeroToSlay_WebTableSimulator` (se non cambiata con `--repo-dir`)
- usa remote SSH di default, quindi serve una chiave GitHub valida (o `--repo-url` HTTPS)

## Operativita gameplay (sintesi)
- entra in lobby con nickname
- avvia partita (minimo 2 player)
- usa click destro sulle carte/pile per azioni contestuali
- abilita/disabilita Approval Mode dalla top bar
- usa roll d12 integrato
- spectator mode disponibile dalla lobby

## Documentazione tecnica dettagliata
Per analisi completa della codebase:
- `Doc/Documentazione_Progetto.md`

## Troubleshooting rapido
- Errore su `cards.json`: esegui `make index`
- Porta 80 occupata: ferma processi/container e rilancia `make start`
- Problemi compose: verifica `docker compose version`
- Script rapido Linux fallisce su clone: controlla accesso SSH GitHub o usa `--repo-url` HTTPS
- Script rapido Windows fallisce su clone: verifica `git --version` e permessi rete
