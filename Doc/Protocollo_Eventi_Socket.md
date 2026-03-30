# Protocollo Eventi Socket.IO

Questa guida descrive gli eventi real-time tra client e server, con payload attesi e note comportamentali.

## 1. Convenzioni
- Transport: Socket.IO
- Messaggi errore: evento `error` con payload `{ message }`
- Stato principale: evento `state_update`
- Lobby state: evento `lobby_update`

## 2. Flusso connessione base
1. client si connette
2. server invia subito `lobby_update`
3. client puo fare `join_lobby` o `join_spectator`
4. a partita avviata, server emette `game_start` ai player
5. aggiornamenti partita via `state_update`

## 3. Eventi client -> server

### 3.1 Lobby
`join_lobby`
- payload: `{ nickname: string }`
- effetti:
  - join lobby se partita non in corso
  - reconnect se nickname corrisponde a player disconnesso

`join_spectator`
- payload: `{ displayName?: string }`
- effetti:
  - entra come spettatore
  - non puo eseguire azioni gameplay

`start_game`
- payload: `{}`
- vincolo: almeno 2 player in lobby

`reset_lobby`
- payload: `{}`
- effetti: reset totale e ritorno fase lobby

### 3.2 Game
`request_action`
- payload: `{ type: string, payload?: object }`
- type supportati server:
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

`flip_card`
- payload: `{ cardId, zone }`
- zone validi: `hand`, `board`

`move_board_card`
- payload: `{ cardId, targetPlayerId?, x, y }`
- note:
  - coordinate clamped lato server in board canonica
  - permette anche trasferimento carta tra board player

`rotate_board_card`
- payload: `{ cardId, rotation?, delta? }`
- stato: deprecato lato server (rotazione locale client non sincronizzata)

`view_discard`
- payload: `{}`
- risposta: `discard_pile`

`view_main_heroes`
- payload: `{}`
- risposta: `mainhero_deck`

`roll_dice`
- payload: `{}`
- risposta broadcast: `dice_result` + `event_log`

`toggle_approval`
- payload: `{}`
- effetto: toggle `approvalMode` nello stato partita

### 3.3 Approval
`respond_approval`
- payload: `{ actionId, decision }`
- `decision`: boolean (`true` approve, `false` deny)

## 4. Eventi server -> client

### 4.1 Stato/Lobby
`lobby_update`
- payload tipico:
  - `players`: array `{ id, nickname }`
  - `gameInProgress`: boolean
  - `spectators`: array opzionale (nel server principale)

`game_start`
- payload:
  - `yourPlayerId`
  - `yourNickname`

`state_update`
- payload: stato completo filtrato per visibilita player/spettatore

`reconnect_success`
- payload:
  - `yourPlayerId`
  - `yourNickname`

`spectator_joined`
- payload:
  - `displayName`
  - `currentSpectators`

### 4.2 Approval lifecycle
`approval_pending`
- emesso quando una richiesta entra in coda

`approval_request`
- richiesta attiva da approvare/negare

`approval_result`
- esito finale
- payload: `{ actionId, granted, approverNickname }`

`approval_pending_cleared`
- segnala chiusura ciclo pending

### 4.3 Log/Eventi di servizio
`event_log`
- messaggi runtime leggibili (join/disconnect/roll/approval info)

`restricted_log`
- storico strutturato delle azioni approvate

`dice_result`
- payload: `{ nickname, result }`

`discard_pile`
- payload: `{ cards: Card[] }`

`mainhero_deck`
- payload: `{ cards: Card[] }`

`error`
- payload: `{ message }`

## 5. Comportamenti speciali

### 5.1 Approval Mode ON/OFF
- ON: `request_action` passa da approvazione (eccetto validazioni preliminari)
- OFF: azione eseguita immediatamente
- Eccezione: `UNDO` continua a passare dal flusso di approvazione

### 5.2 Restrizioni spettatore
Client spettatore riceve errore su eventi gameplay (es. `request_action`, `move_board_card`, `roll_dice`).

### 5.3 Privacy mani
In `state_update`, le mani avversarie sono ridotte a campi minimi (`id`, `isFaceUp`, `ownerId`), senza `name`/`path`.

## 6. Sequenze operative (sintesi)

### 6.1 Esecuzione immediata (approval OFF)
1. client -> `request_action`
2. server esegue action
3. server -> `state_update`
4. server -> `restricted_log`

### 6.2 Esecuzione con approvazione (approval ON)
1. client -> `request_action`
2. server -> `approval_pending`
3. server -> `approval_request`
4. altro player -> `respond_approval`
5. server -> `approval_result`
6. server -> `approval_pending_cleared`
7. se grant: `state_update` + `restricted_log`

### 6.3 Timeout approvazione
1. `approval_request` resta senza risposta > 30s
2. server nega automaticamente
3. emette `approval_result` con `granted=false`
4. emette `approval_pending_cleared`

---
Aggiornato al 2026-03-31.
