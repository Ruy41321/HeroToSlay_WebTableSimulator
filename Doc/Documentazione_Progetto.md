# Hero To Slay Simulator - Documentazione Tecnica Completa

## 1. Panoramica del progetto
Hero To Slay Simulator e un simulatore web multiplayer real-time (2-4 giocatori + spettatori) per giocare su un tavolo virtuale condiviso.

Obiettivi del progetto:
- riprodurre una sessione di gioco con lobby e partita sincronizzata in tempo reale
- separare azioni immediate e azioni soggette ad approvazione (Approval Mode)
- fornire trasparenza tramite log eventi e storico azioni approvate
- supportare riconnessione giocatori e modalita spettatore
- offrire avvio rapido via Docker/Make senza build frontend complessa

Stack principale:
- Backend: Node.js, Express, Socket.IO
- Frontend: Vue 3 via CDN (no bundler)
- Test: Jest + socket.io-client
- Runtime: Docker + docker compose

## 2. Struttura della codebase
Repository root:
- `Assets/`: immagini carte e risorse visive
- `Doc/`: documentazione progetto
- `HtS_Docker/`: Dockerfile + docker-compose
- `Srcs/`: codice runtime (server, client, indexer, package)
- `test/`: test unitari e di integrazione
- `Makefile`: comandi operativi
- `run_herotoslay.sh`: setup/avvio rapido end-to-end

Sottostruttura tecnica in `Srcs/`:
- `server/server.js`: bootstrap server HTTP + Socket.IO
- `server/game/`: logica core (`GameManager`, `ApprovalQueue`, `RestrictedLog`)
- `server/models/`: modelli (`Card`, `Deck`, `Player`)
- `server/socket/`: handlers eventi (`lobbyHandlers`, `gameHandlers`, `approvalHandlers`)
- `public/`: UI Vue (app shell + componenti)
- `indexer.js`: indicizzazione assets in `cards.json`
- `cards.json`: catalogo carte runtime

## 3. Modello dati e stato di gioco

### 3.1 Modelli base
`Card`:
- `id`
- `name`
- `type` (`DeckCards`, `MainHero`, `Monsters`)
- `path`
- `isFaceUp`
- `ownerId`
- `boardPosition`

`Player`:
- `id`
- `nickname`
- `socketId`
- `isDisconnected`
- `hand[]`
- `board[]`

`Deck`:
- `type`
- `cards[]`
- utility: `shuffle()`, `draw()`, `peek(n)`, `size`

### 3.2 Stato in `GameManager`
`GameManager.state` include:
- `players[]`
- `heroDeck[]`
- `mainHeroDeck[]`
- `monsterDeck[]`
- `activeMonsters[3]`
- `discardPile[]`
- `approvalMode` (boolean)
- `phase` (`lobby` | `playing`)

Nel repository attuale (`Srcs/cards.json`) sono presenti:
- `MainHero`: 10
- `DeckCards`: 177
- `Monsters`: 19
- totale: 206 carte

## 4. Bootstrap server e runtime
File: `Srcs/server/server.js`

Flusso startup:
1. carica `cards.json` (errore bloccante se file assente/invalido)
2. espone static:
   - `/Assets` -> `Assets/`
   - root static -> `public/`
3. crea `httpServer` + `Socket.IO Server`
4. istanzia `GameManager(io, cards)`
5. registra i tre gruppi handler per ogni connessione socket

Shared state process:
- `lobbyPlayers`
- `gameInProgress`
- `gameManager`
- `buildLobbyPayload()`
- `broadcastLobbyUpdate()`

Auto reset:
- `GameManager` tiene traccia player disconnessi (TTL 10 min)
- cleanup periodico ogni 60s
- se tutti i player restano disconnessi oltre TTL: reset lobby automatico

## 5. Logica di gioco (`GameManager`)

### 5.1 Inizializzazione partita
`startGame(players)`:
- normalizza player (`hand`, `board`, `isDisconnected=false`)
- separa carte in tre deck per tipo
- mescola i deck (`Deck.shuffle()`)
- inizializza slot mostri attivi e discard
- resetta history, restricted log, approval queue, disconnessioni
- broadcast stato a tutti i client

### 5.2 Privacy dello stato (anti-cheat base)
- ogni giocatore riceve mano completa solo della propria entita
- mani avversarie/spettatori vengono "stub-bate" a `{ id, isFaceUp:false, ownerId }`
- nomi/path delle carte avversarie non vengono inviati

### 5.3 Gestione board canonica
Coordinate canoniche server:
- spazio board: 340x220
- carta: 80x112
- clamp max: x=260, y=108

La UI client trasforma coordinate canoniche in base al lato (`top/left/right/bottom`) mantenendo sincronizzazione unica lato server.

### 5.4 Azioni supportate da `executeAction`
Azioni gestite:
- `DRAW_HERO`
- `TAKE_MAIN_HERO_TO_BOARD`
- `RETURN_MAIN_HERO_TO_DECK`
- `REVEAL_MONSTER`
- `TAKE_MONSTER`
- `RETURN_ACTIVE_MONSTER_TO_BOTTOM`
- `TAKE_FROM_OPPONENT`
- `TAKE_FROM_DISCARD`
- `DISCARD_CARD`
- `ACTIVATE_CARD`
- `RETURN_CARD_TO_HAND`
- `UNDO`

Ogni azione (eccetto `UNDO`) salva snapshot in `historyStack`.

### 5.5 Undo
- `UNDO` ripristina lo snapshot precedente (deep clone)
- se history vuota, non produce errori e non altera lo stato

## 6. Sistema di approvazione (`ApprovalQueue`)

Caratteristiche:
- una sola richiesta pendente alla volta (`isPending`)
- timeout automatico: 30 secondi
- callback su approvazione o denial/timeout
- broadcast ciclo pending:
  - `approval_pending`
  - `approval_request`
  - `approval_result`
  - `approval_pending_cleared`

Regole:
- requester non puo approvare/negare la propria azione
- se una richiesta e pendente, nuove richieste vengono rifiutate
- con `approvalMode` OFF, le azioni non `UNDO` vengono auto-eseguite

## 7. Socket protocol (client/server)

### 7.1 Eventi client -> server
Lobby:
- `join_lobby`
- `join_spectator`
- `start_game`
- `reset_lobby`

Game:
- `request_action`
- `flip_card`
- `move_board_card`
- `rotate_board_card` (deprecato lato server: no sync)
- `view_discard`
- `view_main_heroes`
- `roll_dice`
- `toggle_approval`

Approval:
- `respond_approval`

### 7.2 Eventi server -> client
- `lobby_update`
- `game_start`
- `reconnect_success`
- `spectator_joined`
- `state_update`
- `approval_pending`
- `approval_request`
- `approval_result`
- `approval_pending_cleared`
- `event_log`
- `restricted_log`
- `dice_result`
- `discard_pile`
- `mainhero_deck`
- `error`

## 8. Frontend Vue (`Srcs/public`)

### 8.1 App shell
`app.js` gestisce:
- connessione socket
- switch viste (`lobby`/`game`)
- stato locale player/spettatore
- pending approval e pending request personale
- log eventi/azioni
- modal discard/mainhero
- cambio background (`bg.jpg` / `table_background.png`)

### 8.2 Componenti principali
- `LobbyView`: join queue, start game, join spectator
- `GameView`: orchestrazione game UI, context menu, modali, overlay approvazione
- `PlayerZone`: rendering hand/board per lato tavolo
- `CenterTable`: deck centrali, active monsters, discard
- `CardComponent`: rendering carta/back-side + hover/right-click
- `ContextMenu`: azioni contestuali in base a zona/tipo carta
- `FocusPreview`: anteprima carta ingrandita
- `ApprovalPopup`, `ApprovalToggle`, `DiceRoller`
- `EventLog`, `RestrictedLog`

### 8.3 Drag and drop board cross-player
`GameView` implementa:
- override locale durante drag
- conversione coordinate side<->canonical
- trasferimento carta tra board di player diversi
- persistenza via evento `move_board_card`

Rotazione carta board:
- e gestita localmente dal client (delta a step di 90)
- non viene sincronizzata dal server (comportamento intenzionale)

## 9. Modalita spettatore e reconnect

Spettatore:
- entra con `join_spectator`
- riceve stato con mani nascoste
- non puo inviare azioni gameplay

Reconnect:
- lookup per nickname normalizzato
- se player disconnesso presente: riaggancio socketId + `reconnect_success`
- slot mantenuto per 10 minuti

## 10. Build, avvio e test

### 10.1 Make targets principali
Setup:
- `make setup` -> build immagini app + test
- `make index` -> genera `Srcs/cards.json`

Lifecycle app:
- `make start`
- `make stop`
- `make restart`
- `make rebuild`
- `make logs`
- `make clean`

Testing in Docker:
- `make test`
- `make test-unit`
- `make test-integration`
- `make test-coverage`

### 10.2 Docker
`HtS_Docker/docker-compose.yml`:
- servizio `simulator`: porta 3000, mount read-only Assets + cards
- servizio `test` (profile `test`): esecuzione Jest

`HtS_Docker/Dockerfile`:
- base `node:20-alpine`
- install dipendenze
- copia server/public/test/indexer/cards
- comando avvio: `node server/server.js`

## 11. Indicizzazione carte (`indexer.js`)
- scansiona ricorsivamente immagini in:
  - `Assets/Cards/Heroes`
  - `Assets/Cards/Deck`
  - `Assets/Cards/Monsters`
- estensioni supportate: `.png`, `.jpg`, `.jpeg`, `.webp`
- genera oggetti `{id, name, path, type}` in `Srcs/cards.json`
- fallback con errore se non trova nessuna carta

## 12. Copertura test

Unit test:
- `Card`, `Deck`, `Player`
- `ApprovalQueue`
- `RestrictedLog`
- `GameManager` (azioni principali + board movement + edge cases)

Integration test:
- `lobby.test.js`: cap lobby, duplicati nickname, start constraints
- `game.test.js`: privacy mano, toggle approval, dice/event log, discard view, move board, spectator restrictions
- `approval.test.js`: lifecycle approvazioni ON/OFF, grant/deny, UNDO, azioni principali con gating

## 13. Osservazioni tecniche utili
- Il menu contestuale client propone anche `SHUFFLE_HERO` e `SHUFFLE_MONSTER`, ma queste action non sono implementate in `GameManager.executeAction` (quindi sono ignorate lato server).
- `run_herotoslay.sh` clona via SSH (`git@github.com:...`): serve una chiave SSH GitHub configurata.
- Il percorso canonico del catalogo carte nel repository e `Srcs/cards.json`; in container viene copiato anche come `/app/cards.json`.

## 14. Possibili estensioni future
- enum condivisa ActionType client/server
- validazione payload schema-based per action
- sincronizzazione opzionale rotazione carte board
- test reconnect TTL e auto-reset multi-player estesi
- pipeline CI (lint + test + coverage gate)

---
Documento aggiornato il 2026-03-31.
