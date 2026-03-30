# Hero To Slay Simulator

Simulatore web in locale di Hero To Slay per gruppi da 2 a 4 giocatori.
Il progetto replica un tavolo condiviso con lobby unica, area centrale, zone giocatore,
azioni libere/restritte, sistema di approvazione e log eventi.

## Cosa include

- Backend Node.js + Express + Socket.io per lobby e sincronizzazione realtime.
- Frontend Vue 3 (via CDN) senza build step.
- Gestione stato partita con classi OOP (`Card`, `Deck`, `Player`, `GameManager`, `ApprovalQueue`).
- Log separati per eventi generali e azioni restritte.
- Suite test Jest completa (unit + integration).
- Esecuzione in Docker con `docker compose`.

## Struttura progetto

```
.
|- Assets/                     # immagini carte e asset statici
|- Doc/                        # documentazione task
|- HtS_Docker/                 # Dockerfile e docker-compose.yml
|- Srcs/                       # codice applicazione (server, public, indexer, package)
|- test/                       # test unitari e di integrazione
|- Makefile                    # comandi rapidi progetto/test
`- README.md
```

## Requisiti

- Docker + Docker Compose plugin (`docker compose`)
- Make

Il workflow standard del progetto e' Docker-only: non serve npm installato sulla macchina host.
Il codice applicativo risiede in Srcs, mentre i file Docker risiedono in HtS_Docker.

## Prima configurazione

1. Build immagini Docker:

```bash
make setup
```

2. Genera `Srcs/cards.json` dagli asset:

```bash
make index
```

`make index` legge le immagini da `Assets/` nella root del repository.

Nota: il server richiede `/app/cards.json` nel container e viene mappato da `Srcs/cards.json`.

Se in passato hai lanciato `npm install` in locale e vuoi pulire:

```bash
make clean-local
```

## Avvio rapido progetto

Avvia il server in container:

```bash
make start
```

Apri nel browser:

```text
http://localhost:3000
```

## Gestione ciclo vita progetto

```bash
make start      # avvia app
make stop       # ferma app
make restart    # riavvia app
make logs       # segue log app
make clean      # stop + remove container (app/test)
```

Tutti i target usano automaticamente `HtS_Docker/docker-compose.yml`.

Comandi equivalenti specifici app:

```bash
make app-start
make app-stop
make app-restart
make app-logs
make app-status
make app-clean
```

## Eseguire i test

Test completi in Docker:

```bash
make test
```

Target disponibili:

```bash
make test-unit
make test-integration
make test-coverage
```

## Gestione ciclo vita test

```bash
make test-start    # avvia servizio test
make test-stop     # ferma servizio test
make test-restart  # riavvia servizio test
make test-logs     # segue log test
make test-status   # stato container test
make test-clean    # rimuove container test
```

## Note utili

- Se il comando `docker compose` non fosse disponibile, puoi usare:

```bash
make DC='docker-compose -f HtS_Docker/docker-compose.yml' start
```

- Per l'elenco completo dei target Make:

```bash
make help
```

- Questo repository puo' essere esportato su un'altra macchina senza richiedere Node/npm host,
  a patto di avere Docker + Make.