# Hero To Slay Simulator

Preview placeholder:

![Hero To Slay Preview](Assets/Miscellaneous/bg.jpg)

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
- `run_herotoslay.sh`: setup rapido automatizzato

## Requisiti
Per workflow standard:
- Docker
- Docker Compose plugin (`docker compose`) oppure `docker-compose`
- Make

Per lo script rapido `run_herotoslay.sh` e consigliato anche:
- Git
- accesso SSH GitHub configurato (lo script usa URL `git@github.com:...`)

## Avvio progetto (metodo consigliato nel repo corrente)
1. Build immagini Docker:

```bash
make setup
```

2. Genera/aggiorna indice carte:

```bash
make index
```

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

## Setup rapido con run_herotoslay.sh
Lo script `run_herotoslay.sh` e pensato per bootstrap da zero su una macchina nuova.

### Cosa fa lo script
1. Verifica prerequisiti (`make`, `docker`, `docker compose`/`docker-compose`)
2. Clona il repository (o fa pull se gia presente)
3. Entra nella cartella clonata e lancia `make rebuild`
4. Mostra conferma finale

### Come usarlo
Dalla directory dove vuoi creare/aggiornare la copia del progetto:

```bash
chmod +x run_herotoslay.sh
./run_herotoslay.sh
```

Nota importante:
- lo script clona in una directory chiamata `HeroToSlay_WebTableSimulator`
- usa remote SSH, quindi serve una chiave GitHub valida

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
- Script rapido fallisce su clone: controlla accesso SSH GitHub
