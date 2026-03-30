# Hero To Slay Simulator - Documentazione Completa

## 1. Scopo del progetto
Hero To Slay Simulator e una web app multiplayer realtime (2-4 giocatori) che simula un tavolo condiviso di gioco carte.

Obiettivi principali:
- lobby unica con gestione ingresso/uscita giocatori
- sincronizzazione stato partita in tempo reale
- separazione azioni libere e azioni restricted con approvazione
- log eventi e storico azioni restricted
- supporto spettatori
- esecuzione semplice via Docker

## 2. Stack tecnologico
- Backend: Node.js + Express + Socket.io
- Frontend: Vue 3 via CDN (senza build step)
- Test: Jest + socket.io-client
- Runtime container: Docker + docker compose
- Utility: uuid per identificativi unici

Dipendenze applicative (Srcs/package.json):
- express
- socket.io
- uuid

Dipendenze dev:
- jest
- socket.io-client

## 3. Struttura repository
Struttura ad alto livello:
- Assets/: immagini carte e asset statici
- Doc/: documentazione
- HtS_Docker/: Dockerfile e compose
- Srcs/: codice applicazione (server + client)
- test/: suite unit + integration
- Makefile: comandi operativi rapidi

Dettaglio cartelle chiave:
- Srcs/server/
  - server.js: bootstrap HTTP + Socket.io + wiring handler
  - game/: logica stato partita (GameManager, ApprovalQueue, RestrictedLog)
  - models/: Card, Deck, Player
  - socket/: handler eventi lobby, game, approval
- Srcs/public/
  - index.html, style.css, app.js
  - components/: componenti Vue UI
- Srcs/indexer.js: genera cards.json da Assets/Cards/Heroes e Assets/Cards/Monsters
- Srcs/cards.json: catalogo carte indicizzato

## 4. Architettura applicativa
### 4.1 Vista generale
Architettura client-server realtime:
1. Client apre pagina e si connette via Socket.io
2. Server mantiene stato centralizzato in GameManager
3. Ogni evento client viene validato nei socket handlers
4. Server emette aggiornamenti stato e log a tutti i peer interessati

### 4.2 Bootstrap server
Il file server/server.js:
- carica cards.json (con validazione)
- espone static:
  - /Assets -> directory asset
  - public/ -> frontend
- crea http server + istanza Socket.io
- crea GameManager singleton-like
- registra handlers:
  - lobbyHandlers
  - gameHandlers
  - approvalHandlers

### 4.3 Stato condiviso di processo
Contesto condiviso usato dagli handlers:
- lobbyPlayers: coda giocatori in lobby
- gameInProgress: lock partita attiva
- gameManager: istanza logica gioco
- buildLobbyPayload()
- broadcastLobbyUpdate()

## 5. Modello dati di gioco
### 5.1 Entita principali
Card:
- id
- name
- type (hero | monster)
- path
- isFaceUp
- ownerId

Player:
- id
- nickname
- socketId
- isDisconnected
- hand[]
- board[]

Deck:
- type
- cards[]
- metodi: shuffle, draw, peek, size

### 5.2 Game state (GameManager.state)
- players[]
- heroDeck[]
- monsterDeck[]
- activeMonsters[3]
- discardPile[]
- approvalMode (boolean)
- phase (lobby | playing)

### 5.3 Privacy mani
Il server protegge le mani avversarie:
- al giocatore locale invia mano completa solo della propria entita
- per altri giocatori invia solo { id, isFaceUp, ownerId }
- name e path restano nascosti

Regola analoga per spettatori (mani sempre nascoste).

## 6. Flussi funzionali
### 6.1 Lobby
Eventi principali:
- join_lobby
  - controlli: nickname, duplicati, cap max 4, lock partita
  - supporta reconnect per nickname disconnesso
- join_spectator
  - entra come spettatore con displayName
- start_game
  - richiede almeno 2 giocatori
- reset_lobby
  - reset completo e ritorno lobby
- disconnect
  - in lobby: rimuove player dalla coda
  - in partita: marca disconnesso e tiene slot 10 minuti

### 6.2 Reconnect e auto-reset
- slot disconnessi mantenuti per 10 minuti
- cleanup periodico ogni 60 secondi
- se tutti i player restano disconnessi oltre TTL:
  - reset automatico
  - ritorno lobby

### 6.3 Partita e azioni
Ingresso azioni:
- request_action { type, payload }

Azioni currently supportate dal GameManager:
- DRAW_HERO
- REVEAL_MONSTER
- TAKE_MONSTER
- TAKE_FROM_OPPONENT
- DISCARD_CARD
- UNDO

Effetti principali:
- DRAW_HERO: pesca da heroDeck in hand player
- REVEAL_MONSTER: gira top monsterDeck in primo slot libero activeMonsters
- TAKE_MONSTER: prende mostro attivo e lo sposta in board player
- TAKE_FROM_OPPONENT: sposta carta dalla hand/board avversaria alla board richiedente
- DISCARD_CARD: scarta da hand/board a discardPile (face-up)
- UNDO: ripristina snapshot precedente via historyStack

### 6.4 Approval mode
Quando approvalMode e ON:
1. richiesta messa in coda ApprovalQueue
2. broadcast approval_pending
3. invio approval_request
4. altro player approva/nega via respond_approval
5. su approvazione esegue action + approval_result granted=true
6. su deny/timeout approval_result granted=false
7. emette approval_pending_cleared

Quando approvalMode e OFF:
- azioni eseguite subito
- eccezione: UNDO continua a richiedere approvazione

Timeout approvazione: 30 secondi.

### 6.5 Azioni immediate non restricted
- flip_card (zone hand | board)
- view_discard (invia pila completa al requester)
- roll_dice (1..12)
- toggle_approval

## 7. Protocollo Socket.io (sintesi)
### 7.1 Eventi client -> server
- join_lobby
- join_spectator
- start_game
- reset_lobby
- request_action
- respond_approval
- flip_card
- view_discard
- roll_dice
- toggle_approval

### 7.2 Eventi server -> client
- lobby_update
- game_start
- reconnect_success
- spectator_joined
- state_update
- approval_pending
- approval_request
- approval_result
- approval_pending_cleared
- restricted_log
- event_log
- dice_result
- discard_pile
- error

## 8. Frontend Vue
### 8.1 Entrypoint
public/app.js:
- crea app Vue
- apre socket verso origin
- mantiene stato UI:
  - view (lobby/game)
  - localPlayerId
  - gameState
  - pendingApproval
  - logs
  - modale discard
- instrada eventi socket su stato locale
- propaga azioni utente al server via emit

### 8.2 Componenti principali
- LobbyView: join queue, spectator mode, start/reset
- GameView: board globale, menu contestuale, popup approvazione
- PlayerZone: render hand/board per ogni player
- CenterTable: deck, active monsters, discard top
- CardComponent: carta UI + hover/rightclick
- FocusPreview: preview carta in focus
- ApprovalPopup: approva/nega request pending
- ApprovalToggle: switch modalità approvazione
- DiceRoller: lancio dado
- EventLog: log generale
- RestrictedLog: storico azioni restricted
- ContextMenu: menu azioni dipendente da zona carta

## 9. Build, run e test
## 9.1 Prerequisiti
- Docker + docker compose plugin
- Make

## 9.2 Setup iniziale
```bash
make setup
make index
```

## 9.3 Avvio applicazione
```bash
make start
```
App disponibile su:
- http://localhost:3000

## 9.4 Gestione lifecycle app
```bash
make stop
make restart
make rebuild
make logs
make clean
```

## 9.5 Esecuzione test
```bash
make test
make test-unit
make test-integration
make test-coverage
```

## 10. Containerizzazione
### 10.1 Dockerfile
- base image: node:20-alpine
- install dipendenze da Srcs/package.json
- copia codice server, public e test in /app
- espone porta 3000
- comando default: node server/server.js

### 10.2 docker-compose
Servizi:
- simulator:
  - porta 3000:3000
  - mount read-only Assets e cards.json
  - restart unless-stopped
- test (profile test):
  - stesso build context
  - comando npm test

## 11. Strategia test
Suite organizzata in:
- test/unit:
  - Card, Deck, Player
  - ApprovalQueue
  - GameManager
  - RestrictedLog
- test/integration:
  - lobby.test.js
  - game.test.js
  - approval.test.js

Coperture funzionali principali:
- vincoli lobby (max player, nickname duplicato, start minimo 2)
- stato partita e privacy mani
- lifecycle approval (pending, approve, deny, timeout)
- comportamento mode ON/OFF e UNDO
- view discard e payload coerente

## 12. Indicizzazione carte
Srcs/indexer.js:
- legge immagini in:
  - Assets/Cards/Heroes
  - Assets/Cards/Monsters
- estensioni supportate: .png .jpg .jpeg .webp
- genera Srcs/cards.json con campi:
  - id, name, path, type

Se non trova carte, termina con errore.

## 13. Logging
Due stream distinti:
- Event Log (event_log): eventi runtime generali (join, roll, error, approval result)
- Restricted Action History (restricted_log): traccia formale azioni restricted approvate/negate

Formato restricted entry include:
- timestamp
- playerNickname
- actionType
- details
- approvedBy
- message formattato

## 14. Limiti noti e allineamento con TODO
Dal codice attuale rispetto alle richieste nel file TODO risultano ancora aperti diversi punti, ad esempio:
- action Activate con zona carte attivate separata dalla hand
- azioni restricted sulle carte attivate (take/scarta)
- take dalla discard a scelta
- rimessa in fondo monster deck dei monster attivi
- drag and drop carte attivate sul campo
- nuovo tipo MainHero con deck dedicato
- immagine eroe per campo player

Nota tecnica: il context menu frontend espone anche SHUFFLE_HERO e SHUFFLE_MONSTER, ma queste action non risultano tra i tipi supportati da GameManager.executeAction.

## 15. Estensioni consigliate
Per evolvere il progetto in modo robusto:
- introdurre ActionType enum condiviso client/server
- validare payload per ogni action type lato server
- aggiungere test integration per reconnect TTL e spectator transitions
- aggiungere linting e CI pipeline (test + coverage gate)
- versionare protocollo socket (compatibilita client-server)

## 16. Troubleshooting rapido
- Errore cards.json mancante:
  - eseguire make index
- App non raggiungibile su 3000:
  - verificare container con make app-status
  - controllare log con make logs
- Test intermittenti:
  - rilanciare con make test e verificare timeout socket

## 17. Glossario breve
- Restricted action: azione soggetta ad approvazione altri giocatori
- Approval mode: modalita globale ON/OFF per gating azioni
- Spectator: client in sola visualizzazione
- Active monsters: slot centrali mostri rivelati
- Discard pile: pila scarti visibile su richiesta

---
Documento aggiornato al: 2026-03-30
